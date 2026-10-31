import { NextResponse } from 'next/server';
import { z } from 'zod';
import { textbookAdmin } from '@/lib/textbooks/access';
import { termSchema, termKey } from '@/lib/textbooks/schema';
import { autoAtlasId, validAtlasLink } from '@/lib/textbooks/dictionary';
import { editBook, BookConflict } from '@/lib/textbooks/manage';
import { learningFailure, noStore } from '@/lib/learning/auth';
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const body = await req.json(), parsed = termSchema.safeParse(body), revision = z.number().int().nonnegative().safeParse(body.revision);
        if (!parsed.success || !revision.success) return NextResponse.json({ message: 'Invalid term' }, { status: 400 });
        const bookId = (await ctx.params).id, { id, ...data } = parsed.data;
        data.atlasId ||= autoAtlasId(data.word);
        if (!validAtlasLink(data.word, data.atlasId) || (data.useAtlasImage && !data.atlasId)) return NextResponse.json({ message: 'Word and atlas entry must match' }, { status: 400 });
        const term = await editBook(bookId, revision.data, async tx => {
            if (!await tx.textbookUnit.findFirst({ where: { id: data.unitId, bookId } })) throw new BookConflict();
            if (id) { if (!await tx.textbookTerm.findFirst({ where: { id, unit: { bookId } } })) throw new BookConflict(); return tx.textbookTerm.update({ where: { id }, data: { ...data, key: termKey(data.word) } }); }
            return tx.textbookTerm.create({ data: { ...data, key: termKey(data.word) } });
        });
        return NextResponse.json(term, noStore);
    } catch (error) { if (error instanceof BookConflict || (typeof error === 'object' && error && 'code' in error && error.code === 'P2002')) return NextResponse.json({ message: 'Term changed or word exists' }, { status: 409 }); return learningFailure(error); }
}
