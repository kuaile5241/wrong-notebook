import { readProfileSettings } from './profiles';
import type { Prisma } from '@prisma/client';
import { generateUniqueShortId } from '@/lib/short-id';
import { DATASET_REVISION, LEGACY_DATASET_REVISION, getCatalog, sameQuestion, SUBJECT_NAMES, topicStage, topicSubject, volumeLabel } from './catalog';
import type { AnswerHistory, Topic } from './types';

/** 只为答错的公共题创建私有错题；已归档题再次练对时保留一次新的作答。 */
export async function archiveLearningMistake(tx: Prisma.TransactionClient, userId: string, topic: Topic, h: AnswerHistory, profileId = '', datasetVersion = DATASET_REVISION) {
    const legacyQuestion = getCatalog(LEGACY_DATASET_REVISION).questionsById.get(h.question.id);
    const changed = legacyQuestion && !sameQuestion(h.question, legacyQuestion);
    const key = topicSubject(topic), stage = topicStage(topic), source = `cn-math-taxonomy:${profileId ? profileId + ':' : ''}${h.question.id}${changed ? ':' + datasetVersion.slice(0, 7) : ''}`;
    const existing = await tx.errorItem.findFirst({ where: { userId, source } });
    if (h.verdict === 'correct') {
        if (!existing) return undefined;
        await tx.practiceRecord.create({ data: { userId, errorItemId: existing.id, subject: SUBJECT_NAMES[key],
            questionText: h.question.prompt, answerText: h.question.answer, analysis: h.question.explanation,
            wrongAnswerText: h.answer, isCorrect: true, result: 'correct', source: 'learning' } });
        return existing.id;
    }
    const account = profileId ? await tx.user.findUnique({ where: { id: userId }, select: { learningSettings: true } }) : null;
    const profile = account ? readProfileSettings(account.learningSettings).profiles.find(p => p.id === profileId) : null;
    const prefix = profile ? profile.name + ' · ' : '';
    const subject = await tx.subject.findFirst({ where: { userId, subjectKey: key, stage, ...(profileId ? { name: `${prefix}${SUBJECT_NAMES[key]} · ${stage === 'primary' ? '小学' : stage === 'junior_high' ? '初中' : '高中'}` } : {}) } })
        ?? await tx.subject.upsert({ where: { name_userId: { name: `${prefix}${SUBJECT_NAMES[key]} · ${stage === 'primary' ? '小学' : stage === 'junior_high' ? '初中' : '高中'}`, userId } },
            create: { name: `${prefix}${SUBJECT_NAMES[key]} · ${stage === 'primary' ? '小学' : stage === 'junior_high' ? '初中' : '高中'}`, userId, stage, subjectKey: key }, update: {} });
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
