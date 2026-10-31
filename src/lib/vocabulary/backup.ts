import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { vocabularyCatalog, settingsSchema } from './catalog';
import { serializedCardSchema } from './srs';
import { gradeAttempt } from './practice';

export const vocabularySettingsBackupSchema = z.string().max(1000).refine(raw => {
    try { const value = settingsSchema.parse(JSON.parse(raw)); return !value.topic || vocabularyCatalog().topics.some(t => t[0] === value.topic); } catch { return false; }
});
const count = z.number().int().min(0).max(1000000);
const cardSchema = z.object({ userId: z.string().max(100), wordId: z.string().max(100), state: z.string().max(5000),
    reviews: count, correct: count, wrong: count, selfReviews: count, favorite: z.boolean() });
const attemptSchema = z.object({ id: z.string().uuid(), userId: z.string().max(100), wordId: z.string().max(100),
    mode: z.enum(['meaning', 'listening', 'spelling', 'self']), choices: z.string().max(1000), cardRevision: count,
    answer: z.string().max(200), grade: z.number().int().min(1).max(4), createdAt: z.string().datetime(), completedAt: z.string().datetime() });

/** 只增补缺失记录，不覆盖已使用的新进度；普通导入只接收文件所属账号的词汇记录。 */
export async function restoreVocabulary(tx: Prisma.TransactionClient, rawCards: unknown, rawAttempts: unknown,
    owner: { userId: string; sourceUserId: string; all: boolean }) {
    const cards = z.array(z.unknown()).max(10000).parse(rawCards ?? []), attempts = z.array(z.unknown()).max(100000).parse(rawAttempts ?? []);
    const { byId } = vocabularyCatalog();
    let cardsCreated = 0, attemptsCreated = 0;
    for (const raw of cards) {
        const record = cardSchema.parse(raw);
        if (!byId.has(record.wordId) || (!owner.all && record.userId !== owner.sourceUserId)) continue;
        const userId = owner.all ? record.userId : owner.userId;
        const state = record.state ? serializedCardSchema.parse(JSON.parse(record.state)) : null;
        if (record.correct + record.wrong + record.selfReviews !== record.reviews || (state ? state.reps !== record.reviews : record.reviews !== 0)) throw new Error('Invalid vocabulary progress');
        if (await tx.vocabularyCard.findUnique({ where: { userId_wordId: { userId, wordId: record.wordId } } })) continue;
        await tx.vocabularyCard.create({ data: { ...record, userId, revision: record.reviews, state: state ? JSON.stringify(state) : '', dueAt: state ? new Date(state.due) : null } });
        cardsCreated++;
    }
    for (const raw of attempts) {
        const record = attemptSchema.parse(raw);
        if (!byId.has(record.wordId) || (!owner.all && record.userId !== owner.sourceUserId)) continue;
        const userId = owner.all ? record.userId : owner.userId;
        if (await tx.vocabularyAttempt.findUnique({ where: { id: record.id } })) continue;
        if (!await tx.vocabularyCard.findUnique({ where: { userId_wordId: { userId, wordId: record.wordId } } })) continue;
        const choices = z.array(z.string().max(100)).max(4).parse(JSON.parse(record.choices));
        if (choices.some(id => !byId.has(id))) throw new Error('Invalid vocabulary choices');
        const judged = gradeAttempt(record, { answer: record.answer, grade: record.grade });
        await tx.vocabularyAttempt.create({ data: { ...record, ...judged, userId, createdAt: new Date(record.createdAt), completedAt: new Date(record.completedAt) } });
        attemptsCreated++;
    }
    return { vocabularyCardsCreated: cardsCreated, vocabularyAttemptsCreated: attemptsCreated };
}
