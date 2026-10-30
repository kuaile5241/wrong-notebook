// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    prisma: undefined as PrismaClient | undefined,
    scheduleMasteryEvaluation: vi.fn(),
    session: { user: { id: 'user-1', email: 'backup-test@example.com', role: 'user' }, expires: '2099-01-01' },
}));

vi.mock('@/lib/prisma', () => ({ get prisma() { return mocks.prisma; } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => mocks.session) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/mastery', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/mastery')>()),
    scheduleMasteryEvaluation: mocks.scheduleMasteryEvaluation,
}));

import { GET as EXPORT } from '@/app/api/export/route';
import { POST as IMPORT } from '@/app/api/import/route';
import { sanitizeFigureSvg } from '@/lib/figure-svg';
import { sanitizeSvgAnimation } from '@/lib/svg-animation';
import { createLearningState, nextLearningQuestion, applyLearningAnswer, parseLearning } from '@/lib/learning/session';
import { DATASET_REVISION } from '@/lib/learning/catalog';

let database: PrismaClient;
let directory: string;
const figure = sanitizeFigureSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')!;
const animation = (text: string) => sanitizeSvgAnimation(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5">${text}<animate attributeName="opacity" from="0" to="1" dur="1s"/></text></svg>`)!;
const lastPractice = JSON.stringify({ questionText: '新题', answerText: '答案', analysis: '解析', figureSvg: figure, difficulty: 'medium', generatedAt: '2026-10-20T00:00:00.000Z' });

async function exportBackup() {
    const response = await EXPORT(new Request('http://localhost/api/export'));
    expect(response.status).toBe(200);
    return response.json();
}

async function importBackup(body: object) {
    const response = await IMPORT(new Request('http://localhost/api/import', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    }));
    expect(response.status).toBe(200);
    return response.json();
}

/** 清空当前用户的学习数据（保留账户），模拟换机后导入 */
async function clearUserData() {
    await database.learningSession.deleteMany({ where: { userId: 'user-1' } });
    await database.examPaper.deleteMany({ where: { userId: 'user-1' } });
    await database.subject.deleteMany({ where: { userId: 'user-1' } });
    await database.knowledgeTag.deleteMany({ where: { userId: 'user-1' } });
    await database.practiceRecord.deleteMany({ where: { userId: 'user-1' } });
}

beforeAll(() => {
    // 所有真实读写和迁移均使用系统临时数据库，不接触开发或生产数据。
    directory = mkdtempSync(join(tmpdir(), 'wrong-notebook-backup-test-'));
    const url = `file:${join(directory, 'test.db')}`;
    // Prisma 5 在本机 Windows 上不能自动创建不存在的 SQLite 文件。
    writeFileSync(join(directory, 'test.db'), '');
    execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
    });
    database = new PrismaClient({ datasources: { db: { url } } });
    mocks.prisma = database;
// 迁移通过子进程执行 Prisma CLI，CI 中与其他测试文件并行时较慢，留足时间
}, 120000);

beforeEach(async () => {
    mocks.scheduleMasteryEvaluation.mockClear();
    await database.user.deleteMany();
    await database.user.create({ data: { id: 'user-1', email: mocks.session.user.email, password: 'test-only' } });
    await database.subject.create({ data: { id: 'math', name: '数学', stage: 'junior_high', subjectKey: 'math', userId: 'user-1' } });
    await database.knowledgeTag.create({ data: { id: 'tag-1', name: '自定义标签', subject: 'math', userId: 'user-1' } });
    await database.errorItem.create({
        data: {
            id: 'item-1', shortId: 'AbC234', userId: 'user-1', subjectId: 'math', originalImageUrl: 'data:image/png;base64,dGVzdA==',
            questionText: '求解 x + 2 = 5', answerText: 'x = 3', analysis: '移项', wrongAnswerText: 'x = 7', mistakeAnalysis: '符号错误',
            mistakeStatus: 'wrong_attempt', source: '期中考试', errorType: '计算', userNotes: '注意符号', gradeSemester: '初二上',
            paperLevel: 'b', difficultyStars: 3, hasFigure: true, figureSvg: figure,
            geogebraCommands: 'A=(0,0)\nB=(1,1)', svgAnimation: animation('中文'), svgAnimationEn: animation('English'), lastPractice,
            masteryLevel: 2, masteryProbability: 0.8, masteryReason: '连续答对', masterySource: 'ai', masteryEvaluatedAt: new Date('2026-10-21T00:00:00Z'),
            createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-21T00:00:00Z'),
            tags: { connect: [{ id: 'tag-1' }] },
        },
    });
    await database.reviewSchedule.create({ data: { errorItemId: 'item-1', scheduledFor: new Date('2026-11-01T00:00:00Z') } });
    await database.practiceRecord.create({
        data: {
            userId: 'user-1', errorItemId: 'item-1', subject: 'math', difficulty: 'medium', isCorrect: true, result: 'correct',
            questionText: '变式题', answerText: 'x = 4', analysis: '同理', figureSvg: figure, source: 'practice',
            createdAt: new Date('2026-10-20T00:00:00Z'),
        },
    });
});

