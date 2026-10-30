import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonPlayer } from '@/lib/lesson-player';
class FakeAudio {
    src = ''; currentTime = 0; duration = 10; playbackRate = 1; paused = true;
    onended: (() => void) | null = null; onerror: (() => void) | null = null; ontimeupdate: (() => void) | null = null;
    async play() { this.paused = false; } pause() { this.paused = true; } load() {} removeAttribute() { this.currentTime = 0; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
describe('连续讲解预取与音频进度', () => {
    it('当前段尚未结束就预取下一步，自动衔接时不重复请求，暂停/切步停止播放', async () => {
        const audio = new FakeAudio(), fetcher = vi.fn<(url: string, init: RequestInit) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>>(async () => ({ ok: true, blob: async () => new Blob(['wav']) }));
        vi.stubGlobal('Audio', function () { return audio; }); vi.stubGlobal('fetch', fetcher);
        vi.stubGlobal('speechSynthesis', undefined); vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const player = new LessonPlayer([{ kind: 'analysis', markdown: '第一步，40-12=28。' }, { kind: 'answer', markdown: '检查二十八小于四十。' }], 'hash', { kind: 'error', id: 'a' });
        player.play(true); await flush();
        expect(fetcher).toHaveBeenCalledTimes(2); expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).step).toBe(1); expect(player.getSnapshot().index).toBe(0);
        audio.currentTime = 4; audio.ontimeupdate?.(); expect(player.getProgress()).toBe(0.4);
        player.setRate(1.25); expect(audio.playbackRate).toBe(1.25); expect(fetcher).toHaveBeenCalledTimes(2);
        audio.onended?.(); await flush(); expect(player.getSnapshot().index).toBe(1); expect(fetcher).toHaveBeenCalledTimes(2);
        player.pause(); expect(audio.paused).toBe(true); player.select(0); expect(player.getSnapshot().progress).toBe(0); player.stop();
    });
});
