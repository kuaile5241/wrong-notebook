// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), synth: vi.fn() }));
vi.mock('@/lib/learning/auth', () => ({ learningAuth: mocks.auth, learningFailure: () => NextResponse.json({}, { status: 500 }), noStore: { headers: { 'Cache-Control': 'no-store' } } }));
vi.mock('@/lib/config', () => ({ getAppConfig: () => ({ aliyunTts: { enabled: true, apiKey: 'secret', workspaceId: 'space123', voice: 'longxiaochun_v3' } }), updateAppConfig: mocks.update }));
vi.mock('@/lib/lesson-audio', async original => ({ ...(await original<typeof import('@/lib/lesson-audio')>()), synthesizeLessonAudio: mocks.synth }));
import { GET, POST } from '@/app/api/voice-settings/route';
const request = (body: unknown) => new Request('http://localhost/api/voice-settings', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: 'admin', role: 'admin' }); });
describe('自然语音管理员设置', () => {
    it('普通账号和过期会话不能读取配置或触发收费试听', async () => {
        mocks.auth.mockResolvedValue({ id: 'u', role: 'user' }); expect((await GET()).status).toBe(403); expect((await POST(request({ action: 'test' }))).status).toBe(403);
        mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 403 })); expect((await GET()).status).toBe(403); expect(mocks.synth).not.toHaveBeenCalled();
    });
    it('密钥只返回掩码，保存掩码保留原密钥', async () => {
        expect(await (await GET()).json()).toMatchObject({ apiKey: '********', ready: true });
        const res = await POST(request({ enabled: true, apiKey: '********', workspaceId: 'space123', voice: 'longanyang' })); expect(res.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith({ aliyunTts: expect.objectContaining({ apiKey: 'secret' }) }); expect(JSON.stringify(await res.json())).not.toContain('secret');
        expect((await POST(request({ enabled: true, apiKey: '', workspaceId: '', voice: 'longanyang' }))).status).toBe(400);
    });
    it('试听正文固定，不能从管理员接口合成客户端任意内容', async () => {
        mocks.synth.mockResolvedValue(Buffer.from('audio'));
        const res = await POST(request({ action: 'test', text: '伪造内容' })); expect(res.status).toBe(200);
        expect(mocks.synth.mock.calls[0][1]).toContain('学习小伙伴'); expect(mocks.synth.mock.calls[0][4]).toBe('natural');
    });
});
