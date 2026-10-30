import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonPlayer } from '@/lib/lesson-player';
const utterances: { onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null; text: string }[] = [];
function environment() {
    utterances.length = 0;
    const synth = { cancel: vi.fn(), getVoices: () => [{ lang: 'zh-CN', localService: true }], speak: vi.fn(u => { utterances.push(u); u.onstart?.(); }) };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { onstart = null; onend = null; onerror = null; constructor(public text: string) {} });
    return synth;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('讲解播放生命周期', () => {
    it('连贯播放自动换步，暂停后的迟到事件不继续播，重听和清理有效', () => {
        environment();
        const player = new LessonPlayer([{ kind: 'analysis', markdown: '第一步。' }, { kind: 'answer', markdown: '答案为二。' }], 'hash', { kind: 'error', id: 'a' });
        player.play(true); expect(player.getSnapshot().status).toBe('playing');
        utterances[0].onend?.(); expect(player.getSnapshot().index).toBe(1);
        const stale = utterances[1].onend; player.pause(); stale?.(); expect(player.getSnapshot().status).toBe('paused');
        player.play(true); expect(utterances).toHaveLength(3); utterances[2].onend?.(); expect(player.getSnapshot().status).toBe('idle');
        player.replay(); expect(player.getSnapshot().status).toBe('playing'); player.stop(); expect(player.getSnapshot().status).toBe('idle');
    });
    it('同一页面只允许一个讲解朗读，切换步骤停止当前朗读', () => {
        const synth = environment();
        const steps = [{ kind: 'analysis' as const, markdown: '第一步。' }, { kind: 'answer' as const, markdown: '第二步。' }];
        const a = new LessonPlayer(steps, 'a', { kind: 'error', id: 'a' }), b = new LessonPlayer(steps, 'b', { kind: 'error', id: 'b' });
        a.play(); b.play(); expect(a.getSnapshot().status).toBe('idle'); expect(b.getSnapshot().status).toBe('playing');
        b.select(1); expect(b.getSnapshot().status).toBe('idle'); expect(b.getSnapshot().index).toBe(1); expect(synth.cancel).toHaveBeenCalled(); b.stop();
    });
    it('设备没有声音时给出可切换提示，而不假装正在播放', () => {
        environment(); vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), getVoices: () => [] });
        const p = new LessonPlayer([{ kind: 'analysis', markdown: '第一步' }], 'a', { kind: 'error', id: 'a' });
        p.setMode('device'); p.play(); expect(p.getSnapshot().error).toBe('DEVICE_VOICE_UNAVAILABLE'); p.stop();
    });
});
