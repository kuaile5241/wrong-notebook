import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { vocabularyCatalog } from '@/lib/vocabulary/catalog';
import { attemptView, makeChoices, practiceSchema } from '@/lib/vocabulary/practice';
import { nextWordId } from '@/lib/vocabulary/service';
export async function POST(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = practiceSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ message: 'Invalid practice' }, { status: 400 });
        const { mode } = parsed.data, wordId = parsed.data.wordId || await nextWordId(user.id);
        if (!wordId || !vocabularyCatalog().byId.has(wordId)) return NextResponse.json({ message: 'No matching word' }, { status: 404 });
        const pending = await prisma.vocabularyAttempt.count({ where: { userId: user.id, completedAt: null, createdAt: { gte: new Date(Date.now() - 86400000) } } });
        if (pending >= 100) return NextResponse.json({ message: 'Too many unfinished questions' }, { status: 429 });
        const card = await prisma.vocabularyCard.upsert({ where: { userId_wordId: { userId: user.id, wordId } }, create: { userId: user.id, wordId }, update: {} });
        const attempt = await prisma.vocabularyAttempt.create({ data: { userId: user.id, wordId, mode, cardRevision: card.revision, choices: JSON.stringify(makeChoices(wordId, mode)) } });
        return NextResponse.json(attemptView(attempt, card), { status: 201, ...noStore });
    } catch (error) { return learningFailure(error); }
}
