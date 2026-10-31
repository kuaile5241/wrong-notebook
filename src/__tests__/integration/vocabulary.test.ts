// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: undefined as PrismaClient | undefined, userId: 'words-user', role: 'user' }));
vi.mock('@/lib/prisma', () => ({ get prisma() { return mocks.prisma; } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: mocks.userId, role: mocks.role, email: 'words@example.com' } })) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
import { GET as CATALOG } from '@/app/api/vocabulary/route';
import { POST as PREFERENCES } from '@/app/api/vocabulary/preferences/route';
import { GET as WORD, POST as FAVORITE } from '@/app/api/vocabulary/words/[id]/route';
import { POST as START } from '@/app/api/vocabulary/practice/route';
import { GET as QUESTION, POST as ANSWER } from '@/app/api/vocabulary/practice/[id]/route';
import { GET as MEDIA } from '@/app/api/vocabulary/media/[kind]/[id]/route';
import { POST as RESET } from '@/app/api/admin/system-reset/route';
import type { PracticeView } from '@/lib/vocabulary/practice';
import { matchesSettings, settingsSchema, vocabularyCatalog } from '@/lib/vocabulary/catalog';
import { scheduleWord } from '@/lib/vocabulary/srs';
let db: PrismaClient, directory: string;
const originalMedia = process.env.VOCABULARY_MEDIA_DIR;
const request = (body: unknown) => new Request('http://localhost/api/vocabulary', { method: 'POST', body: JSON.stringify(body) });
const get = (query = '') => new Request('http://localhost/api/vocabulary' + query);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function start(mode = 'spelling', wordId = 'library') {
    const response = await START(request({ wordId, mode })); expect(response.status).toBe(201); return response.json() as Promise<PracticeView>;
}
beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'notebook-words-')); const file = join(directory, 'test.db'); writeFileSync(file, '');
    const url = `file:${file}`; execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    db = new PrismaClient({ datasources: { db: { url } } }); mocks.prisma = db;
    process.env.VOCABULARY_MEDIA_DIR = join(directory, 'media'); mkdirSync(join(directory, 'media/audio/uk'), { recursive: true }); writeFileSync(join(directory, 'media/audio/uk/library.mp3'), Buffer.alloc(100, 1));
}, 120000);
beforeEach(async () => { mocks.userId = 'words-user'; mocks.role = 'user'; await db.user.deleteMany(); await db.user.create({ data: { id: mocks.userId, email: 'words@example.com', password: 'test-only', canUseAi: false } }); });
afterAll(async () => { await db?.$disconnect(); if (originalMedia === undefined) delete process.env.VOCABULARY_MEDIA_DIR; else process.env.VOCABULARY_MEDIA_DIR = originalMedia; if (directory) rmSync(directory, { recursive: true, force: true }); });