afterAll(async () => {
    await database?.$disconnect();
    if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('数据导出后再导入（真实 SQLite）', () => {
    it('在线学习会话可备份恢复并重建答案与错题关联', async () => {
        const state = createLearningState(['cnm_p001'], 'practice', 3), q = nextLearningQuestion(state)!;
        const answer = applyLearningAnswer(state, q, { revision: 0, questionId: q.id, requestId: '12345678-1234-4234-8234-123456789012', answer: '', skip: true });
        if ('manual' in answer) throw new Error('Unexpected manual');
        answer.history.errorItemId = 'item-1';
        await database.learningSession.create({ data: { id: 'learning-backup', userId: 'user-1', title: '练习存档', mode: 'practice', datasetVersion: DATASET_REVISION, state: JSON.stringify(answer.state) } });
        const backup = await exportBackup(); expect(backup.learningSessions).toHaveLength(1);
        const tampered = parseLearning(backup.learningSessions[0].state); tampered.history[0].question.answer = '伪造答案';
        backup.learningSessions[0].state = JSON.stringify(tampered);
        await clearUserData(); const result = await importBackup(backup); expect(result.stats.learningSessionsCreated).toBe(1);
        const restored = parseLearning((await database.learningSession.findUniqueOrThrow({ where: { id: 'learning-backup' } })).state);
        expect(restored.history[0].question.answer).toBe(q.answer);
        expect(await database.errorItem.findUnique({ where: { id: restored.history[0].errorItemId } })).not.toBeNull();
        await importBackup(backup); expect(await database.learningSession.count()).toBe(1);
    });
    it('访问权限元数据可备份，但导入不能自行续期或提升权限', async () => {
        const expiry = new Date('2030-01-01T00:00:00Z');
        await database.user.update({ where: { id: 'user-1' }, data: { accessExpiresAt: expiry, canUseAi: false, canImportExport: false } });
        const backup = await exportBackup();
        expect(backup.user.accessControl).toEqual({ isActive: true, accessExpiresAt: expiry.toISOString(), canUseAi: false, canImportExport: false });
        backup.user.role = 'admin'; backup.user.accessControl = { isActive: true, accessExpiresAt: null, canUseAi: true, canImportExport: true };
        await importBackup(backup);
        const found = await database.user.findUniqueOrThrow({ where: { id: 'user-1' } });
        expect(found.role).toBe('user'); expect(found.accessExpiresAt).toEqual(expiry); expect(found.canUseAi).toBe(false); expect(found.canImportExport).toBe(false);
    });

    it('导出文件使用第 2 版格式', async () => {
        expect((await exportBackup()).version).toBe(2);
    });

    it('错题与举一反三记录的全部字段完整保留', async () => {
        const backup = await exportBackup();
        await clearUserData();
        const { stats } = await importBackup(backup);
        expect(stats).toMatchObject({ errorItemsCreated: 1, practiceRecordsCreated: 1, reviewSchedulesCreated: 1, tagsLinked: 1 });

        const item = await database.errorItem.findFirstOrThrow({ where: { userId: 'user-1' }, include: { tags: true, subject: true } });
        expect(item).toMatchObject({
            shortId: 'AbC234', questionText: '求解 x + 2 = 5', difficultyStars: 3, hasFigure: true, figureSvg: figure,
            geogebraCommands: 'A=(0,0)\nB=(1,1)', svgAnimation: animation('中文'), svgAnimationEn: animation('English'), lastPractice,
            masteryProbability: 0.8, masteryReason: '连续答对', masterySource: 'ai', masteryEvaluatedAt: new Date('2026-10-21T00:00:00Z'),
            createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-21T00:00:00Z'),
        });
        expect(item.subject).toMatchObject({ name: '数学', stage: 'junior_high', subjectKey: 'math' });
        expect(item.tags.map((tag) => tag.name)).toEqual(['自定义标签']);

        const record = await database.practiceRecord.findFirstOrThrow({ where: { errorItemId: item.id } });
        expect(record).toMatchObject({ result: 'correct', questionText: '变式题', figureSvg: figure, source: 'practice' });
        // 已带掌握概率导入，不重复评估
        expect(mocks.scheduleMasteryEvaluation).not.toHaveBeenCalled();
    });

    it('没有掌握概率的题目导入后重新评估', async () => {
        await database.errorItem.update({ where: { id: 'item-1' }, data: { masteryProbability: null, masteryEvaluatedAt: null } });
        const backup = await exportBackup();
        await clearUserData();
        await importBackup(backup);
        const item = await database.errorItem.findFirstOrThrow({ where: { userId: 'user-1' } });
        expect(item.masteryProbability).toBeNull();
        expect(mocks.scheduleMasteryEvaluation).toHaveBeenCalledWith([item.id]);
    });

    it('试卷、试卷题目及其作答记录完整保留，重复导入不新建试卷', async () => {
        await database.examPaper.create({
            data: {
                id: 'paper-1', userId: 'user-1', title: '周测', status: 'generating', scope: 'unmastered', difficulty: 'hard', requestedCount: 2,
                subjectIds: JSON.stringify(['math']), tagNames: JSON.stringify(['自定义标签']), resultsRecordedAt: new Date('2026-10-22T00:00:00Z'),
                createdAt: new Date('2026-10-21T00:00:00Z'),
                questions: { create: [
                    { id: 'question-1', order: 0, errorItemId: 'item-1', sourceShortId: 'AbC234', status: 'ready', questionText: '试卷新题', answerText: '答', analysis: '析', figureSvg: figure },
                    { id: 'question-2', order: 1, errorItemId: 'item-1', sourceShortId: 'AbC234', status: 'pending' },
                ] },
            },
        });
        await database.practiceRecord.create({
            data: { userId: 'user-1', errorItemId: 'item-1', examQuestionId: 'question-1', result: 'wrong', isCorrect: false, source: 'exam', questionText: '试卷新题' },
        });
        const backup = await exportBackup();
        await clearUserData();
        const { stats } = await importBackup(backup);
        expect(stats.examPapersCreated).toBe(1);

        const item = await database.errorItem.findFirstOrThrow({ where: { userId: 'user-1' } });
        const subject = await database.subject.findFirstOrThrow({ where: { userId: 'user-1' } });
        const paper = await database.examPaper.findFirstOrThrow({ where: { userId: 'user-1' }, include: { questions: { orderBy: { order: 'asc' } } } });
        expect(paper).toMatchObject({
            title: '周测', status: 'partial', scope: 'unmastered', difficulty: 'hard', requestedCount: 2,
            subjectIds: JSON.stringify([subject.id]), tagNames: JSON.stringify(['自定义标签']),
            resultsRecordedAt: new Date('2026-10-22T00:00:00Z'), createdAt: new Date('2026-10-21T00:00:00Z'),
        });
        expect(paper.questions).toMatchObject([
            { order: 0, errorItemId: item.id, sourceShortId: 'AbC234', status: 'ready', questionText: '试卷新题', figureSvg: figure },
            // 导出时仍在生成的题目按失败导入
            { order: 1, errorItemId: item.id, status: 'failed' },
        ]);
        expect(await database.practiceRecord.findFirstOrThrow({ where: { source: 'exam' } })).toMatchObject({ examQuestionId: paper.questions[0].id, errorItemId: item.id });

        // 再导入一次：试卷不重复，作答记录关联到已有的试卷题目
        const again = await importBackup(backup);
        expect(again.stats.examPapersCreated).toBe(0);
        expect(await database.examPaper.count({ where: { userId: 'user-1' } })).toBe(1);
        const examRecords = await database.practiceRecord.findMany({ where: { source: 'exam' } });
        expect(examRecords.map((record) => record.examQuestionId)).toEqual([paper.questions[0].id, paper.questions[0].id]);
    });

    it('还原本人的偏好设置，不合法的单项跳过', async () => {
        await database.user.update({
            where: { id: 'user-1' },
            data: { confirmBeforeImport: true, questionDuplicateThreshold: 75.5, masteryThreshold: 70, enableGeogebra: true, enableSvgAnimation: false },
        });
        const backup = await exportBackup();
        expect(backup.user).toMatchObject({ confirmBeforeImport: true, questionDuplicateThreshold: 75.5, masteryThreshold: 70, enableGeogebra: true, enableSvgAnimation: false });

        await database.user.update({
            where: { id: 'user-1' },
            data: { confirmBeforeImport: false, questionDuplicateThreshold: 90, masteryThreshold: 50, enableGeogebra: false, enableSvgAnimation: true },
        });
        backup.user.questionDuplicateThreshold = 500;
        const { stats } = await importBackup(backup);
        expect(stats.preferencesRestored).toBe(true);
        expect(await database.user.findUniqueOrThrow({ where: { id: 'user-1' } })).toMatchObject({
            confirmBeforeImport: true, questionDuplicateThreshold: 90, masteryThreshold: 70, enableGeogebra: true, enableSvgAnimation: false,
        });
    });

    it('旧版文件没有偏好设置时不改动当前设置', async () => {
        await database.user.update({ where: { id: 'user-1' }, data: { enableGeogebra: true } });
        const { stats } = await importBackup({ version: 1, user: { email: mocks.session.user.email }, errorItems: [] });
        expect(stats.preferencesRestored).toBe(false);
        expect((await database.user.findUniqueOrThrow({ where: { id: 'user-1' } })).enableGeogebra).toBe(true);
    });

    it('导入时重新净化 SVG，丢弃不合法的暂存练习和掌握概率', async () => {
        const backup = await exportBackup();
        await clearUserData();
        Object.assign(backup.errorItems[0], {
            svgAnimation: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>',
            svgAnimationEn: 'not svg',
            lastPractice: '{"questionText":""}',
            masteryProbability: 3,
        });
        await importBackup(backup);
        const item = await database.errorItem.findFirstOrThrow({ where: { userId: 'user-1' } });
        expect(item.svgAnimation).not.toContain('script');
        expect(item.svgAnimationEn).toBeNull();
        expect(item.lastPractice).toBeNull();
        expect(item.masteryProbability).toBeNull();
        expect(mocks.scheduleMasteryEvaluation).toHaveBeenCalledWith([item.id]);
    });
});
