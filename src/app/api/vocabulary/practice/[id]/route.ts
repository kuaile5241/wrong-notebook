import { loadVocabularyDictionary } from '@/lib/textbooks/dictionary';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { answerSchema, attemptView, gradeAttempt, readPracticeScope } from '@/lib/vocabulary/practice';
import { scheduleWord } from '@/lib/vocabulary/srs';
import { vocabularyWrite } from '@/lib/vocabulary/write-lock';
type Context = { params: Promise<{ id: string }> };
class StalePractice extends Error {}
export async function GET(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const attempt = await prisma.vocabularyAttempt.findFirst({ where: { id: (await ctx.params).id, userId: user.id } });
        if (!attempt) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        const dictionary = await loadVocabularyDictionary(user.id);
        if (!dictionary.byId.has(attempt.wordId)) return NextResponse.json({ message: 'Content unavailable' }, { status: 404 });
        const card = await prisma.vocabularyCard.findUniqueOrThrow({ where: { userId_wordId: { userId: user.id, wordId: attempt.wordId } } });
        return NextResponse.json(attemptView(attempt, card, new URL(req.url).searchParams.get('reveal') === 'true', dictionary), noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const input = answerSchema.safeParse(await req.json()); if (!input.success) return NextResponse.json({ message: 'Invalid answer' }, { status: 400 });
        const id = (await ctx.params).id;
        const result = await vocabularyWrite(user.id, () => prisma.$transaction(async tx => {
            const attempt = await tx.vocabularyAttempt.findFirst({ where: { id, userId: user.id } });
            if (!attempt) return null;
            const dictionary = await loadVocabularyDictionary(user.id, tx);
            if (!dictionary.byId.has(attempt.wordId)) throw new StalePractice();
            const scope = readPracticeScope(attempt.scope);
            const where = { userId_wordId: { userId: user.id, wordId: attempt.wordId } };
            const card = await tx.vocabularyCard.findUniqueOrThrow({ where });
            if (attempt.completedAt) return attemptView(attempt, card, false, dictionary);
            if (scope.bookId && (await tx.textbookBook.findUnique({ where: { id: scope.bookId } }))?.revision !== scope.revision) throw new StalePractice();
            if (attempt.cardRevision !== card.revision || attempt.createdAt.getTime() < Date.now() - 86400000) throw new StalePractice();
            const judged = gradeAttempt(attempt, input.data, dictionary), now = new Date(), next = scheduleWord(card.state, judged.grade, now);
            const locked = await tx.vocabularyCard.updateMany({ where: { id: card.id, userId: user.id, revision: attempt.cardRevision }, data: { ...next,
                revision: { increment: 1 }, reviews: { increment: 1 }, correct: { increment: judged.correct === true ? 1 : 0 },
                wrong: { increment: judged.correct === false ? 1 : 0 }, selfReviews: { increment: judged.correct === null ? 1 : 0 } } });
            if (locked.count !== 1) throw new StalePractice();
            const answered = await tx.vocabularyAttempt.update({ where: { id }, data: { ...judged, answer: input.data.answer, completedAt: now } });
            return attemptView(answered, await tx.vocabularyCard.findUniqueOrThrow({ where }), false, dictionary);
        }));
        return result ? NextResponse.json(result, noStore) : NextResponse.json({ message: 'Not found' }, { status: 404 });
    } catch (error) {
        if (error instanceof StalePractice) return NextResponse.json({ message: 'This question changed or expired. Start a new question.', code: 'STALE_PRACTICE' }, { status: 409 });
        if (error instanceof Error && ['GRADE_REQUIRED', 'CHOICE_REQUIRED'].includes(error.message)) return NextResponse.json({ message: 'Choose an answer' }, { status: 400 });
        return learningFailure(error);
    }
}
