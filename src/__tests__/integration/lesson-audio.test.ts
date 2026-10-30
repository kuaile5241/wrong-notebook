// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { id: 'u', isActive: true, role: 'user', accessExpiresAt: null as Date | null }, item: vi.fn(), session: vi.fn(), synth: vi.fn(), quota: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u' } })) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(async () => mocks.user) }, errorItem: { findFirst: mocks.item }, learningSession: { findFirst: mocks.session } } }));
vi.mock('@/lib/lesson-audio', async original => ({ ...(await original<typeof import('@/lib/lesson-audio')>()), synthesizeLessonAudio: mocks.synth, checkAudioQuota: mocks.quota }));
import { POST } from '@/app/api/lesson-audio/route';
import { buildLesson } from '@/lib/lesson-content';
import { buildAnimationNarration } from '@/lib/animation-narration';
const content = { question: '计算1+1', analysis: '把两部分合起来。', answer: '2' };
const body = { source: { kind: 'error', id: 'e' }, fingerprint: buildLesson(content).fingerprint, step: 1, chunk: 0 };
const req = (data: unknown) => new Request('http://localhost/api/lesson-audio', { method: 'POST', body: JSON.stringify(data) });
beforeEach(() => { vi.clearAllMocks(); mocks.user.isActive = true; mocks.user.accessExpiresAt = null; mocks.item.mockResolvedValue({ questionText: content.question, answerText: content.answer, analysis: content.analysis }); mocks.synth.mockResolvedValue(Buffer.from('audio')); });
describe('讲解音频的来源与有效期', () => {
    it('从本人原解析生成私有短音频，不采用客户端伪造文本', async () => {
        const res = await POST(req({ ...body, text: '伪造文本' })); expect(res.status).toBe(200);
        expect(mocks.item).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e', userId: 'u' } }));
        expect(mocks.synth.mock.calls[0][1]).toBe('把两部分合起来。'); expect(res.headers.get('Cache-Control')).toContain('no-store');
    });
    it('不属于用户的内容、未提交答案和改动后的解析不可朗读', async () => {
        mocks.item.mockResolvedValue(null); expect((await POST(req(body))).status).toBe(404);
        mocks.session.mockResolvedValue({ state: JSON.stringify({ history: [] }) });
        expect((await POST(req({ ...body, source: { kind: 'learning', id: 's', questionId: 'future-q' } }))).status).toBe(404);
        mocks.item.mockResolvedValue({ analysis: '已经变更' }); expect((await POST(req(body))).status).toBe(409);
        expect(mocks.synth).not.toHaveBeenCalled();
    });
    it('已有登录会话在过期或停用后立即拒绝音频', async () => {
        mocks.user.accessExpiresAt = new Date(0); expect((await POST(req(body))).status).toBe(403);
        mocks.user.accessExpiresAt = null; mocks.user.isActive = false; expect((await POST(req(body))).status).toBe(403);
        expect(mocks.synth).not.toHaveBeenCalled();
    });
    it('动画配音只能读取本人已保存的对应语言讲稿，忽略伪造字幕并检查版本', async () => {
        const svg = '<svg><desc data-voice-start="0" data-voice-end="5">先减去十二，40-12=28。</desc><rect><animate attributeName="x" dur="5s"/></rect></svg>';
        mocks.item.mockResolvedValue({ questionText: content.question, answerText: content.answer, analysis: content.analysis, svgAnimation: svg, svgAnimationEn: null });
        const data = { source: { kind: 'animation', id: 'e', language: 'zh' }, fingerprint: buildAnimationNarration(svg, content, 'zh').fingerprint, step: 0, chunk: 0, text: '伪造讲稿' };
        expect((await POST(req(data))).status).toBe(200); expect(mocks.synth.mock.calls[0][1]).toBe('先减去十二，四十减去十二，等于二十八。');
        expect((await POST(req({ ...data, source: { ...data.source, language: 'en' } }))).status).toBe(404);
        expect((await POST(req({ ...data, fingerprint: 'changed' }))).status).toBe(409);
        mocks.item.mockResolvedValue(null); expect((await POST(req(data))).status).toBe(404);
    });
});
