import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { wordLessonJsonSchema } from './lesson';
const packSchema = z.array(z.object({ id: z.string().min(1).max(100), word: z.string().min(1), meaning: z.string().min(1), lesson: wordLessonJsonSchema.refine(v => !!v) })).max(1000);
/** 仅补充原始词义仍匹配且未编写讲解的词条，保留教师或家长的现有修改。 */
export async function enrichPreparedLessons() {
    const rows = packSchema.parse(JSON.parse(await readFile(path.join(process.cwd(), 'resources/textbooks/ljxj-english-3-upper-lessons.json'), 'utf8')));
    return prisma.$transaction(async tx => {
        let filled = 0; const books = new Set<string>();
        for (const row of rows) {
            const term = await tx.textbookTerm.findFirst({ where: { id: row.id, word: row.word, meaning: row.meaning, lesson: '', archived: false, unit: { archived: false, book: { seedKey: 'ljxj-en-3-upper-2024', archived: false } } }, select: { id: true, unit: { select: { bookId: true } } } });
            if (!term) continue;
            const result = await tx.textbookTerm.updateMany({ where: { id: term.id, lesson: '', word: row.word, meaning: row.meaning }, data: { lesson: row.lesson } });
            if (result.count) { filled++; books.add(term.unit.bookId); }
        }
        for (const id of books) await tx.textbookBook.update({ where: { id }, data: { revision: { increment: 1 } } });
        return { filled, skipped: rows.length - filled, total: rows.length };
    }, { timeout: 60000 });
}
