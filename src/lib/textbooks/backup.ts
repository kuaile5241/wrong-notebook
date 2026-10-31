import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { bookSchema, unitSchema, termSchema, termKey } from './schema';
import { validAtlasLink } from './dictionary';
const identifier = z.string().min(1).max(100);
/** 教材是管理员共享内容；普通学习备份不能借此修改公共书架。 */
export async function restoreTextbooks(tx: Prisma.TransactionClient, raw: unknown, admin: boolean) {
    if (!admin || raw === undefined) return { textbooksCreated: 0 };
    const books = z.array(z.unknown()).max(200).parse(raw); let textbooksCreated = 0;
    for (const item of books) {
        const input = z.object({ id: identifier, seedKey: z.string().max(100).nullable().optional(), revision: z.number().int().nonnegative().default(0), units: z.array(z.unknown()).max(200) }).parse(item);
        const data = bookSchema.parse(item);
        if (await tx.textbookBook.findUnique({ where: { id: input.id } })) continue;
        if (input.seedKey && await tx.textbookBook.findUnique({ where: { seedKey: input.seedKey } })) continue;
        await tx.textbookBook.create({ data: { ...data, id: input.id, seedKey: input.seedKey, revision: input.revision } });
        let total = 0;
        for (const unitRaw of input.units) {
            const unit = unitSchema.parse(unitRaw), terms = z.object({ id: identifier, terms: z.array(z.unknown()).max(1000) }).parse(unitRaw);
            await tx.textbookUnit.create({ data: { ...unit, id: terms.id, bookId: input.id } });
            total += terms.terms.length; if (total > 10000) throw new Error('BOOK_TOO_LARGE');
            for (const termRaw of terms.terms) {
                const term = termSchema.parse(termRaw), id = z.object({ id: identifier }).parse(termRaw).id;
                if (term.unitId !== terms.id || !validAtlasLink(term.word, term.atlasId)) throw new Error('INVALID_TERM_LINK');
                await tx.textbookTerm.create({ data: { ...term, id, unitId: terms.id, key: termKey(term.word) } });
            }
        }
        textbooksCreated++;
    }
    return { textbooksCreated };
}
