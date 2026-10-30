import type { Prisma } from '@prisma/client';
import { generateUniqueShortId } from '@/lib/short-id';
import { SUBJECT_NAMES, topicStage, topicSubject, volumeLabel } from './catalog';
import type { AnswerHistory, Topic } from './types';

/** 只为答错的公共题创建私有错题；已归档题再次练对时保留一次新的作答。 */
export async function archiveLearningMistake(tx: Prisma.TransactionClient, userId: string, topic: Topic, h: AnswerHistory) {
    const key = topicSubject(topic), stage = topicStage(topic), source = `cn-math-taxonomy:${h.question.id}`;
    const existing = await tx.errorItem.findFirst({ where: { userId, source } });
    if (h.verdict === 'correct') {
        if (!existing) return undefined;
        await tx.practiceRecord.create({ data: { userId, errorItemId: existing.id, subject: SUBJECT_NAMES[key],
            questionText: h.question.prompt, answerText: h.question.answer, analysis: h.question.explanation,
            wrongAnswerText: h.answer, isCorrect: true, result: 'correct', source: 'learning' } });
        return existing.id;
    }
    const subject = await tx.subject.findFirst({ where: { userId, subjectKey: key, stage } })
        ?? await tx.subject.upsert({ where: { name_userId: { name: `${SUBJECT_NAMES[key]} · ${stage === 'primary' ? '小学' : stage === 'junior_high' ? '初中' : '高中'}`, userId } },
            create: { name: `${SUBJECT_NAMES[key]} · ${stage === 'primary' ? '小学' : stage === 'junior_high' ? '初中' : '高中'}`, userId, stage, subjectKey: key }, update: {} });
    const tagName = `${topic.name} · ${volumeLabel(topic)}`;
    const tag = await tx.knowledgeTag.findFirst({ where: { name: tagName, userId, subject: key, code: topic.id } })
        ?? await tx.knowledgeTag.create({ data: { name: tagName, subject: key, userId, code: topic.id } });
    const q = h.question;
    const questionText = [q.prompt, ...(q.choices ?? []).map(c => `${c.key}. ${c.text}`)].join('\n\n');
    const data = { subjectId: subject.id, questionText, answerText: q.answer, analysis: q.explanation,
        wrongAnswerText: h.answer || null, mistakeStatus: 'wrong_attempt', gradeSemester: volumeLabel(topic),
        hasFigure: !!q.figure, figureSvg: q.figure ?? null, masteryLevel: 0, masteryProbability: null,
        masterySource: 'rule', masteryReason: null, masteryEvaluatedAt: new Date(),
        knowledgePoints: JSON.stringify([topic.name]), tags: { connect: { id: tag.id } } };
    const item = existing ? await tx.errorItem.update({ where: { id: existing.id }, data })
        : await tx.errorItem.create({ data: { ...data, userId, source, originalImageUrl: '', shortId: await generateUniqueShortId(tx) } });
    await tx.practiceRecord.create({ data: { userId, errorItemId: item.id, subject: SUBJECT_NAMES[key],
        questionText, answerText: q.answer, analysis: q.explanation, wrongAnswerText: h.answer,
        figureSvg: q.figure, isCorrect: false, result: h.verdict === 'skip' ? 'not_attempted' : 'wrong', source: 'learning' } });
    if (!existing) await tx.reviewSchedule.create({ data: { errorItemId: item.id, scheduledFor: new Date(Date.now() + 86400000) } });
    return item.id;
}
