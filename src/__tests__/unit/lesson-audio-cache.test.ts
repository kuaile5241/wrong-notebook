// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const key = 'a'.repeat(64);
let directory: string;
function wav() { const data = Buffer.alloc(48); data.write('RIFF'); data.write('WAVE', 8); data.writeUInt32LE(40, 4); data.write('data', 36); data.writeUInt32LE(4, 40); return data; }
beforeEach(async () => { directory = await fs.mkdtemp(path.join(tmpdir(), 'lesson-cache-')); vi.stubEnv('LESSON_AUDIO_CACHE_DIR', directory); vi.resetModules(); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await fs.rm(directory, { recursive: true, force: true }); });
describe('讲题音频持久化与生成去重', () => {
    it('同时点击只生成一次，重新加载模块后仍从磁盘复用', async () => {
        const { persistentLessonAudio } = await import('@/lib/lesson-audio-cache');
        const generate = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 20)); return wav(); });
        const results = await Promise.all(Array.from({ length: 20 }, () => persistentLessonAudio(key, generate)));
        expect(generate).toHaveBeenCalledTimes(1); expect(results.every(data => data.equals(wav()))).toBe(true);
        vi.resetModules(); const fresh = await import('@/lib/lesson-audio-cache');
        await expect(fresh.persistentLessonAudio(key, generate)).resolves.toEqual(wav()); expect(generate).toHaveBeenCalledTimes(1);
    });
    it('独立模块实例也通过磁盘锁共用任务', async () => {
        const first = await import('@/lib/lesson-audio-cache'); vi.resetModules(); const second = await import('@/lib/lesson-audio-cache');
        const generate = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 40)); return wav(); });
        await Promise.all([first.persistentLessonAudio(key, generate), second.persistentLessonAudio(key, generate)]); expect(generate).toHaveBeenCalledTimes(1);
    });
    it('损坏缓存不自动重新付费生成', async () => {
        const { persistentLessonAudio } = await import('@/lib/lesson-audio-cache'); const generate = vi.fn(async () => wav());
        await fs.writeFile(path.join(directory, key + '.wav'), 'broken');
        await expect(persistentLessonAudio(key, generate)).rejects.toThrow('AUDIO_CACHE_CORRUPT'); expect(generate).not.toHaveBeenCalled();
    });
    it('保存失败后不允许再次点击重复合成', async () => {
        const { persistentLessonAudio } = await import('@/lib/lesson-audio-cache'); const generate = vi.fn(async () => wav());
        vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('disk full'));
        await expect(persistentLessonAudio(key, generate)).rejects.toThrow('AUDIO_CACHE_WRITE_FAILED');
        await expect(persistentLessonAudio(key, generate)).rejects.toThrow('AUDIO_CACHE_WRITE_FAILED'); expect(generate).toHaveBeenCalledTimes(1);
    });
});
