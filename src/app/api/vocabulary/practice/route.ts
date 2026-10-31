import { loadVocabularyDictionary, termEntry } from '@/lib/textbooks/dictionary';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { readSettings } from '@/lib/vocabulary/catalog';
import { attemptView, makeChoices, practiceSchema } from '@/lib/vocabulary/practice';
import { nextWordId } from '@/lib/vocabulary/service';
export async function POST(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = practiceSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ message: 'Invalid practice' }, { status: 400 });
        const { mode } = parsed.data, account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { vocabularySettings: true } });
        const settings = { ...readSettings(account.vocabularySettings), ...parsed.data.scope };
        const wordId = parsed.data.wordId || await nextWordId(user.id, settings), dictionary = await loadVocabularyDictionary(user.id);
        if (!wordId || !dictionary.byId.has(wordId)) return NextResponse.json({ message: 'No matching word' }, { status: 404 });
        const pending = await prisma.vocabularyAttempt.count({ where: { userId: user.id, completedAt: null, createdAt: { gte: new Date(Date.now() - 86400000) } } });
        if (pending >= 100) return NextResponse.json({ message: 'Too many unfinished questions' }, { status: 429 });
        const result = await prisma.$transaction(async tx => {
        const term = wordId.startsWith('tb-') ? await tx.textbookTerm.findUnique({ where: { id: wordId.slice(3) }, include: { unit: { include: { book: true } } } }) : null;
        if (wordId.startsWith('tb-') && (!term || term.archived || term.unit.archived || !term.unit.book.published || term.unit.book.archived)) return null;
        if (term) dictionary.byId.set(wordId, termEntry(term));
        const scope = term ? { bookId: term.unit.bookId, unitId: settings.unitId === term.unitId ? term.unitId : '', revision: term.unit.book.revision } : { bookId: '', unitId: '' };
        const card = await tx.vocabularyCard.upsert({ where: { userId_wordId: { userId: user.id, wordId } }, create: { userId: user.id, wordId }, update: {} });
        const attempt = await tx.vocabularyAttempt.create({ data: { userId: user.id, wordId, mode, cardRevision: card.revision, choices: JSON.stringify(makeChoices(wordId, mode, dictionary)), scope: JSON.stringify(scope) } });
        return attemptView(attempt, card, false, dictionary);
        });
        return result ? NextResponse.json(result, { status: 201, ...noStore }) : NextResponse.json({ message: 'Book unavailable' }, { status: 404 });
    } catch (error) { return learningFailure(error); }
}
