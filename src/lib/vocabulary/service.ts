import { prisma } from '@/lib/prisma';
import { getDayRange } from '@/lib/date-time';
import { getAppTimeZone } from '@/lib/config';
import { matchesSettings, readSettings, vocabularyCatalog, wordSummary } from './catalog';
import type { VocabularySettings } from './catalog';

export async function accountVocabulary(userId: string) {
    const [user, cards, today] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { vocabularySettings: true } }),
        prisma.vocabularyCard.findMany({ where: { userId } }),
        prisma.vocabularyAttempt.count({ where: { userId, completedAt: { gte: getDayRange(new Date(), getAppTimeZone()).start } } }),
    ]);
    return { settings: readSettings(user.vocabularySettings), cards, today };
}
export async function nextWordId(userId: string, settings?: VocabularySettings) {
    const account = await accountVocabulary(userId), selected = settings ?? account.settings;
    const map = new Map(account.cards.map(c => [c.wordId, c]));
    const words = vocabularyCatalog().words.filter(w => matchesSettings(w, selected));
    const due = words.filter(w => { const c = map.get(w.id); return c?.reviews && c.dueAt && c.dueAt <= new Date(); });
    due.sort((a, b) => map.get(a.id)!.dueAt!.getTime() - map.get(b.id)!.dueAt!.getTime());
    return due[0]?.id ?? words.find(w => !map.get(w.id)?.reviews)?.id ?? null;
}
export async function vocabularyView(userId: string, params: URLSearchParams) {
    const { settings, cards, today } = await accountVocabulary(userId);
    const byWord = new Map(cards.map(c => [c.wordId, c])), now = new Date();
    const query = (params.get('search') ?? '').trim().slice(0, 100).toLowerCase();
    const scope = params.get('scope') ?? 'all';
    const words = vocabularyCatalog().words.filter(w => matchesSettings(w, settings));
    const due = cards.filter(c => c.reviews > 0 && c.dueAt && c.dueAt <= now);
    const filtered = words.filter(w => {
        const c = byWord.get(w.id);
        return (!query || `${w.w} ${wordSummary(w).zh}`.toLowerCase().includes(query))
            && (scope !== 'mistakes' || (c?.wrong ?? 0) > 0) && (scope !== 'favorite' || c?.favorite) && (scope !== 'due' || (c?.reviews && c.dueAt && c.dueAt <= now));
    });
    if (scope === 'due') filtered.sort((a, b) => byWord.get(a.id)!.dueAt!.getTime() - byWord.get(b.id)!.dueAt!.getTime());
    const page = Math.min(1000, Math.max(1, Math.floor(Number(params.get('page'))) || 1));
    return { planAvailable: words.some(w => { const c = byWord.get(w.id); return !c?.reviews || (!!c.dueAt && c.dueAt <= now); }), settings, total: filtered.length, available: words.length, totalWords: vocabularyCatalog().words.length, page,
        topics: vocabularyCatalog().topics, stats: { learned: cards.filter(c => c.reviews > 0).length, due: due.length, today,
            correct: cards.reduce((n, c) => n + c.correct, 0), wrong: cards.reduce((n, c) => n + c.wrong, 0) },
        words: filtered.slice((page - 1) * 24, page * 24).map(w => ({ ...wordSummary(w), favorite: byWord.get(w.id)?.favorite ?? false,
            reviews: byWord.get(w.id)?.reviews ?? 0, dueAt: byWord.get(w.id)?.dueAt?.toISOString() ?? null })) };
}
export type VocabularyView = Awaited<ReturnType<typeof vocabularyView>>;
