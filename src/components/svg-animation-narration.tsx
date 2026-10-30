'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildAnimationNarration } from '@/lib/animation-narration';
import type { LessonContent } from '@/lib/lesson-content';
import { INITIAL_PLAYBACK, LessonPlayer } from '@/lib/lesson-player';
import type { VoiceMode } from '@/lib/lesson-player';

interface Props { id: string; svg: string; content: LessonContent; onTime: (time: number | null) => void }
export function SvgAnimationNarration({ id, svg, content, onTime }: Props) {
    const { t, language } = useLanguage(), l = t.lesson;
    const { question, answer, analysis } = content;
    const lesson = useMemo(() => buildAnimationNarration(svg, { question, answer, analysis }, language), [svg, question, answer, analysis, language]);
    const player = useMemo(() => new LessonPlayer(lesson.steps, lesson.fingerprint, { kind: 'animation', id, language }, language), [lesson, id, language]);
    const state = useSyncExternalStore(player.subscribe, player.getSnapshot, () => INITIAL_PLAYBACK);
    const [engaged, setEngaged] = useState(false);
    useEffect(() => {
        if (engaged && lesson.cues[state.index]) { const cue = lesson.cues[state.index]; onTime(cue.start + (cue.end - cue.start) * state.progress); }
    }, [engaged, lesson, state.index, state.progress, onTime]);
    useEffect(() => {
        if (!engaged || state.status !== 'playing') return;
        const cue = lesson.cues[state.index]; if (!cue) return;
        let frame = 0, last = 0;
        const tick = (now: number) => { if (now - last >= 32) { onTime(cue.start + (cue.end - cue.start) * player.getProgress()); last = now; } frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
    }, [engaged, state.status, state.index, lesson, player, onTime]);
    useEffect(() => {
        const visibility = () => { if (document.hidden) player.pause(); };
        document.addEventListener('visibilitychange', visibility);
        return () => { player.stop(); document.removeEventListener('visibilitychange', visibility); };
    }, [player]);
    if (!lesson.steps.length) return <p className="text-sm">{l.animationEmpty}</p>;
    const running = state.status === 'playing' || state.status === 'loading';
    const error = state.error.startsWith('AUDIO_CACHE_') ? l.cacheFailed : state.error === 'AUDIO_NOT_CONFIGURED' ? l.notConfigured : state.error === 'AUDIO_CREDENTIALS' ? l.credentials : state.error === 'AUDIO_BUSY' ? l.busy : state.error === 'AUDIO_TAP_TO_PLAY' ? l.tap : state.error === 'LESSON_CHANGED' ? l.changed : state.error ? l.failed : '';
    return <section data-animation-narration className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:bg-violet-950/20">
        <h4 className="font-bold text-violet-700 dark:text-violet-300">{l.animationVoice}</h4>
        <p className="text-xs text-muted-foreground">{lesson.detailed ? l.animationDetailed : l.animationFallback}</p>
        <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setEngaged(true); if (running) player.pause(); else player.play(true); }}>{running ? l.pause : state.status === 'paused' ? l.resume : l.animationPlay}</Button>
            <Button variant="outline" onClick={() => { player.stop(); setEngaged(false); onTime(null); }}>{l.animationSilent}</Button>
            <label className="text-sm">{l.rate}<select aria-label={l.rate} className="ml-2 min-h-10 rounded border bg-background px-2" value={state.rate} onChange={e => player.setRate(Number(e.target.value))}>{[0.75, 1, 1.25].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>
            <label className="text-sm">{l.voice}<select aria-label={l.voice} className="ml-2 min-h-10 rounded border bg-background px-2" value={state.mode} onChange={e => player.setMode(e.target.value as VoiceMode)}>{(['auto', 'natural', 'compatible'] as const).map(mode => <option key={mode} value={mode}>{l[mode]}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap gap-2">{lesson.steps.map((_, i) => i < 2 || i >= lesson.steps.length - 2 || Math.abs(i - state.index) <= 2 ? <Button key={i} size="sm" variant={i === state.index ? 'default' : 'outline'} aria-current={i === state.index ? 'step' : undefined} onClick={() => { setEngaged(true); player.select(i); }}>{l.step} {i + 1}</Button> : null)}</div>
        <MarkdownRenderer content={lesson.steps[state.index].markdown} />
        <p role="status" aria-live="polite" className="text-sm text-primary">{error || (state.status === 'loading' ? l.preparing : state.status === 'playing' ? l.speaking : '')}</p>
    </section>;
}
