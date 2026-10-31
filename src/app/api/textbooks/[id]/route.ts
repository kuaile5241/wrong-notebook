import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { textbookAdmin, visibleBooks } from '@/lib/textbooks/access';
import { bookSchema } from '@/lib/textbooks/schema';
import { editBook, BookConflict } from '@/lib/textbooks/manage';
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const manage = new URL(req.url).searchParams.get('manage') === 'true' && user.role === 'admin';
        const book = await prisma.textbookBook.findFirst({ where: { id: (await ctx.params).id, ...visibleBooks(manage) },
            include: { units: { where: manage ? {} : { archived: false }, orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { terms: { where: manage ? {} : { archived: false }, orderBy: [{ position: 'asc' }, { id: 'asc' }] } } } } });
        if (!book) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        return NextResponse.json({ book, canManage: user.role === 'admin' }, noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const body = await req.json(), parsed = bookSchema.safeParse(body), revision = z.number().int().nonnegative().safeParse(body.revision);
        if (!parsed.success || !revision.success) return NextResponse.json({ message: 'Invalid book' }, { status: 400 });
        const id = (await ctx.params).id;
        if (parsed.data.published && !parsed.data.archived && !await prisma.textbookUnit.count({ where: { bookId: id, archived: false } })) return NextResponse.json({ message: 'Add a unit before publishing' }, { status: 400 });
        const book = await editBook(id, revision.data, tx => tx.textbookBook.update({ where: { id }, data: parsed.data }));
        return NextResponse.json(book, noStore);
    } catch (error) { if (error instanceof BookConflict) return NextResponse.json({ message: 'Book changed. Reload first.' }, { status: 409 }); return learningFailure(error); }
}
export async function DELETE(_req: Request, ctx: Context) {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const id = (await ctx.params).id;
        const deleted = await prisma.$transaction(async tx => {
            const book = await tx.textbookBook.findUnique({ where: { id }, include: { units: { include: { terms: { select: { id: true } } } } } });
            if (!book) return 'missing';
            const ids = book.units.flatMap(u => u.terms.map(t => 'tb-' + t.id));
            const used = await tx.vocabularyCard.count({ where: { wordId: { in: ids } } }) + await tx.vocabularyAttempt.count({ where: { wordId: { in: ids } } });
            if (!book.archived || used || book.seedKey) return 'protected';
            await tx.textbookBook.delete({ where: { id } }); return 'deleted';
        });
        if (deleted === 'missing') return NextResponse.json({ message: 'Not found' }, { status: 404 });
        if (deleted === 'protected') return NextResponse.json({ message: 'Keep archived books with learning records' }, { status: 409 });
        return NextResponse.json({ ok: true }, noStore);
    } catch (error) { return learningFailure(error); }
}
