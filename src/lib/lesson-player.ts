import { speechChunks, speechText } from './lesson-content';
import type { LessonSource, LessonStep } from './lesson-content';

export type VoiceMode = 'auto' | 'device' | 'compatible' | 'natural';
export interface LessonPlayback { index: number; status: 'idle' | 'loading' | 'playing' | 'paused' | 'error'; error: string; rate: number; mode: VoiceMode; continuous: boolean; progress: number }
export const INITIAL_PLAYBACK: LessonPlayback = { index: 0, status: 'idle', error: '', rate: 1, mode: 'auto', continuous: false, progress: 0 };
let activePlayer: { owner: object; stop: () => void } | null = null;

/** 短句播放控制器。暂停后从当前短句继续，不依赖 Android 的 pause/resume 实现。 */
export class LessonPlayer {
    private state = { ...INITIAL_PLAYBACK };
    private owner = {};
    private listeners = new Set<() => void>();
    private generation = 0;
    private chunk = 0;
    private audio: HTMLAudioElement | null = null;
    private objectUrl = '';
    private utterance: SpeechSynthesisUtterance | null = null;
    private abort: AbortController | null = null;
    private prepared: { key: string; promise: Promise<Blob>; abort: AbortController } | null = null;
    private watchdog: ReturnType<typeof setTimeout> | undefined;
    private language: 'zh' | 'en';
    private segments = new Map<number, string[]>();
    constructor(private steps: LessonStep[], private fingerprint: string, private source: LessonSource, language?: 'zh' | 'en') { this.language = language ?? (steps.some(s => /[\u3400-\u9fff]/.test(s.markdown)) ? 'zh' : 'en'); }
    subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
    getSnapshot = () => this.state;
    private update(patch: Partial<LessonPlayback>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
    private clearNative() {
        clearTimeout(this.watchdog); this.utterance = null;
        if (activePlayer?.owner === this.owner && typeof window !== 'undefined' && typeof window.speechSynthesis?.cancel === 'function') window.speechSynthesis.cancel();
    }
    private clearAudio() {
        this.audio?.pause(); if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.ontimeupdate = null; this.audio.removeAttribute('src'); this.audio.load(); }
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl); this.objectUrl = '';
    }
    stop = () => {
        this.generation++; this.abort?.abort(); this.clearNative(); this.clearAudio(); this.chunk = 0;
        this.prepared?.abort.abort(); this.prepared = null;
        if (activePlayer?.owner === this.owner) activePlayer = null;
        this.update({ status: 'idle', error: '', continuous: false, progress: 0 });
    };
    pause = () => {
        if (this.state.status !== 'playing' && this.state.status !== 'loading') return;
        this.generation++; this.abort?.abort(); this.clearNative(); this.audio?.pause(); this.update({ status: 'paused' });
        this.prepared?.abort.abort(); this.prepared = null;
    };
    select = (index: number) => { this.stop(); this.update({ index: Math.max(0, Math.min(this.steps.length - 1, index)) }); };
    setMode = (mode: VoiceMode) => {
        this.stop(); this.update({ mode });
        if (mode === 'device') {
            try {
                const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
                if (typeof synth?.speak !== 'function' || typeof SpeechSynthesisUtterance === 'undefined' || !synth.getVoices().some(v => v.lang.toLowerCase().startsWith(this.language))) this.update({ status: 'error', error: 'DEVICE_VOICE_UNAVAILABLE' });
            } catch { this.update({ status: 'error', error: 'DEVICE_VOICE_UNAVAILABLE' }); }
        }
    };
    setRate = (rate: number) => {
        if (![0.75, 1, 1.25].includes(rate)) return;
        const playing = this.state.status === 'playing'; this.update({ rate });
        if (this.objectUrl && this.audio) this.audio.playbackRate = rate;
        else if (playing) this.play(this.state.continuous);
    };
    replay = () => { this.stop(); this.play(false); };
    play = (continuous = false) => {
        if (!this.steps.length) return;
        if (activePlayer && activePlayer.owner !== this.owner) activePlayer.stop();
        activePlayer = { owner: this.owner, stop: this.stop };
        const resumeAudio = this.state.status === 'paused' && !!this.objectUrl;
        const gen = ++this.generation; this.abort?.abort(); this.clearNative();
        if (!resumeAudio) this.clearAudio();
        this.update({ continuous, error: '', status: 'loading', ...(!resumeAudio ? { progress: this.chunk / this.chunks(this.state.index).length } : {}) });
        if (resumeAudio) { void this.playAudio(gen); return; }
        const text = speechChunks(speechText(this.steps[this.state.index].markdown, this.language))[this.chunk];
        if (!text) { this.advance(gen); return; }
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        const lang = this.language;
        let voices: SpeechSynthesisVoice[] = [];
        try { if (typeof synth?.getVoices === 'function') voices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(lang)); } catch { /* 部分设备的系统音库暂时不可用，转兼容语音。 */ }
        const voice = voices.find(v => v.localService) ?? (this.state.mode === 'device' ? voices[0] : undefined);
        if (this.state.mode === 'device' && typeof synth?.speak === 'function' && voice && typeof SpeechSynthesisUtterance !== 'undefined') {
            const utterance = new SpeechSynthesisUtterance(text); this.utterance = utterance;
            utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = this.state.rate;
            utterance.onstart = () => { if (gen === this.generation && this.utterance === utterance) { clearTimeout(this.watchdog); this.update({ status: 'playing' }); } };
            utterance.onend = () => { if (gen === this.generation && this.utterance === utterance) { this.utterance = null; this.advance(gen); } };
            const failed = () => { if (gen !== this.generation || this.utterance !== utterance) return; this.clearNative();
                if (this.state.mode === 'auto') void this.playAudio(gen); else this.update({ status: 'error', error: 'DEVICE_VOICE_UNAVAILABLE' }); };
            utterance.onerror = failed; this.watchdog = setTimeout(failed, 4000);
            try { synth.speak(utterance); } catch { failed(); }
        } else if (this.state.mode === 'device') this.update({ status: 'error', error: 'DEVICE_VOICE_UNAVAILABLE' });
        else void this.playAudio(gen);
    };
    private chunks(index: number) {
        if (!this.segments.has(index)) this.segments.set(index, speechChunks(speechText(this.steps[index].markdown, this.language)));
        return this.segments.get(index)!;
    }
    getProgress = () => this.audio && this.objectUrl && Number.isFinite(this.audio.duration) && this.audio.duration > 0
        ? (this.chunk + Math.min(1, this.audio.currentTime / this.audio.duration)) / this.chunks(this.state.index).length : this.state.progress;
    private requestKey(index: number, chunk: number) { return `${this.state.mode}:${index}:${chunk}`; }
    private async requestAudio(index: number, chunk: number, signal: AbortSignal) {
        const response = await fetch('/api/lesson-audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
            body: JSON.stringify({ source: this.source, fingerprint: this.fingerprint, step: index, chunk, mode: this.state.mode === 'device' ? 'auto' : this.state.mode }) });
        if (!response.ok) { const body = await response.json(); throw new Error(typeof body.code === 'string' ? body.code : 'AUDIO_FAILED'); }
        return response.blob();
    }
    private prepareNext() {
        let index = this.state.index, chunk = this.chunk + 1;
        if (chunk >= this.chunks(index).length) { if (!this.state.continuous || index + 1 >= this.steps.length) return; index++; chunk = 0; }
        const key = this.requestKey(index, chunk); if (this.prepared?.key === key) return;
        this.prepared?.abort.abort();
        const abort = new AbortController(), promise = this.requestAudio(index, chunk, abort.signal);
        // 预取失败留到实际播放时重新请求，不影响当前段，且不产生未处理拒绝。
        this.prepared = { key, abort, promise };
        void promise.catch(() => { if (this.prepared?.promise === promise) this.prepared = null; });
    }
    private async playAudio(gen: number) {
        try {
            this.audio ??= new Audio();
            if (!this.objectUrl) {
                const prepared = this.prepared?.key === this.requestKey(this.state.index, this.chunk) ? this.prepared : null;
                this.abort = prepared?.abort ?? new AbortController();
                if (prepared) this.prepared = null;
                const blob = await (prepared?.promise ?? this.requestAudio(this.state.index, this.chunk, this.abort.signal)); if (gen !== this.generation) return;
                this.objectUrl = URL.createObjectURL(blob); this.audio.src = this.objectUrl;
            }
            if (gen !== this.generation) return;
            this.audio.playbackRate = this.state.rate;
            this.audio.onended = () => { if (gen === this.generation) { this.clearAudio(); this.advance(gen); } };
            this.audio.onerror = () => { if (gen === this.generation) this.update({ status: 'error', error: 'AUDIO_FAILED' }); };
            this.audio.ontimeupdate = () => {
                if (gen === this.generation && this.audio && Number.isFinite(this.audio.duration) && this.audio.duration > 0) this.update({ progress: (this.chunk + Math.min(1, this.audio.currentTime / this.audio.duration)) / this.chunks(this.state.index).length });
            };
            await this.audio.play(); if (gen === this.generation) { this.update({ status: 'playing' }); this.prepareNext(); }
        } catch (error) {
            if (gen !== this.generation) return;
            const blocked = error instanceof Error && error.name === 'NotAllowedError';
            this.update({ status: blocked ? 'paused' : 'error', error: blocked ? 'AUDIO_TAP_TO_PLAY' : error instanceof Error ? error.message : 'AUDIO_FAILED' });
        }
    }
    private advance(gen: number) {
        if (gen !== this.generation) return;
        this.chunk++;
        const count = speechChunks(speechText(this.steps[this.state.index].markdown, this.language)).length;
        if (this.chunk < count) { this.play(this.state.continuous); return; }
        this.chunk = 0;
        if (this.state.continuous && this.state.index + 1 < this.steps.length) { this.update({ index: this.state.index + 1, progress: 0 }); this.play(true); }
        else { if (activePlayer?.owner === this.owner) activePlayer = null; this.update({ status: 'idle', continuous: false, progress: 1 }); }
    }
}
