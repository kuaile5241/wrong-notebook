
// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: undefined as PrismaClient | undefined, userId: 'admin' }));
vi.mock('@/lib/prisma', () => ({ get prisma() { return mocks.prisma; } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: mocks.userId } })) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
import { POST, GET } from '@/app/api/videos/route';
import { PATCH } from '@/app/api/videos/[id]/route';
import { GET as MEDIA, HEAD } from '@/app/api/videos/[id]/media/route';
import { POST as LINK } from '@/app/api/videos/[id]/link/route';
let db: PrismaClient, directory: string;
const originalDirectory = process.env.VIDEO_LESSON_DIR;
const bytes = Buffer.alloc(64); bytes.write('ftyp', 4); bytes.write('isom', 8);
const id = createHash('sha256').update(bytes).digest('hex');
const ctx = { params: Promise.resolve({ id }) };
const metadata = { title: '鸡兔同笼', grade: 3, published: false, topics: ['假设法'] };
const json = (data: unknown) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(data) });
function upload(data = bytes) { return new Request('http://localhost/api/videos', { method: 'POST', headers: { 'x-video-metadata': encodeURIComponent(JSON.stringify(metadata)) }, body: new Uint8Array(data) }); }
beforeAll(() => {
 directory = mkdtempSync(join(tmpdir(), 'notebook-video-')); process.env.VIDEO_LESSON_DIR = join(directory, 'media');
 const url = 'file:' + join(directory, 'qa.db'); writeFileSync(join(directory, 'qa.db'), '');
 execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
 db = new PrismaClient({ datasources: { db: { url } } }); mocks.prisma = db;
}, 120000);
beforeEach(async () => {
 await db.user.deleteMany(); await db.videoLesson.deleteMany(); mocks.userId = 'admin';
 await db.user.create({ data: { id: 'admin', email: 'qa-admin@example.com', password: 'test', role: 'admin' } });
 await db.user.create({ data: { id: 'child', email: 'qa-child@example.com', password: 'test' } });
 await db.errorItem.create({ data: { id: 'owned', userId: 'child', originalImageUrl: '' } });
});
afterAll(async () => { await db?.$disconnect(); if (originalDirectory === undefined) delete process.env.VIDEO_LESSON_DIR; else process.env.VIDEO_LESSON_DIR = originalDirectory; rmSync(directory, { recursive: true, force: true }); });
describe('视频课程', () => {
 it('上传去重、草稿权限、发布与 Range/HEAD/越界检查', async () => {
  expect((await POST(upload())).status).toBe(201); expect((await POST(upload())).status).toBe(200); expect(await db.videoLesson.count()).toBe(1);
  mocks.userId = 'child'; expect((await POST(upload())).status).toBe(403); expect((await MEDIA(new Request('http://localhost'), ctx)).status).toBe(404);
  expect((await (await GET(new Request('http://localhost'))).json()).videos).toHaveLength(0);
  mocks.userId = 'admin'; expect((await PATCH(json({ ...metadata, published: true, revision: 0 }), ctx)).status).toBe(200);
  expect((await PATCH(json({ ...metadata, revision: 0 }), ctx)).status).toBe(409);
  mocks.userId = 'child'; const range = await MEDIA(new Request('http://localhost', { headers: { Range: 'bytes=4-7' } }), ctx);
  expect(range.status).toBe(206); expect(Buffer.from(await range.arrayBuffer()).toString()).toBe('ftyp');
  expect((await HEAD(new Request('http://localhost', { method: 'HEAD' }), ctx)).headers.get('content-length')).toBe('64');
  expect((await MEDIA(new Request('http://localhost', { headers: { Range: 'bytes=999-' } }), ctx)).status).toBe(416);
  await db.user.update({ where: { id: 'child' }, data: { accessExpiresAt: new Date(0) } }); expect((await MEDIA(new Request('http://localhost'), ctx)).status).toBe(403);
 });
 it('错题关联有归属校验，重复关联幂等，归档即时禁止播放', async () => {
  await POST(upload()); await PATCH(json({ ...metadata, published: true, revision: 0 }), ctx);
  mocks.userId = 'admin'; expect((await LINK(json({ errorId: 'owned', linked: true }), ctx)).status).toBe(404);
  mocks.userId = 'child'; expect((await LINK(json({ errorId: 'owned', linked: true }), ctx)).status).toBe(200); await LINK(json({ errorId: 'owned', linked: true }), ctx);
  expect(await db.videoLessonLink.count()).toBe(1);
  expect((await (await GET(new Request('http://localhost?errorId=owned'))).json()).videos[0].linked).toBe(true);
  mocks.userId = 'admin'; await PATCH(json({ ...metadata, published: true, archived: true, revision: 1 }), ctx);
  mocks.userId = 'child'; expect((await MEDIA(new Request('http://localhost'), ctx)).status).toBe(404);
 });
 it('非法视频和非法标识被拒绝', async () => {
  expect((await POST(upload(Buffer.alloc(64)))).status).toBe(400);
  expect((await MEDIA(new Request('http://localhost'), { params: Promise.resolve({ id: '../config' }) })).status).toBe(404);
 });
});
