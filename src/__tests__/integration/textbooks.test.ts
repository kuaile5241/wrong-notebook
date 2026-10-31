// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: undefined as PrismaClient | undefined, userId: 'book-admin', voice: vi.fn(async () => Buffer.alloc(100)), quota: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ get prisma() { return mocks.prisma; } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: mocks.userId } })) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/lesson-audio', () => ({ checkAudioQuota: mocks.quota, synthesizeLessonAudio: mocks.voice, LessonAudioError: class extends Error {} }));
import { GET as BOOKS, POST as CREATE } from '@/app/api/textbooks/route';
import { GET as BOOK, POST as SAVE } from '@/app/api/textbooks/[id]/route';
import { POST as UNIT } from '@/app/api/textbooks/[id]/units/route';
import { POST as TERM } from '@/app/api/textbooks/[id]/terms/route';
import { POST as IMPORT } from '@/app/api/textbooks/[id]/import/route';
import { POST as SEED } from '@/app/api/textbooks/seed/route';
import { GET as AUDIO, HEAD } from '@/app/api/textbooks/terms/[id]/audio/route';
import { POST as PREFERENCES } from '@/app/api/vocabulary/preferences/route';
import { GET as WORDS } from '@/app/api/vocabulary/route';
import { POST as START } from '@/app/api/vocabulary/practice/route';
import { POST as ANSWER } from '@/app/api/vocabulary/practice/[id]/route';
import { GET as WORD } from '@/app/api/vocabulary/words/[id]/route';
let db: PrismaClient, directory: string;
const request = (body: unknown) => new Request('http://localhost/api/textbooks', { method: 'POST', body: JSON.stringify(body) });
const get = (query = '') => new Request('http://localhost/api/textbooks' + query);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const metadata = { title: '测试教材', subject: 'english', stage: 'primary', grade: 3, volume: '上册', publisher: '测试出版社', edition: '2024' };
async function create() { const response = await CREATE(request({ ...metadata, published: true })); expect(response.status).toBe(201); return response.json(); }
async function revision(id: string) { return (await db.textbookBook.findUniqueOrThrow({ where: { id } })).revision; }
async function unit(bookId: string) { const response = await UNIT(request({ revision: await revision(bookId), code: 'U1', title: 'Hello!', position: 1 }), ctx(bookId)); expect(response.status).toBe(200); return response.json(); }
async function term(bookId: string, unitId: string, word = 'orange', meaning = '橙色的') { const response = await TERM(request({ revision: await revision(bookId), unitId, word, meaning }), ctx(bookId)); expect(response.status).toBe(200); return response.json(); }
async function publish(id: string) { const response = await SAVE(request({ ...metadata, revision: await revision(id), published: true }), ctx(id)); expect(response.status).toBe(200); }
beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'notebook-books-')); const file = join(directory, 'test.db'); writeFileSync(file, '');
    const url = `file:${file}`; execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    db = new PrismaClient({ datasources: { db: { url } } }); mocks.prisma = db;
}, 120000);
beforeEach(async () => { await db.user.deleteMany(); await db.textbookBook.deleteMany(); mocks.userId = 'book-admin'; vi.clearAllMocks(); await db.user.create({ data: { id: mocks.userId, email: 'book-admin@example.com', password: 'test-only', role: 'admin' } }); await db.user.create({ data: { id: 'learner', email: 'learner@example.com', password: 'test-only', canUseAi: false } }); });
afterAll(async () => { await db?.$disconnect(); if (directory) rmSync(directory, { recursive: true, force: true }); });
describe('教材书架和管理（真实SQLite）', () => {
    it('新书强制草稿，普通账号无法读草稿或进行任何内容写入，发布后可学习', async () => {
        const book = await create(); expect(book.published).toBe(false);
        mocks.userId = 'learner'; expect((await (await BOOKS(get('?manage=true'))).json()).books).toEqual([]); expect((await BOOK(get('?manage=true'), ctx(book.id))).status).toBe(404);
        expect((await CREATE(request(metadata))).status).toBe(403); expect((await SEED()).status).toBe(403);
        mocks.userId = 'book-admin'; const u = await unit(book.id); await term(book.id, u.id); await publish(book.id);
        mocks.userId = 'learner'; expect((await BOOK(get(), ctx(book.id))).status).toBe(200); expect((await (await BOOKS(get())).json()).books).toHaveLength(1);
    });
    it('目录编号唯一，修改有版本保护，不允许把词条写到别的教材单元', async () => {
        const a = await create(), b = await create(), u = await unit(a.id);
        expect((await TERM(request({ revision: 0, unitId: u.id, word: 'hi', meaning: '你好' }), ctx(b.id))).status).toBe(409); expect(await revision(b.id)).toBe(0);
        expect((await UNIT(request({ revision: await revision(a.id), code: 'U1', title: 'Other' }), ctx(a.id))).status).toBe(409);
        expect((await SAVE(request({ ...metadata, revision: 0 }), ctx(a.id))).status).toBe(409);
        expect((await CREATE(request({ ...metadata, sourceUrl: 'javascript:alert(1)' }))).status).toBe(400);
    });
    it('导入先预览不写入，校验错误不允许确认，重复导入跳过且不覆盖新内容', async () => {
        const book = await create(), rows = [{ unitCode: 'U1', unitTitle: 'Hello!', word: 'hello', meaning: '你好' }, { unitCode: 'U1', unitTitle: 'Hello!', word: 'zorb', meaning: '自定义示例' }];
        const preview = await (await IMPORT(request({ action: 'preview', rows }), ctx(book.id))).json(); expect(preview.summary).toMatchObject({ newUnits: 1, added: 2, noAtlas: 1 }); expect(await db.textbookTerm.count()).toBe(0);
        expect((await IMPORT(request({ action: 'commit', revision: preview.revision, rows }), ctx(book.id))).status).toBe(200); expect(await db.textbookTerm.count()).toBe(2);
        const again = await (await IMPORT(request({ action: 'preview', rows }), ctx(book.id))).json(); expect(again.summary.skipped).toBe(2);
        const bad = await (await IMPORT(request({ action: 'preview', rows: [...rows, rows[0]] }), ctx(book.id))).json(); expect(bad.totalIssues).toBeGreaterThan(0);
        expect((await IMPORT(request({ action: 'commit', revision: again.revision, rows: [...rows, rows[0]] }), ctx(book.id))).status).toBe(400);
        const before = await revision(book.id);
        expect((await SAVE(request({ ...metadata, title: '已修改', revision: before }), ctx(book.id))).status).toBe(200);
        expect((await IMPORT(request({ action: 'commit', revision: again.revision, rows, mode: 'update' }), ctx(book.id))).status).toBe(409);
    });
    it('本课词义与自由图鉴分开，按本册本单元选词并保存偏好，内容更新使旧题失效', async () => {
        const book = await create(), u = await unit(book.id), t = await term(book.id, u.id); await publish(book.id);
        mocks.userId = 'learner'; expect((await PREFERENCES(request({ bookId: book.id, unitId: u.id }))).status).toBe(200);
        const words = await (await WORDS(new Request('http://localhost/api/vocabulary'))).json(); expect(words.words).toHaveLength(1); expect(words.words[0].zh).toContain('橙色'); expect(words.words[0].media & 1).toBe(0);
        const q = await (await START(request({ wordId: '', mode: 'spelling' }))).json(); expect(q.scope.bookId).toBe(book.id); expect(q.scope.unitId).toBe(u.id);
        expect((await (await WORD(get(), ctx('tb-' + t.id))).json()).word.senses[0].zh).toBe('橙色的');
        mocks.userId = 'book-admin'; await TERM(request({ ...t, meaning: '颜色：橙色', revision: await revision(book.id) }), ctx(book.id));
        mocks.userId = 'learner'; expect((await ANSWER(request({ answer: 'orange' }), ctx(q.id))).status).toBe(409);
    });
    it('自然朗读只能读取已发布词条，HEAD不生成，用户传入正文无效，到期立刻禁止', async () => {
        const book = await create(), u = await unit(book.id), t = await term(book.id, u.id, 'two', '二');
        expect((await AUDIO(get(), ctx(t.id))).status).toBe(404); await publish(book.id); mocks.userId = 'learner';
        expect((await HEAD(new Request('http://localhost', { method: 'HEAD' }), ctx(t.id))).status).toBe(200); expect(mocks.voice).not.toHaveBeenCalled();
        const response = await AUDIO(new Request('http://localhost?text=should-not-read', { headers: { range: 'bytes=0-9' } }), ctx(t.id)); expect(response.status).toBe(206); expect((await response.arrayBuffer()).byteLength).toBe(10);
        expect(mocks.voice).toHaveBeenCalledWith('learner', 'two', undefined, 'en', 'natural');
        await db.user.update({ where: { id: 'learner' }, data: { accessExpiresAt: new Date(0) } }); expect((await AUDIO(get(), ctx(t.id))).status).toBe(403); expect(mocks.voice).toHaveBeenCalledTimes(1);
    });
    it('首本教材包含官方核对的9单元和125条参考词汇，重复安装不覆盖编辑内容', async () => {
        expect((await SEED()).status).toBe(200); const book = await db.textbookBook.findUniqueOrThrow({ where: { id: 'ljxj-en-3-upper-2024' }, include: { units: { include: { terms: true } } } });
        expect(book.isbn).toBe('978-7-5539-9947-0'); expect(book.units).toHaveLength(9); expect(book.units.flatMap(u => u.terms)).toHaveLength(125); expect(book.units.every(u => u.terms.every(t => !t.verified))).toBe(true);
        await db.textbookBook.update({ where: { id: book.id }, data: { title: '管理员已修改' } }); expect((await (await SEED()).json()).textbooksCreated).toBe(0); expect((await db.textbookBook.findUniqueOrThrow({ where: { id: book.id } })).title).toBe('管理员已修改');
    });
});
