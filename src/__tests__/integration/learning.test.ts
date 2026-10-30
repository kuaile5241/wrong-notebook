// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: undefined as PrismaClient | undefined, userId: 'learn-user' }));
vi.mock('@/lib/prisma', () => ({ get prisma() { return mocks.prisma; } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: mocks.userId } })) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
import { GET as CATALOG, POST as CREATE } from '@/app/api/learning/route';
import { GET, POST } from '@/app/api/learning/[id]/route';
import { DATASET_REVISION, getCatalog } from '@/lib/learning/catalog';
import { createLearningState, parseLearning } from '@/lib/learning/session';
import type { LearningView } from '@/lib/learning/types';
let db: PrismaClient, directory: string;
const request = (body: unknown) => new Request('http://localhost/api/learning', { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function create(mode = 'practice') {
    const response = await CREATE(request({ topicIds: ['cnm_p001'], mode, count: 3 }));
    expect(response.status).toBe(201); return response.json() as Promise<LearningView>;
}
beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'notebook-learning-')); const path = join(directory, 'test.db'); writeFileSync(path, '');
    const url = `file:${path}`;
    execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    db = new PrismaClient({ datasources: { db: { url } } }); mocks.prisma = db;
}, 120000);
beforeEach(async () => {
    await db.user.deleteMany(); mocks.userId = 'learn-user';
    await db.user.create({ data: { id: mocks.userId, email: 'learn@example.com', password: 'test-only', canUseAi: false } });
});
afterAll(async () => { await db?.$disconnect(); if (directory) rmSync(directory, { recursive: true, force: true }); });
describe('在线题库完整流程（真实 SQLite）', () => {
    it('没有AI权限仍能练习，目录和待答接口不泄露答案', async () => {
        const response = await CATALOG(new Request('http://localhost/api/learning?search=平均数'));
        const data = await response.json(); expect(data.total).toBeGreaterThan(1);
        expect(JSON.stringify(data)).not.toContain('diagnostic_question');
        const view = await create(); expect(view.question).not.toHaveProperty('answer'); expect(view.history).toEqual([]);
    });
    it('不会的题归档、安排复习，重复提交只记录一次，陈旧提交被拒绝', async () => {
        const view = await create(), body = { revision: 0, requestId: randomUUID(), questionId: view.question!.id, answer: '', skip: true };
        const first = await POST(request(body), ctx(view.id)); expect(first.status).toBe(200);
        const answered = await first.json() as LearningView;
        expect(answered.history[0].errorItemId).toBeTruthy(); expect(answered.revision).toBe(1);
        expect((await POST(request(body), ctx(view.id))).status).toBe(200);
        expect(await db.errorItem.count()).toBe(1); expect(await db.practiceRecord.count()).toBe(1); expect(await db.reviewSchedule.count()).toBe(1);
        expect((await POST(request({ ...body, requestId: randomUUID() }), ctx(view.id))).status).toBe(409);
        expect((await GET(new Request('http://localhost'), ctx(view.id))).status).toBe(200);
    });
    it('同一道来源题再次答错只增作答，不重复生成错题', async () => {
        const q = getCatalog().questions.find(q => q.topicId === 'cnm_p001')!;
        for (let i = 0; i < 2; i++) {
            const state = createLearningState(['cnm_p001'], 'practice', 3); state.queue = [q.id];
            const row = await db.learningSession.create({ data: { userId: mocks.userId, title: '重复来源', mode: 'practice', datasetVersion: DATASET_REVISION, state: JSON.stringify(state) } });
            expect((await POST(request({ revision: 0, requestId: randomUUID(), questionId: q.id, answer: '', skip: true }), ctx(row.id))).status).toBe(200);
        }
        expect(await db.errorItem.count()).toBe(1); expect(await db.practiceRecord.count()).toBe(2);
    });
    it('用户不能读取或提交其他用户的会话，过期和停用立即生效', async () => {
        const view = await create();
        await db.user.create({ data: { id: 'other', email: 'other@example.com', password: 'test-only' } }); mocks.userId = 'other';
        expect((await GET(new Request('http://localhost'), ctx(view.id))).status).toBe(404);
        expect((await POST(request({ revision: 0, requestId: randomUUID(), questionId: view.question!.id, skip: true }), ctx(view.id))).status).toBe(404);
        mocks.userId = 'learn-user'; await db.user.update({ where: { id: mocks.userId }, data: { accessExpiresAt: new Date(0) } });
        expect((await GET(new Request('http://localhost'), ctx(view.id))).status).toBe(403);
        await db.user.update({ where: { id: mocks.userId }, data: { accessExpiresAt: null, isActive: false } });
        expect((await CREATE(request({ topicIds: ['cnm_p001'], mode: 'practice', count: 3 }))).status).toBe(403);
    });
    it('自评题在确认前不保存成绩，确认后标注自评来源', async () => {
        const q = getCatalog().questions.find(q => q.type === 'self')!, state = createLearningState([q.topicId], 'practice', 3); state.queue = [q.id];
        const row = await db.learningSession.create({ data: { userId: mocks.userId, title: '自评', mode: 'practice', datasetVersion: DATASET_REVISION, state: JSON.stringify(state) } });
        const body = { revision: 0, requestId: randomUUID(), questionId: q.id, answer: '自己的思路' };
        expect((await (await POST(request(body), ctx(row.id))).json()).manual).toBe(true);
        expect(parseLearning((await db.learningSession.findUniqueOrThrow({ where: { id: row.id } })).state).history).toHaveLength(0);
        const result = await (await POST(request({ ...body, selfResult: 'correct' }), ctx(row.id))).json();
        expect(result.history[0].method).toBe('self'); expect(result.finished).toBe(true);
    });
});
