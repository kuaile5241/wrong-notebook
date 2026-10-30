import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCatalog, DATASET_REVISION } from '@/lib/learning/catalog';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { answerLearningSchema, applyLearningAnswer, learningView, nextLearningQuestion, parseLearning } from '@/lib/learning/session';
import { archiveLearningMistake } from '@/lib/learning/archive';

type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const row = await prisma.learningSession.findFirst({ where: { id: (await ctx.params).id, userId: user.id } });
        if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        return NextResponse.json(learningView(row), noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = answerLearningSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ message: 'Invalid answer' }, { status: 400 });
        const input = parsed.data;
        const row = await prisma.learningSession.findFirst({ where: { id: (await ctx.params).id, userId: user.id } });
        if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        if (row.datasetVersion !== DATASET_REVISION) return NextResponse.json({ message: 'Dataset version mismatch' }, { status: 409 });
        const state = parseLearning(row.state);
        if (state.history.some(h => h.requestId === input.requestId)) return NextResponse.json(learningView(row), noStore);
        const q = nextLearningQuestion(state);
        if (row.revision !== input.revision || !q || q.id !== input.questionId)
            return NextResponse.json({ message: 'Session changed, reload', view: learningView(row) }, { status: 409, ...noStore });
        const applied = applyLearningAnswer(state, q, input);
        if ('manual' in applied) return NextResponse.json({ manual: true, reference: { answer: q.answer, explanation: q.explanation } }, noStore);
        const updated = await prisma.$transaction(async tx => {
            // 乐观锁先占位，避免双击、重试和多个页面同时提交重复归档。
            const locked = await tx.learningSession.updateMany({ where: { id: row.id, userId: user.id, revision: input.revision }, data: { revision: { increment: 1 } } });
            if (locked.count !== 1) return null;
            applied.history.errorItemId = await archiveLearningMistake(tx, user.id, getCatalog().byId.get(q.topicId)!, applied.history);
            return tx.learningSession.update({ where: { id: row.id }, data: { state: JSON.stringify(applied.state),
                status: nextLearningQuestion(applied.state) ? 'active' : 'completed' } });
        });
        if (!updated) return NextResponse.json({ message: 'Session changed, reload' }, { status: 409 });
        return NextResponse.json(learningView(updated), noStore);
    } catch (error) { return learningFailure(error); }
}
