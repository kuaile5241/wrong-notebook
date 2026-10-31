import { NextResponse } from 'next/server';
import { z } from 'zod';
import { textbookAdmin } from '@/lib/textbooks/access';
import { unitSchema } from '@/lib/textbooks/schema';
import { editBook, BookConflict } from '@/lib/textbooks/manage';
import { learningFailure, noStore } from '@/lib/learning/auth';
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const body = await req.json(), parsed = unitSchema.safeParse(body), revision = z.number().int().nonnegative().safeParse(body.revision);
        if (!parsed.success || !revision.success) return NextResponse.json({ message: 'Invalid unit' }, { status: 400 });
        const bookId = (await ctx.params).id, { id, ...data } = parsed.data;
        const unit = await editBook(bookId, revision.data, async tx => {
            if (id) { const row = await tx.textbookUnit.findFirst({ where: { id, bookId } }); if (!row) throw new BookConflict(); return tx.textbookUnit.update({ where: { id }, data }); }
            return tx.textbookUnit.create({ data: { ...data, bookId } });
        });
        return NextResponse.json(unit, noStore);
    } catch (error) { if (error instanceof BookConflict || (typeof error === 'object' && error && 'code' in error && error.code === 'P2002')) return NextResponse.json({ message: 'Unit changed or code exists' }, { status: 409 }); return learningFailure(error); }
}
