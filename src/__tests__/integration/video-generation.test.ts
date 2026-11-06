
// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: undefined as PrismaClient | undefined, userId: 'u', generate: vi.fn(), quota: vi.fn(async () => null) }));
vi.mock('@/lib/prisma', () => ({ get prisma() { return mocks.prisma; } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: mocks.userId } })) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/ai', () => ({ getAIService: () => ({ generateVideoPlan: mocks.generate }) }));
vi.mock('@/lib/ai-quota', () => ({ consumeAiQuota: mocks.quota }));
vi.mock('@/lib/config', () => ({ getAppConfig: () => ({ aiProvider: 'openai' }), getActiveOpenAIConfig: () => ({ model: 'test' }) }));
import { POST, GET } from '@/app/api/error-items/[id]/video/route';
import { GET as MEDIA } from '@/app/api/error-items/[id]/video/media/route';
import { parseVideoPlan } from '@/lib/video-generation/plan';
import { pumpVideoJobs, jobDirectory } from '@/lib/video-generation/jobs';
const ctx = { params: Promise.resolve({ id: 'item' }) };
const request = () => new Request('http://localhost', { method: 'POST', body: '{}' });
const scene = { title: '计算', narration: '我们先看题目，四十减去十二，等于二十八。', equation: '40−12=28', lines: ['先减十，再减二'], visual: { kind: 'numberLine', from: 40, to: 28 } };
const plan = { supported: true, title: '减法', scenes: [scene, scene, scene] };
let directory: string, db: PrismaClient;
const oldJobs = process.env.VIDEO_JOB_DIR, oldMedia = process.env.VIDEO_LESSON_DIR;
beforeAll(() => {
 directory = mkdtempSync(join(tmpdir(), 'video-generation-')); process.env.VIDEO_JOB_DIR = join(directory, 'jobs'); process.env.VIDEO_LESSON_DIR = join(directory, 'media');
 const url = 'file:' + join(directory, 'qa.db'); writeFileSync(join(directory, 'qa.db'), '');
 execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
 db = new PrismaClient({ datasources: { db: { url } } }); mocks.prisma = db;
}, 120000);
beforeEach(async () => {
 await db.user.deleteMany(); mocks.userId = 'u'; mocks.generate.mockReset().mockResolvedValue(plan); mocks.quota.mockClear();
 await db.user.create({ data: { id: 'u', email: 'u@example.com', password: 'test' } });
 await db.user.create({ data: { id: 'other', email: 'other@example.com', password: 'test' } });
 await db.errorItem.create({ data: { id: 'item', userId: 'u', originalImageUrl: '', questionText: '40-12=?', answerText: '28', analysis: '先减10再减2' } });
});
afterAll(async () => { await db?.$disconnect(); if (oldJobs === undefined) delete process.env.VIDEO_JOB_DIR; else process.env.VIDEO_JOB_DIR = oldJobs; if (oldMedia === undefined) delete process.env.VIDEO_LESSON_DIR; else process.env.VIDEO_LESSON_DIR = oldMedia; rmSync(directory, { recursive: true, force: true }); });
describe('题目自动视频队列', () => {
 it('重复点击只编写一次分镜，完成后仅本人可分段读取视频', async () => {
  const first = await POST(request(), ctx); expect(first.status).toBe(202); const id = (await first.json()).job.id;
  await POST(request(), ctx);
  await vi.waitFor(async () => expect((await db.videoGeneration.findUniqueOrThrow({ where: { id } })).status).toBe('rendering'));
  expect(mocks.generate).toHaveBeenCalledTimes(1); expect(mocks.quota).toHaveBeenCalledTimes(1);
  const input = JSON.parse(readFileSync(join(jobDirectory(id), 'input.json'), 'utf8')); expect(input.scenes).toHaveLength(3); expect(input.scenes[0].spoken).toContain('等于二十八');
  const output = Buffer.alloc(128); output.write('ftyp', 4); const hash = createHash('sha256').update(output).digest('hex');
  writeFileSync(join(jobDirectory(id), 'output.mp4'), output); writeFileSync(join(jobDirectory(id), 'state.json'), JSON.stringify({ status: 'completed', attempt: input.attempt, sha256: hash }));
  const view = await (await GET(new Request('http://localhost'), ctx)).json(); expect(view.job.status).toBe('completed');
  const response = await MEDIA(new Request('http://localhost?job=' + id, { headers: { Range: 'bytes=4-7' } }), ctx); expect(response.status).toBe(206); expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('ftyp');
  mocks.userId = 'other'; expect((await GET(new Request('http://localhost'), ctx)).status).toBe(404); expect((await MEDIA(new Request('http://localhost?job=' + id), ctx)).status).toBe(404);
 });
 it('未补全解析和没有AI权限时禁止发起，服务不支持时返回原因', async () => {
  await db.user.update({ where: { id: 'u' }, data: { canUseAi: false } }); expect((await POST(request(), ctx)).status).toBe(403);
  await db.user.update({ where: { id: 'u' }, data: { canUseAi: true } }); await db.errorItem.update({ where: { id: 'item' }, data: { analysis: '' } }); expect((await POST(request(), ctx)).status).toBe(400);
  await db.errorItem.update({ where: { id: 'item' }, data: { analysis: '复杂几何' } }); mocks.generate.mockResolvedValue({ supported: false, reason: '该题需要复杂几何演示' });
  await POST(request(), ctx); await vi.waitFor(async () => expect((await db.videoGeneration.findFirstOrThrow()).status).toBe('unsupported'));
  expect((await db.videoGeneration.findFirstOrThrow()).error).toContain('几何');
 });
 it('渲染失败的显式重试复用分镜，旧尝试结果不能覆盖新任务', async () => {
  const id = (await (await POST(request(), ctx)).json()).job.id;
  await vi.waitFor(async () => expect((await db.videoGeneration.findUniqueOrThrow({ where: { id } })).status).toBe('rendering'));
  const old = await db.videoGeneration.findUniqueOrThrow({ where: { id } });
  writeFileSync(join(jobDirectory(id), 'state.json'), JSON.stringify({ status: 'failed', error: 'EDGE_TTS_FAILED', attempt: old.attempt }));
  expect((await (await GET(new Request('http://localhost'), ctx)).json()).job.status).toBe('failed');
  await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ retry: true }) }), ctx);
  await vi.waitFor(async () => expect((await db.videoGeneration.findUniqueOrThrow({ where: { id } })).status).toBe('rendering'));
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  writeFileSync(join(jobDirectory(id), 'state.json'), JSON.stringify({ status: 'failed', error: 'OLD_FAILURE', attempt: old.attempt }));
  await pumpVideoJobs(); expect((await db.videoGeneration.findUniqueOrThrow({ where: { id } })).status).toBe('rendering');
 });
 it('分镜数据不能携带脚本或越界图形数量', () => {
  expect(() => parseVideoPlan(JSON.stringify({ ...plan, title: '</script>' }))).toThrow();
  expect(() => parseVideoPlan(JSON.stringify({ ...plan, scenes: [{ ...scene, visual: { kind: 'counters', groups: [{ label: '鸡', count: 100, legs: 2 }] } }, scene, scene] }))).toThrow();
 });
});
