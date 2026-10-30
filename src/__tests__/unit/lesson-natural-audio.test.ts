// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ synth: vi.fn(), config: { enabled: true, apiKey: 'key1', workspaceId: 'space', voice: 'longxiaochun_v3' } }));
vi.mock('@/lib/aliyun-tts', () => ({ ALIYUN_MODEL: 'cosyvoice-v3-flash', getAliyunTtsConfig: () => mocks.config, synthesizeAliyun: mocks.synth }));
import { synthesizeLessonAudio } from '@/lib/lesson-audio';
function wav() { const b = Buffer.alloc(48); b.write('RIFF'); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.write('data', 36); return b; }
describe('自然语音缓存与故障处理', () => {
    it('自动优先自然语音，按用户、音色、密钥隔离缓存', async () => {
        mocks.synth.mockResolvedValue(wav());
        await synthesizeLessonAudio('a', '学习', undefined, 'zh'); await synthesizeLessonAudio('a', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(1);
        await synthesizeLessonAudio('b', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(2);
        mocks.config.apiKey = 'key2'; await synthesizeLessonAudio('a', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(3);
        mocks.config.voice = 'longanyang'; await synthesizeLessonAudio('a', '学习', undefined, 'zh'); expect(mocks.synth).toHaveBeenCalledTimes(4);
        mocks.config.enabled = false;
        await expect(synthesizeLessonAudio('a', '学习', undefined, 'zh', 'natural')).rejects.toMatchObject({ code: 'AUDIO_NOT_CONFIGURED' });
        mocks.config.enabled = true;
    });
    it('自然语音失败显式报错，保密上游原始错误，不降级机械语音', async () => {
        mocks.synth.mockRejectedValue(new Error('private provider response'));
        await expect(synthesizeLessonAudio('a', '新正文', undefined, 'zh', 'natural')).rejects.toMatchObject({ code: 'AUDIO_PROVIDER_FAILED', status: 503 });
        mocks.synth.mockRejectedValue(new Error('AUDIO_CREDENTIALS'));
        await expect(synthesizeLessonAudio('a', '新正文', undefined, 'zh', 'natural')).rejects.toMatchObject({ code: 'AUDIO_CREDENTIALS' });
    });
});
