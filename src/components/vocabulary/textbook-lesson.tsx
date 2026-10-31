'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import type { WordEntry } from '@/lib/vocabulary/catalog';
import { RecordedAudio } from './recorded-audio';
export function TextbookLesson({ word }: { word: WordEntry }) {
    const { t } = useLanguage(), l = t.textbooks, lesson = word.lesson;
    if (!lesson || !word.textbookTermId) return null;
    const voice = (part: string, label: string, index = 0) => <RecordedAudio key={`${word.speechVersion}:${part}:${index}`} id={word.textbookTermId!} kind={part} label={label} source={`/api/textbooks/terms/${word.textbookTermId}/audio?part=${part}&index=${index}&v=${word.speechVersion}`} />;
    return <section className="space-y-4" aria-label={l.lessonTitle}>
        <p className="text-xs leading-relaxed text-muted-foreground">{l.lessonNotice}</p>
        <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"><h3 className="text-xl font-bold">{l.lessonTitle}</h3><p className="whitespace-pre-line leading-relaxed">{lesson.overview}</p>{voice('overview', l.explanationAudio)}</div>
        {!!lesson.usage.length && <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><h3 className="text-lg font-bold">{l.lessonUsage}</h3><ul className="list-inside list-disc space-y-2 leading-relaxed">{lesson.usage.map((line, i) => <li key={i}>{line}</li>)}</ul>{voice('usage', l.usageAudio)}</div>}
        {lesson.examples.map((example, i) => <article key={i} className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100"><h3 className="font-bold">{l.lessonExample} {i + 1}</h3><p className="text-xl font-semibold leading-relaxed">{example.en}</p><p>{example.zh}</p>{voice('example', `${l.exampleAudio} ${i + 1}`, i)}<div className="space-y-2 border-t border-violet-200 pt-3 dark:border-violet-800"><h4 className="font-bold">{l.sentenceAnalysis}</h4><p className="whitespace-pre-line leading-relaxed">{example.analysis}</p>{voice('analysis', `${l.analysisAudio} ${i + 1}`, i)}</div></article>)}
        {!!lesson.pitfalls.length && <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"><h3 className="text-lg font-bold">{l.lessonPitfalls}</h3>{lesson.pitfalls.map((line, i) => <p className="leading-relaxed" key={i}>{line}</p>)}{voice('pitfalls', l.pitfallAudio)}</div>}
        {!!lesson.memory && <div className="space-y-3 rounded-2xl border p-4"><h3 className="font-bold">{l.lessonMemory}</h3><p className="leading-relaxed">{lesson.memory}</p>{voice('memory', l.memoryAudio)}</div>}
    </section>;
}
