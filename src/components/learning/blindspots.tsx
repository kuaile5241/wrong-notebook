'use client';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { BlindspotChapter } from '@/lib/learning/blindspots';

interface Props { chapters: BlindspotChapter[]; busy: boolean; onStart: (ids: string[], mode: string) => void }
export function LearningBlindspots({ chapters, busy, onStart }: Props) {
    const { t } = useLanguage(), l = t.learning;
    return <section aria-label={l.blindspots} className="space-y-3 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-rose-50 p-5 text-slate-900 dark:border-orange-900 dark:from-orange-950 dark:to-slate-950 dark:text-slate-100">
        <h2 className="text-xl font-bold">{l.blindspots}</h2>
        <p className="text-sm leading-relaxed">{l.blindspotsHint}</p>
        {!chapters.length && <p className="text-sm">{l.blindspotsEmpty}</p>}
        {chapters.map(c => <article key={`${c.volume}:${c.chapter}`} className="space-y-2 rounded-xl border border-orange-200 bg-card p-4 dark:border-orange-900">
            <h3 className="font-semibold">{c.chapter}</h3>
            <p className="text-sm text-muted-foreground">{c.names.join('、')}</p>
            <p className="text-sm">{l.weak} {c.weak} · {l.pending} {c.pending}</p>
            <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => onStart(c.topicIds, 'diagnose')}>{l.recheckChapter}</Button>
                <Button variant="outline" disabled={busy} onClick={() => onStart(c.topicIds, 'practice')}>{l.reviewBlindspots}</Button>
            </div>
        </article>)}
    </section>;
}
