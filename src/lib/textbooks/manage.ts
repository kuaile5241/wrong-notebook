import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { importRowSchema, termKey } from './schema';
import { autoAtlasId, validAtlasLink } from './dictionary';
export class BookConflict extends Error {}
export async function editBook<T>(id: string, revision: number, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(async tx => {
        const locked = await tx.textbookBook.updateMany({ where: { id, revision }, data: { revision: { increment: 1 } } });
        if (locked.count !== 1) throw new BookConflict();
        return action(tx);
    }, { timeout: 60000 });
}
export async function inspectImport(bookId: string, raw: unknown, mode: 'skip' | 'update') {
    if (!Array.isArray(raw) || !raw.length || raw.length > 1000) throw new Error('INVALID_IMPORT');
    const issues: { row: number; field: string }[] = [], rows = [];
    const seen = new Set<string>(), titles = new Map<string, string>();
    for (let i = 0; i < raw.length; i++) {
        const parsed = importRowSchema.safeParse(raw[i]);
        if (!parsed.success) { for (const issue of parsed.error.issues) issues.push({ row: i + 1, field: String(issue.path[0] ?? 'row') }); continue; }
        const row = { ...parsed.data, atlasId: parsed.data.atlasId || autoAtlasId(parsed.data.word) };
        const key = row.unitCode + ':' + termKey(row.word);
        if (seen.has(key)) issues.push({ row: i + 1, field: 'duplicate' }); seen.add(key);
        if (titles.has(row.unitCode) && titles.get(row.unitCode) !== row.unitTitle) issues.push({ row: i + 1, field: 'unitTitle' });
        titles.set(row.unitCode, row.unitTitle);
        if (!validAtlasLink(row.word, row.atlasId)) issues.push({ row: i + 1, field: 'atlasId' });
        if (row.useAtlasImage && !row.atlasId) issues.push({ row: i + 1, field: 'useAtlasImage' });
        rows.push(row);
    }
    const book = await prisma.textbookBook.findUniqueOrThrow({ where: { id: bookId }, include: { units: { include: { terms: true } } } });
    let newUnits = 0, added = 0, updated = 0, skipped = 0;
    for (const [code, title] of titles) {
        const unit = book.units.find(u => u.code === code);
        if (!unit) newUnits++;
        else if (unit.archived || unit.title !== title) issues.push({ row: 0, field: `unit:${code}` });
    }
    for (const row of rows) {
        const previous = book.units.find(u => u.code === row.unitCode)?.terms.find(t => t.key === termKey(row.word));
        if (!previous) added++; else if (mode === 'update') updated++; else skipped++;
    }
    return { book, rows, issues: issues.slice(0, 40), totalIssues: issues.length, summary: { newUnits, added, updated, skipped, noAtlas: rows.filter(r => !r.atlasId).length } };
}
export async function applyImport(bookId: string, revision: number, raw: unknown, mode: 'skip' | 'update') {
    const preview = await inspectImport(bookId, raw, mode);
    if (preview.totalIssues) throw new Error('INVALID_IMPORT');
    if (preview.book.revision !== revision || preview.book.archived) throw new BookConflict();
    if (!preview.summary.newUnits && !preview.summary.added && !preview.summary.updated) return preview.summary;
    await editBook(bookId, revision, async tx => {
        const units = new Map(preview.book.units.map(u => [u.code, u]));
        for (const row of preview.rows) {
            let unit = units.get(row.unitCode);
            if (!unit) {
                const created = await tx.textbookUnit.create({ data: { bookId, code: row.unitCode, title: row.unitTitle, moduleTitle: row.moduleTitle, pageReference: row.pageReference, position: units.size } });
                unit = { ...created, terms: [] }; units.set(row.unitCode, unit);
            }
            const previous = unit.terms.find(t => t.key === termKey(row.word));
            const data = { word: row.word, meaning: row.meaning, example: row.example, translation: row.translation, atlasId: row.atlasId,
                useAtlasImage: row.useAtlasImage, notes: row.notes, verified: row.verified };
            if (!previous) await tx.textbookTerm.create({ data: { ...data, unitId: unit.id, key: termKey(row.word), position: unit.terms.length + preview.rows.indexOf(row) } });
            else if (mode === 'update') await tx.textbookTerm.update({ where: { id: previous.id }, data });
        }
    });
    return preview.summary;
}
