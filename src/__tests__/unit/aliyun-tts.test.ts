// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({ getAppConfig: () => ({}) }));
import { aliyunTtsSchema, synthesizeAliyun } from '@/lib/aliyun-tts';
const config = { enabled: true, apiKey: 'test-secret', workspaceId: 'workspace123', voice: 'longxiaochun_v3' as const };
afterEach(() => vi.unstubAllGlobals());
describe('阿里云自然语音协议与边界', () => {
    it('按官方HTTP协议合成并下载音频，不把密钥转发给结果桶', async () => {
        const request = vi.fn().mockResolvedValueOnce(Response.json({ output: { audio: { url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/voice.wav?sign=x' } } })).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
        vi.stubGlobal('fetch', request);
        expect(await synthesizeAliyun('一起学习。', config)).toEqual(Buffer.from([1, 2, 3]));
        expect(request.mock.calls[0][0]).toBe('https://workspace123.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer');
        expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ model: 'cosyvoice-v3-flash', input: { voice: 'longxiaochun_v3', text: '一起学习。', format: 'wav' } });
        expect(request.mock.calls[1][0].protocol).toBe('https:');
        expect(request.mock.calls[1][1].headers).toBeUndefined();
    });
    it('拒绝外部结果域名、重定向，且上游错误不暴露凭据', async () => {
        const request = vi.fn().mockResolvedValueOnce(Response.json({ output: { audio: { url: 'http://127.0.0.1/admin' } } })); vi.stubGlobal('fetch', request);
        await expect(synthesizeAliyun('学习', config)).rejects.toThrow('AUDIO_PROVIDER_FAILED'); expect(request).toHaveBeenCalledTimes(1);
        request.mockResolvedValueOnce(new Response('sensitive provider details', { status: 401 }));
        await expect(synthesizeAliyun('学习', config)).rejects.toThrow('AUDIO_CREDENTIALS');
        expect(request.mock.calls[0][1].redirect).toBe('error');
    });
    it('未配置不发送请求，工作空间和音色严格校验', async () => {
        const request = vi.fn(); vi.stubGlobal('fetch', request);
        await expect(synthesizeAliyun('学习', { ...config, apiKey: '' })).rejects.toThrow('AUDIO_NOT_CONFIGURED'); expect(request).not.toHaveBeenCalled();
        expect(aliyunTtsSchema.safeParse({ ...config, workspaceId: 'evil.com/path' }).success).toBe(false);
        expect(aliyunTtsSchema.safeParse({ ...config, voice: 'unknown' }).success).toBe(false);
    });
});
