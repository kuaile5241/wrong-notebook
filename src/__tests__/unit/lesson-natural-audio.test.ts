// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const mocks = vi.hoisted(() => ({ synth: vi.fn(), config: { enabled: true, apiKey: 'key1', workspaceId: 'space', voice: 'longxiaochun_v3' } }));
vi.mock('@/lib/aliyun-tts', () => ({ ALIYUN_MODEL: 'cosyvoice-v3-flash', getAliyunTtsConfig: () => mocks.config, synthesizeAliyun: mocks.synth }));
import { synthesizeLessonAudio } from '@/lib/lesson-audio';
function wav() { const b = Buffer.alloc(48); b.write('RIFF'); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.write('data', 36); return b; }
let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), 'lesson-natural-')); vi.stubEnv('LESSON_AUDIO_CACHE_DIR', directory); vi.clearAllMocks(); mocks.config.enabled = true; mocks.config.apiKey = 'key1'; mocks.config.voice = 'longxiaochun_v3'; });
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
describe('自然语音缓存与故障处理', () => {
    it('相同讲稿跨已鉴权账号复用，轮换密钥不重复付费，换音色生成新文件', async () => {
        mocks.synth.mockResolvedValue(wav());
        await synthesizeLessonAudio('a', '学习', undefined, 'zh'); await synthesizeLessonAudio('a', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(1);
        await synthesizeLessonAudio('b', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(1);
        mocks.config.apiKey = 'key2'; await synthesizeLessonAudio('a', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(1);
        mocks.config.voice = 'longanyang'; await synthesizeLessonAudio('a', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(2);
        mocks.config.enabled = false;
        await expect(synthesizeLessonAudio('a', '学习', undefined, 'zh', 'natural')).rejects.toMatchObject({ code: 'AUDIO_NOT_CONFIGURED' });
        mocks.config.enabled = true;
    });
    it('并发重听、暂停导致的请求取消共用一次合成，生成任务继续落盘', async () => {
        mocks.synth.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 30)); return wav(); });
        const controller = new AbortController();
        const first = synthesizeLessonAudio('a', '40减12等于28', controller.signal, 'zh'); controller.abort();
        const results = await Promise.all([first, ...Array.from({ length: 8 }, () => synthesizeLessonAudio('a', '40减12等于28', undefined, 'zh'))]);
        expect(results.every(data => data.equals(results[0]))).toBe(true); expect(mocks.synth).toHaveBeenCalledTimes(1); expect(mocks.synth.mock.calls[0][2]).toBeUndefined();
    });
    it('自然语音失败显式报错，保密上游原始错误，不降级机械语音', async () => {
        mocks.synth.mockRejectedValue(new Error('private provider response'));
        await expect(synthesizeLessonAudio('a', '新正文', undefined, 'zh', 'natural')).rejects.toMatchObject({ code: 'AUDIO_PROVIDER_FAILED', status: 503 });
        mocks.synth.mockRejectedValue(new Error('AUDIO_CREDENTIALS'));
        await expect(synthesizeLessonAudio('a', '新正文', undefined, 'zh', 'natural')).rejects.toMatchObject({ code: 'AUDIO_CREDENTIALS' });
    });
});