describe('词汇完整流程（真实SQLite）', () => {
    it('恢复出厂设置包含词汇记录，普通账号不能触发', async () => {
        await start(); expect((await RESET()).status).toBe(403);
        mocks.role = 'admin'; expect((await RESET()).status).toBe(200);
        expect(await db.vocabularyCard.count()).toBe(0); expect(await db.vocabularyAttempt.count()).toBe(0);
        expect(await db.user.count()).toBe(1);
    });
    it('无需AI权限；偏好、收藏和阶段筛选按账号同步', async () => {
        const first = await (await CATALOG(get())).json(); expect(first.totalWords).toBe(7298); expect(first.settings.stage).toBe('primary'); expect(first.available).toBeGreaterThan(150);
        expect((await PREFERENCES(request({ stage: 'senior', accent: 'us', dailyGoal: 20 }))).status).toBe(200);
        const next = await (await CATALOG(get())).json(); expect(next.settings.stage).toBe('senior'); expect(next.settings.accent).toBe('us');
        expect((await FAVORITE(request({ favorite: true }), ctx('library'))).status).toBe(200);
        expect((await (await WORD(get(), ctx('library'))).json()).progress.favorite).toBe(true);
        await db.user.create({ data: { id: 'other', email: 'other@example.com', password: 'test-only' } }); mocks.userId = 'other';
        expect((await (await CATALOG(get())).json()).settings.stage).toBe('primary'); expect((await (await WORD(get(), ctx('library'))).json()).progress).toBeNull();
    });
    it('首次答题才计分和排期，重复提交返回旧结果；同词旧题不能覆盖新进度', async () => {
        const a = await start(), b = await start();
        const result = await ANSWER(request({ answer: 'library', grade: 1, correct: false }), ctx(a.id)); expect(result.status).toBe(200);
        const view = await result.json(); expect(view.correct).toBe(true); expect(view.grade).toBe(3); expect(view.word.id).toBe('library');
        expect((await (await ANSWER(request({ answer: 'wrong' }), ctx(a.id))).json()).correct).toBe(true);
        expect((await ANSWER(request({ answer: 'library' }), ctx(b.id))).status).toBe(409);
        const card = await db.vocabularyCard.findFirstOrThrow(); expect(card.reviews).toBe(1); expect(card.correct).toBe(1); expect(card.wrong).toBe(0); expect(card.dueAt).not.toBeNull();
        expect((await (await QUESTION(get(), ctx(a.id))).json()).completed).toBe(true);
    });
    it('并发重复提交同题只排期一次', async () => {
        const q = await start();
        const responses = await Promise.all([ANSWER(request({ answer: 'library' }), ctx(q.id)), ANSWER(request({ answer: 'wrong' }), ctx(q.id))]);
        expect(responses.map(r => r.status)).toEqual([200, 200]);
        expect((await db.vocabularyCard.findFirstOrThrow()).reviews).toBe(1);
        expect((await db.vocabularyAttempt.findFirstOrThrow()).completedAt).not.toBeNull();
    });
    it('听辨题面不提前带答案，错误进入复习记录，自评与判分成绩分开', async () => {
        const q = await start('listening'); expect(q.prompt).toBe(''); expect(q.word).toBeNull();
        const attempt = await db.vocabularyAttempt.findUniqueOrThrow({ where: { id: q.id } }), choices = JSON.parse(attempt.choices) as string[];
        const wrong = ['A', 'B', 'C', 'D'][choices.findIndex(id => id !== 'library')];
        expect((await (await ANSWER(request({ answer: wrong }), ctx(q.id))).json()).correct).toBe(false);
        const self = await start('self'), before = (await db.vocabularyCard.findFirstOrThrow()).reviews;
        expect((await (await QUESTION(get('?reveal=true'), ctx(self.id))).json()).word.id).toBe('library');
        expect((await db.vocabularyCard.findFirstOrThrow()).reviews).toBe(before);
        expect((await (await ANSWER(request({ grade: 4 }), ctx(self.id))).json()).correct).toBeNull();
        const card = await db.vocabularyCard.findFirstOrThrow(); expect(card.correct).toBe(0); expect(card.wrong).toBe(1); expect(card.selfReviews).toBe(1);
    });
    it('到期词优先、筛选隔离；未到期的全部已学词不会被误当新词', async () => {
        const a = await start(); await ANSWER(request({ answer: 'library' }), ctx(a.id));
        await db.vocabularyCard.updateMany({ data: { dueAt: new Date(0) } });
        expect((await (await CATALOG(get('?scope=due'))).json()).words[0].id).toBe('library');
        expect((await start('meaning', '')).audioId).toBe('library');
    });
    it('筛选内已学词均未到期时不虚构今日新词', async () => {
        const settings = settingsSchema.parse({ topic: 'technology' });
        await PREFERENCES(request(settings));
        const words = vocabularyCatalog().words.filter(w => matchesSettings(w, settings)); expect(words.length).toBeGreaterThan(0);
        for (const w of words) await db.vocabularyCard.create({ data: { userId: mocks.userId, wordId: w.id, ...scheduleWord('', 4), reviews: 1, correct: 1 } });
        expect((await (await CATALOG(get())).json()).planAvailable).toBe(false);
        expect((await START(request({ wordId: '', mode: 'meaning' }))).status).toBe(404);
    });
    it('跨账号不能读题、提交；到期立即阻止目录和媒体，续期恢复', async () => {
        const q = await start(); await db.user.create({ data: { id: 'other', email: 'other@example.com', password: 'test-only' } }); mocks.userId = 'other';
        expect((await QUESTION(get(), ctx(q.id))).status).toBe(404); expect((await ANSWER(request({ answer: 'library' }), ctx(q.id))).status).toBe(404);
        mocks.userId = 'words-user'; await db.user.update({ where: { id: mocks.userId }, data: { accessExpiresAt: new Date(0) } });
        expect((await CATALOG(get())).status).toBe(403); expect((await MEDIA(get(), { params: Promise.resolve({ id: 'library', kind: 'uk' }) })).status).toBe(403);
        await db.user.update({ where: { id: mocks.userId }, data: { accessExpiresAt: null } }); expect((await CATALOG(get())).status).toBe(200);
    });
    it('录音Range返回206，非法媒体路径不读取磁盘', async () => {
        const response = await MEDIA(new Request('http://localhost', { headers: { range: 'bytes=10-19' } }), { params: Promise.resolve({ id: 'library', kind: 'uk' }) });
        expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 10-19/100'); expect((await response.arrayBuffer()).byteLength).toBe(10);
        expect((await MEDIA(get(), { params: Promise.resolve({ id: '../secret', kind: 'uk' }) })).status).toBe(404);
    });
});
