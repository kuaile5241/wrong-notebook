import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { COMPATIBLE_DATASET_REVISIONS, getCatalog } from '@/lib/learning/catalog';
import { applyLearningAnswer, learningView, nextLearningQuestion, parseLearning } from '@/lib/learning/session';
import { replayLearning } from '@/lib/learning/replay';
import { archiveLearningMistake } from '@/lib/learning/archive';
const schema = z.object({ action: z.enum(['undo', 'extend', 'correct']), revision: z.number().int().nonnegative(), index: z.number().int().nonnegative().optional(), answer: z.string().max(5000).default(''), skip: z.boolean().default(false), selfResult: z.enum(['correct', 'wrong', 'skip']).optional() });
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
        const body = parsed.data, row = await prisma.learningSession.findFirst({ where: { id: (await ctx.params).id, userId: user.id } }); if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        if (row.revision !== body.revision || !COMPATIBLE_DATASET_REVISIONS.includes(row.datasetVersion)) return NextResponse.json({ message: 'Session changed' }, { status: 409 });
        const old = parseLearning(row.state); let state = old, corrected: ReturnType<typeof applyLearningAnswer> | undefined;
        if (body.action === 'extend') { if (!old.engine || old.engine.limit >= 60) return NextResponse.json({ message: 'Limit reached' }, { status: 400 }); state = replayLearning(old, old.history, Math.min(60, old.engine.limit + 10)); }
        else if (body.action === 'undo') { if (!old.history.length) return NextResponse.json({ message: 'No answer to undo' }, { status: 400 }); state = replayLearning(old, old.history.slice(0, -1)); }
        else {
            if (body.index === undefined || body.index >= old.history.length) return NextResponse.json({ message: 'Invalid index' }, { status: 400 });
            state = replayLearning(old, old.history.slice(0, body.index)); const q = nextLearningQuestion(state)!;
            corrected = applyLearningAnswer(state, q, { ...body, requestId: randomUUID(), questionId: q.id });
            if ('manual' in corrected) return NextResponse.json({ message: 'Self assessment required' }, { status: 400 }); state = corrected.state;
        }
        const result = await prisma.$transaction(async tx => {
            const locked = await tx.learningSession.updateMany({ where: { id: row.id, userId: user.id, revision: body.revision }, data: { revision: { increment: 1 } } }); if (!locked.count) return null;
            if (corrected && !('manual' in corrected)) corrected.history.errorItemId = await archiveLearningMistake(tx, user.id, getCatalog().byId.get(corrected.history.question.topicId)!, corrected.history, row.profileId);
            return tx.learningSession.update({ where: { id: row.id }, data: { state: JSON.stringify(state), status: nextLearningQuestion(state) ? 'active' : 'completed' } });
        });
        return result ? NextResponse.json(learningView(result), noStore) : NextResponse.json({ message: 'Session changed' }, { status: 409 });
    } catch (e) { return learningFailure(e); }
}
