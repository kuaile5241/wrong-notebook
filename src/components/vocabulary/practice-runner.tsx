'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PracticeView } from '@/lib/vocabulary/practice';
import { vocabularyRequest, VocabularyRequestError } from './client';
import { RecordedAudio } from './recorded-audio';
import { WordCard } from './word-card';
interface Props { id: string }
export function VocabularyPractice({ id }: Props) {
    const { t } = useLanguage(), l = t.vocabulary, router = useRouter(), { data: session } = useSession(), owner = session?.user?.id ?? '';
    const [stored, setStored] = useState<{ id: string; owner: string; value: PracticeView } | null>(null), [accent, setAccent] = useState<'uk' | 'us'>('uk');
    const [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const view = stored?.id === id && stored.owner === owner ? stored.value : null;
    useEffect(() => {
        if (!owner) return; let cancelled = false;
        Promise.all([vocabularyRequest<PracticeView>(`/api/vocabulary/practice/${id}`), vocabularyRequest<{ settings: { accent: 'uk' | 'us' } }>('/api/vocabulary')]).then(([value, account]) => {
            if (!cancelled) { setStored({ id, owner, value }); setAccent(account.settings.accent); setAnswer(''); setError(''); }
        }).catch(() => { if (!cancelled) setError(l.failure); });
        return () => { cancelled = true; };
    }, [id, owner, l.failure]);
    async function submit(grade?: number) {
        if (busy || !view || view.completed) return; setBusy(true); setError('');
        try { setStored({ id, owner, value: await vocabularyRequest<PracticeView>(`/api/vocabulary/practice/${id}`, { answer, ...(grade ? { grade } : {}) }) }); }
        catch (e) { setError(e instanceof VocabularyRequestError && e.status === 409 ? l.stale : l.failure); }
        finally { setBusy(false); }
    }
    async function next() {
        if (busy) return; setBusy(true); setError('');
        try { const value = await vocabularyRequest<PracticeView>('/api/vocabulary/practice', { wordId: '', mode: view?.mode ?? 'meaning', scope: view?.scope }); router.push(`/words/practice/${value.id}`); }
        catch (e) { setError(e instanceof VocabularyRequestError && e.status === 404 ? l.noDue : l.failure); } finally { setBusy(false); }
    }
    async function reveal() {
        if (busy) return; setBusy(true);
        try { const value = await vocabularyRequest<PracticeView>(`/api/vocabulary/practice/${id}?reveal=true`); setStored({ id, owner, value }); }
        catch { setError(l.failure); } finally { setBusy(false); }
    }
    return <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 md:px-8">
        <Link href="/words" className="text-sm text-primary">← {l.back}</Link>
        {error && <div role="alert" className="space-y-2 rounded-xl border p-3 text-destructive"><p>{error}</p><Button variant="outline" disabled={busy} onClick={next}>{l.restart}</Button></div>}
        {!view ? <p>{l.loading}</p> : <section className="space-y-5 rounded-3xl border-2 border-violet-100 bg-card p-5 dark:border-violet-900">
            <h1 className="text-xl font-bold">{l[view.mode as 'meaning' | 'listening' | 'spelling' | 'self']}</h1>
            {!view.completed && <>
                {view.prompt && <p className="rounded-2xl bg-sky-50 p-6 text-center text-3xl font-bold leading-relaxed text-sky-950 dark:bg-sky-950 dark:text-sky-100">{view.prompt}</p>}
                <RecordedAudio key={`${id}:${accent}`} id={view.onlineSpeechId ?? view.audioId} kind={accent} label={view.onlineSpeechId ? l.naturalAudio : view.mode === 'listening' ? l.audio : l[accent]} source={view.onlineSpeechId ? `/api/textbooks/terms/${view.onlineSpeechId}/audio` : undefined} />
                {!!view.choices.length && <div className="grid gap-3 sm:grid-cols-2">{view.choices.map(choice => <Button key={choice.key} disabled={busy} aria-pressed={answer === choice.key} className="h-auto min-h-14 whitespace-normal rounded-xl p-4 text-left" variant={answer === choice.key ? 'default' : 'outline'} onClick={() => setAnswer(choice.key)}>{choice.key}. {choice.label}</Button>)}</div>}
                {view.mode === 'spelling' && <Input autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label={l.answer} placeholder={l.answer} value={answer} onChange={e => setAnswer(e.target.value)} />}
                {view.mode !== 'self' && <Button disabled={busy || !answer.trim()} onClick={() => void submit()}>{l.submit}</Button>}
                {view.mode === 'self' && !view.word && <Button disabled={busy} onClick={reveal}>{l.reveal}</Button>}
            </>}
            {view.completed && <div className="space-y-2 rounded-2xl bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"><h2 className="text-xl font-bold">{view.correct === null ? l.selfResult : view.correct ? l.correct : l.wrong}</h2><p>{l.saved}</p>{view.dueAt && <p className="text-sm">{l.nextReview}：{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(view.dueAt))}</p>}<Button disabled={busy} onClick={next}>{l.next}</Button></div>}
            {view.word && <><h2 className="text-lg font-bold">{l.reference}</h2><WordCard key={view.word.id} word={view.word} accent={accent} /></>}
            {!view.completed && view.mode === 'self' && view.word && <div className="grid grid-cols-2 gap-3">{[l.again, l.hard, l.good, l.easy].map((label, i) => <Button key={label} disabled={busy} variant={i > 1 ? 'default' : 'outline'} onClick={() => void submit(i + 1)}>{label}</Button>)}</div>}
        </section>}
    </main>;
}
