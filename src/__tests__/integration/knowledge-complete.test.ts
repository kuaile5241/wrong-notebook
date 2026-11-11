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
import { GET as KNOWLEDGE } from '@/app/api/knowledge/route';
import { GET as SAMPLE } from '@/app/api/knowledge/sample/route';
import { GET as PROFILES, POST as PROFILE } from '@/app/api/learning/profiles/route';
import { POST as ACTION } from '@/app/api/learning/[id]/actions/route';
import * as Engine from '@/lib/learning/vendor/engine';
import { restoreLearningState } from '@/lib/learning/backup';
import { DATASET_REVISION, LEGACY_DATASET_REVISION, getCatalog } from '@/lib/learning/catalog';
import { parseLearning } from '@/lib/learning/session';
import type { LearningView } from '@/lib/learning/types';
let db: PrismaClient, directory: string;
const request = (body: unknown) => new Request('http://localhost/api/learning', { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
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
describe('图谱、完整筛查报告与档案（真实SQLite）', () => {
    it('新版三门学科可练习，旧同题号错题不会被新版改写覆盖', async () => {
        for (const subject of ['geography','biology','chemistry']) {
            const data = await (await KNOWLEDGE(new Request('http://localhost?subject='+subject))).json();
            expect(data.topics.length).toBeGreaterThan(20); expect(data.dependencies.length).toBeGreaterThan(0);
            const view = await (await CREATE(request({topicIds:[data.topics[0].id],mode:'practice',count:3}))).json() as LearningView;
            expect(view.question).not.toHaveProperty('answer'); expect(view.question!.figure ?? '').not.toContain('onload');
        }
        const qid='cnc_p124_q3';
        for(const datasetVersion of [LEGACY_DATASET_REVISION,DATASET_REVISION]) {
            const row=await db.learningSession.create({data:{userId:mocks.userId,title:'同号不同题',mode:'practice',datasetVersion,state:JSON.stringify({engine:null,queue:[qid],history:[]})}});
            const view=await (await GET(new Request('http://localhost'),ctx(row.id))).json() as LearningView;
            expect(view.question!.prompt).toBe(getCatalog(datasetVersion).questionsById.get(qid)!.prompt);
            const answer=await POST(request({revision:0,requestId:randomUUID(),questionId:qid,skip:true}),ctx(row.id));expect(answer.status).toBe(200);
            expect((await ACTION(request({action:'undo',revision:1}),ctx(row.id))).status).toBe(200);
        }
        const items=await db.errorItem.findMany(); expect(items).toHaveLength(2);
        expect(items.map(i=>i.source)).toContain('cn-math-taxonomy:'+qid);
        expect(items.map(i=>i.source)).toContain('cn-math-taxonomy:'+qid+':'+DATASET_REVISION.slice(0,7));
        expect(items.some(i=>i.questionText!.includes('离离原上草'))).toBe(true);
        expect(items.some(i=>i.questionText!.includes('水洒'))).toBe(true);
    });

    it('图谱元数据和课标完整，但默认不发样题答案；到期即时禁止', async () => {
        const data = await (await KNOWLEDGE(new Request('http://localhost?subject=math'))).json(); expect(data.topics.length).toBeGreaterThan(100);
        const topic = data.topics.find((t: { id: string }) => t.id === 'cnm_h217'); expect(topic.domain).toBe('数与代数'); expect(topic.standards[0].id).toBe('cms-2017:H.FUN.22'); expect(data.standards.find((s: { id: string }) => s.id === topic.standards[0].id).text).toContain('导数'); expect(topic).not.toHaveProperty('diagnostic_question');
        expect((await (await SAMPLE(new Request('http://localhost?id=cnm_h217'))).json()).answer).toBeUndefined(); expect((await (await SAMPLE(new Request('http://localhost?id=cnm_h217&reveal=1'))).json()).answer).toBe('6');
        await db.user.update({ where: { id: mocks.userId }, data: { accessExpiresAt: new Date(0) } }); expect((await KNOWLEDGE(new Request('http://localhost'))).status).toBe(403); expect((await PROFILE(request({ action: 'create', revision: 0, name: 'child' }))).status).toBe(403);
    });
    it('范围筛查只在所选33点内，完整显示未测、按章统计；设置连续3题并保持备份重放', async () => {
        const ids = getCatalog().topics.filter(t => t.id.startsWith('cnm_') && t.grade === 13).map(t => t.id);
        const response = await CREATE(request({ topicIds: ids, mode: 'screen', count: 3, confirm: 3 })); expect(response.status).toBe(201); let view = await response.json() as LearningView;
        expect(view.report!.untested).toHaveLength(33); expect(view.topics).toHaveLength(33); expect(view.report!.chapters.reduce((n, ch) => n + ch.total, 0)).toBe(33);
        let row = await db.learningSession.findUniqueOrThrow({ where: { id: view.id } }); const before = parseLearning(row.state); expect(before.engine!.scope).toEqual(ids); expect(before.engine!.confirm).toBe(3); expect(before.engine!.graphMode).toBe('full');
        for (let i = 0; i < 3; i++) view = await (await POST(request({ revision: view.revision, requestId: randomUUID(), questionId: view.question!.id, skip: true }), ctx(view.id))).json();
        expect(view.finished).toBe(true); expect(view.report!.limitReached).toBe(true); expect(view.report!.weak.length).toBeGreaterThan(0); expect(view.report!.untested.length).toBeGreaterThan(0);
        row = await db.learningSession.findUniqueOrThrow({ where: { id: view.id } }); expect(restoreLearningState(row.state, 'screen', new Map()).engine).toEqual(parseLearning(row.state).engine);
        const extended = await (await ACTION(request({ action: 'extend', revision: view.revision }), ctx(view.id))).json() as LearningView; expect(extended.limit).toBe(13); expect(extended.answered).toBe(3); expect(extended.question).not.toBeNull();
        const undone = await (await ACTION(request({ action: 'undo', revision: extended.revision }), ctx(view.id))).json() as LearningView; expect(undone.answered).toBe(2); expect(undone.question!.id).toBe(view.history[2].question.id);
        expect((await ACTION(request({ action: 'undo', revision: extended.revision }), ctx(view.id))).status).toBe(409);
        const oldItems = (await db.errorItem.findMany()).map(i => i.id), corrected = await (await ACTION(request({ action: 'correct', revision: undone.revision, index: 0, answer: view.history[0].question.answer, selfResult: 'correct' }), ctx(view.id))).json() as LearningView;
        expect(corrected.answered).toBe(1); expect(corrected.history[0].verdict).toBe('correct'); expect((await db.errorItem.findMany()).map(i => i.id)).toEqual(oldItems);
    });
    it('旧硬先修会话继续按旧图和原顺序作答，不被新软边改变', async () => {
        const old = Engine.createSession(getCatalog().graph, ['cnm_h217'], { limit: 3, confirm: 2, seed: 'old-fixture' });
        const row = await db.learningSession.create({ data: { userId: mocks.userId, title: 'legacy', mode: 'diagnose', datasetVersion: DATASET_REVISION, state: JSON.stringify({ engine: old, queue: [], history: [] }) } });
        const first = Engine.nextItem(getCatalog().graph, old)!, view = await (await GET(new Request('http://localhost'), ctx(row.id))).json() as LearningView; expect(view.question!.id).toBe(first.question.id);
        const next = await (await POST(request({ revision: 0, requestId: randomUUID(), questionId: first.question.id, skip: true }), ctx(row.id))).json() as LearningView;
        const expected = Engine.nextItem(getCatalog().graph, Engine.applyAnswer(getCatalog().graph, old, first.topicId, 'skip', { text: '' })); expect(next.question?.id).toBe(expected?.question.id);
        expect(parseLearning((await db.learningSession.findUniqueOrThrow({ where: { id: row.id } })).state).engine!.graphMode).toBeUndefined();
    });
    it('孩子档案是账号私有，进度/错题源分开、归档保留历史；另一账号不能操作会话', async () => {
        const result = await (await PROFILE(request({ action: 'create', revision: 0, name: '孩子甲', grade: 3 }))).json(), a = result.active;
        expect((await PROFILE(request({ action: 'create', revision: 0, name: '过期编辑' }))).status).toBe(409);
        const second = await (await PROFILE(request({ action: 'create', revision: 1, name: '孩子乙', grade: 4 }))).json(), b = second.active;
        for (const profileId of [a, b]) { const view = await (await CREATE(request({ topicIds: ['cnm_p001'], mode: 'practice', count: 3, profileId }))).json() as LearningView; await POST(request({ revision: 0, requestId: randomUUID(), questionId: view.question!.id, skip: true }), ctx(view.id)); }
        expect(await db.errorItem.count()).toBe(2); expect(new Set((await db.errorItem.findMany()).map(i => i.source)).size).toBe(2);
        const data = await (await PROFILES()).json(); expect(data.profiles).toHaveLength(2); expect(data.sessions.filter((s: { profileId: string }) => s.profileId === a)).toHaveLength(1);
        expect((await PROFILE(request({ action: 'edit', revision: 2, id: a, archived: true }))).status).toBe(200); expect(await db.learningSession.count()).toBe(2);
        expect((await CREATE(request({ topicIds: ['cnm_p001'], mode: 'practice', count: 3, profileId: a }))).status).toBe(400);
        await db.user.create({ data: { id: 'foreign', email: 'foreign@example.com', password: 'test-only' } }); mocks.userId = 'foreign'; expect((await (await PROFILES()).json()).profiles).toEqual([]);
        expect((await ACTION(request({ action: 'undo', revision: 1 }), ctx(data.sessions[0].id))).status).toBe(404); expect((await PROFILE(request({ action: 'select', revision: 0, id: b }))).status).toBe(404);
    });
    it('目录后续页真的可访问，编号也可检索，筛查范围不被当前页截断', async () => {
        const first = await (await CATALOG(new Request('http://localhost?subject=math&search=数&page=1'))).json(), second = await (await CATALOG(new Request('http://localhost?subject=math&search=数&page=2'))).json();
        expect(first.total).toBeGreaterThan(100); expect(first.topics).toHaveLength(100); expect(second.topics.length).toBeGreaterThan(0); expect(second.topics[0].id).not.toBe(first.topics[0].id); expect(first.scopeTopicIds).toHaveLength(first.total);
        const exact = await (await CATALOG(new Request('http://localhost?subject=math&search=cnm_h217'))).json(); expect(exact.topics[0].id).toBe('cnm_h217');
    });
});
