import type { Prisma, TextbookTerm } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { vocabularyCatalog, wordDetails } from '@/lib/vocabulary/catalog';
import type { WordEntry } from '@/lib/vocabulary/catalog';
export interface VocabularyDictionary { words: WordEntry[]; byId: Map<string, WordEntry> }
export function termEntry(term: TextbookTerm): WordEntry {
    const base = vocabularyCatalog().byId.get(term.atlasId), media = base ? wordDetails(base).media : 0;
    return { id: 'tb-' + term.id, w: term.word, uk: base?.uk ?? '', us: base?.us ?? '', cefr: base?.cefr ?? '教材词汇', topic: 'textbook',
        senses: [{ pos: '', zh: term.meaning, en: '' }], ex: term.example ? [{ en: term.example, zh: term.translation }] : [],
        col: [], fam: [], syn: [], ant: [], tip: term.notes, note: term.verified ? '' : '词条待核对', mediaId: base?.id, onlineSpeechId: base ? undefined : term.id,
        media: (media & 6) | (term.useAtlasImage ? media & 1 : 0) | (term.example && term.example === base?.ex[0]?.en ? media & 8 : 0) };
}
export async function loadVocabularyDictionary(userId: string, database: Prisma.TransactionClient = prisma, includeArchived = false): Promise<VocabularyDictionary> {
    const terms = await database.textbookTerm.findMany({ where: includeArchived ? {} : { archived: false, unit: { archived: false, book: { published: true, archived: false } } } });
    // 草稿不并入普通学习词典；管理员也先通过预览检查，再发布学习。
    const words = [...vocabularyCatalog().words, ...terms.map(termEntry)];
    void userId;
    return { words, byId: new Map(words.map(w => [w.id, w])) };
}
export async function selectedVocabulary(userId: string, settings: { bookId: string; unitId: string }) {
    if (!settings.bookId) return vocabularyCatalog().words;
    const terms = await prisma.textbookTerm.findMany({ where: { archived: false, unit: { bookId: settings.bookId, archived: false,
        ...(settings.unitId ? { id: settings.unitId } : {}), book: { published: true, archived: false, subject: 'english' } } },
        orderBy: [{ unit: { position: 'asc' } }, { position: 'asc' }, { id: 'asc' }] });
    void userId;
    return terms.map(termEntry);
}
export function autoAtlasId(word: string) { return vocabularyCatalog().words.find(w => w.w.toLowerCase() === word.toLowerCase().trim())?.id ?? ''; }
export function validAtlasLink(word: string, atlasId: string) {
    return !atlasId || vocabularyCatalog().byId.get(atlasId)?.w.normalize('NFKC').toLowerCase() === word.normalize('NFKC').trim().toLowerCase();
}
