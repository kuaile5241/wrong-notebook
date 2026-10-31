import type { VocabularyDictionary } from '@/lib/textbooks/dictionary';
import { randomInt } from 'node:crypto';
import type { VocabularyAttempt, VocabularyCard } from '@prisma/client';
import { z } from 'zod';
import { vocabularyCatalog, wordDetails, wordSummary, matchesSettings, settingsSchema } from './catalog';

export const practiceSchema = z.object({ wordId: z.string().max(100), mode: z.enum(['meaning', 'listening', 'spelling', 'self']), scope: z.object({ bookId: z.string().max(100), unitId: z.string().max(100) }).optional() });
export const answerSchema = z.object({ answer: z.string().max(200).default(''), grade: z.number().int().min(1).max(4).optional() });
export function makeChoices(wordId: string, mode: string, dictionary: VocabularyDictionary = vocabularyCatalog()): string[] {
    if (mode === 'spelling' || mode === 'self') return [];
    const { byId } = dictionary, words = vocabularyCatalog().words, target = byId.get(wordId)!;
    const label = (id: string) => mode === 'meaning' ? wordSummary(byId.get(id)!).zh : byId.get(id)!.w.toLowerCase();
    const primary = settingsSchema.parse({});
    const pool = words.filter(w => (!matchesSettings(target, primary) || matchesSettings(w, primary)) && w.id !== wordId && (w.cefr === target.cefr || (target.cefr === '教材词汇' && w.cefr === 'A1')) && label(w.id) !== label(wordId));
    const chosen = [wordId], seen = new Set([label(wordId)]);
    while (chosen.length < 4 && pool.length) {
        const w = pool.splice(randomInt(pool.length), 1)[0];
        if (!seen.has(label(w.id))) { chosen.push(w.id); seen.add(label(w.id)); }
    }
    for (let i = chosen.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
    return chosen;
}
export function gradeAttempt(attempt: Pick<VocabularyAttempt, 'mode' | 'wordId' | 'choices'>, input: z.infer<typeof answerSchema>, dictionary: VocabularyDictionary = vocabularyCatalog()) {
    if (attempt.mode === 'self') {
        if (!input.grade) throw new Error('GRADE_REQUIRED');
        return { correct: null, grade: input.grade };
    }
    const word = dictionary.byId.get(attempt.wordId)!;
    const normalize = (s: string) => s.normalize('NFKC').trim().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').toLowerCase();
    let correct: boolean;
    if (attempt.mode === 'spelling') correct = normalize(input.answer) === normalize(word.w);
    else {
        const choices = JSON.parse(attempt.choices) as string[], index = ['A', 'B', 'C', 'D'].indexOf(input.answer);
        if (index < 0 || index >= choices.length) throw new Error('CHOICE_REQUIRED');
        correct = choices[index] === attempt.wordId;
    }
    return { correct, grade: correct ? 3 : 1 };
}
export function attemptView(attempt: VocabularyAttempt, card: VocabularyCard, reveal = false, dictionary: VocabularyDictionary = vocabularyCatalog()) {
    const word = dictionary.byId.get(attempt.wordId)!;
    const done = !!attempt.completedAt;
    return { id: attempt.id, mode: attempt.mode, completed: done,
        // 听辨不在题面展示目标词或释义；只保留供固定录音播放的媒体标识。
        prompt: attempt.mode === 'meaning' || attempt.mode === 'self' ? word.w : attempt.mode === 'spelling' ? wordSummary(word).zh : '',
        scope: readPracticeScope(attempt.scope ?? ''), audioId: word.mediaId ?? word.id, onlineSpeechId: word.onlineSpeechId, choices: (JSON.parse(attempt.choices) as string[]).map((id, i) => ({ key: ['A', 'B', 'C', 'D'][i], label: attempt.mode === 'meaning' ? wordSummary(dictionary.byId.get(id)!).zh : dictionary.byId.get(id)!.w })),
        word: done || (reveal && attempt.mode === 'self') ? wordDetails(word) : null,
        correct: done ? attempt.correct : null, grade: done ? attempt.grade : null,
        dueAt: done ? card.dueAt?.toISOString() ?? null : null, revision: card.revision };
}
export type PracticeView = ReturnType<typeof attemptView>;

export function readPracticeScope(raw: string): { bookId: string; unitId: string; revision?: number } {
    try { const value = z.object({ bookId: z.string().max(100), unitId: z.string().max(100), revision: z.number().int().nonnegative().optional() }).parse(JSON.parse(raw)); return value; }
    catch { return { bookId: '', unitId: '' }; }
}
