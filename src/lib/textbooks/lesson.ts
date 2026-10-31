import { z } from 'zod';
const line = z.string().trim().min(1).max(700);
export const wordLessonSchema = z.object({
    version: z.literal(1), overview: line, spokenWord: z.string().trim().max(250).default(''),
    usage: z.array(line).max(6).refine(lines => lines.join('。').length <= 700), examples: z.array(z.object({ en: z.string().trim().min(1).max(350), zh: line, analysis: line }).refine(ex => ex.zh.length + ex.analysis.length <= 690)).max(3),
    pitfalls: z.array(line).max(5).refine(lines => lines.join('。').length <= 700), memory: z.string().trim().max(700).default(''),
});
export type WordLesson = z.infer<typeof wordLessonSchema>;
export function readWordLesson(raw?: string): WordLesson | undefined {
    try { const result = wordLessonSchema.safeParse(JSON.parse(raw || '')); return result.success ? result.data : undefined; } catch { return undefined; }
}
export const wordLessonJsonSchema = z.string().max(18000).refine(raw => !raw || !!readWordLesson(raw), 'Invalid word lesson');
export function lessonSpeech(term: { word: string; example: string; translation: string; lesson: string }, part: string, index: number) {
    const lesson = readWordLesson(term.lesson);
    if (part === 'word') return { text: lesson?.spokenWord || term.word, language: 'en' as const };
    if (part === 'customExample' && term.example) return { text: term.example, language: 'en' as const };
    if (!lesson) return undefined;
    const example = lesson.examples[index];
    switch (part) {
        case 'overview': return { text: lesson.overview, language: 'zh' as const };
        case 'usage': return lesson.usage.length ? { text: lesson.usage.join('。'), language: 'zh' as const } : undefined;
        case 'pitfalls': return lesson.pitfalls.length ? { text: lesson.pitfalls.join('。'), language: 'zh' as const } : undefined;
        case 'memory': return lesson.memory ? { text: lesson.memory, language: 'zh' as const } : undefined;
        case 'example': return example ? { text: example.en, language: 'en' as const } : undefined;
        case 'analysis': return example ? { text: example.zh + '。' + example.analysis, language: 'zh' as const } : undefined;
        default: return undefined;
    }
}
