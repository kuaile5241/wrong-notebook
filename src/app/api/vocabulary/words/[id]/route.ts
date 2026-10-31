import { loadVocabularyDictionary } from '@/lib/textbooks/dictionary';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { wordDetails } from '@/lib/vocabulary/catalog';
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const dictionary = await loadVocabularyDictionary(user.id);
        const word = dictionary.byId.get((await ctx.params).id);
        if (!word) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        const card = await prisma.vocabularyCard.findUnique({ where: { userId_wordId: { userId: user.id, wordId: word.id } } });
        return NextResponse.json({ word: wordDetails(word), progress: card ? { favorite: card.favorite, reviews: card.reviews, correct: card.correct, wrong: card.wrong, selfReviews: card.selfReviews, dueAt: card.dueAt } : null }, noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const wordId = (await ctx.params).id, input = z.object({ favorite: z.boolean() }).safeParse(await req.json());
        const dictionary = await loadVocabularyDictionary(user.id);
        if (!input.success || !dictionary.byId.has(wordId)) return NextResponse.json({ message: 'Invalid word' }, { status: 400 });
        const card = await prisma.vocabularyCard.upsert({ where: { userId_wordId: { userId: user.id, wordId } }, create: { userId: user.id, wordId, favorite: input.data.favorite }, update: { favorite: input.data.favorite } });
        return NextResponse.json({ favorite: card.favorite }, noStore);
    } catch (error) { return learningFailure(error); }
}
