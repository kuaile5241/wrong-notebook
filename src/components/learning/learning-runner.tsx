'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StepLesson } from '@/components/step-lesson';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AnswerHistory, LearningView } from '@/lib/learning/types';
import { questionLesson } from '@/lib/lesson-content';
import { learningRequest, submissionId } from './client';
import { LearningAttribution } from './attribution';
import { QuestionContent } from './question-content';

export function LearningRunner({ id }: { id: string }) {
    const { t } = useLanguage(), l = t.learning;
    const [view, setView] = useState<LearningView | null>(null), [feedback, setFeedback] = useState<AnswerHistory | null>(null);
    const [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [manual, setManual] = useState<{ answer: string; explanation: string } | null>(null);
    const requestId = useRef('');
    const load = useCallback(() => learningRequest<LearningView>(`/api/learning/${id}`).then(v => { setView(v); setError(''); }).catch(() => setError(l.failure)), [id, l.failure]);
    useEffect(() => { let active = true; learningRequest<LearningView>(`/api/learning/${id}`).then(v => { if (active) setView(v); }).catch(() => { if (active) setError(l.failure); }); return () => { active = false; }; }, [id, l.failure]);
    async function submit(skip = false, selfResult?: string) {
        if (!view?.question || busy) return;
        setBusy(true); setError(''); requestId.current ||= submissionId();
        try {
            const result = await learningRequest<LearningView | { manual: true; reference: { answer: string; explanation: string } }>(`/api/learning/${id}`, { questionId: view.question.id, revision: view.revision, requestId: requestId.current, answer, skip, selfResult });
            if ('manual' in result) setManual(result.reference);
            else { setView(result); setFeedback(result.history[result.history.length - 1] ?? null); setManual(null); requestId.current = ''; }
        } catch { setError(l.failure); }
        finally { setBusy(false); }
    }
    if (!view) return <main className="mx-auto max-w-3xl p-6"><p role={error ? 'alert' : undefined}>{error || l.loading}</p><Button onClick={load}>{l.retry}</Button></main>;
    const q = feedback?.question ?? view.question;
    const heading = feedback?.verdict === 'correct' ? l.correct : feedback?.verdict === 'skip' ? l.skipped : l.wrong;
    return <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-8">
        <Link href="/learn" className="text-sm text-primary">← {l.home}</Link>
        <header><h1 className="text-2xl font-bold">{view.title}</h1><p className="mt-2 text-sm text-muted-foreground">{view.mode === 'diagnose' ? l.diagnose : l.practice} · {l.progress} {view.answered} / {view.limit}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${view.finished ? 100 : view.answered / view.limit * 100}%` }} /></div></header>
        {view.mode === 'diagnose' && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100">{l.diagnosisHint}</p>}
        {error && <div role="alert" className="text-destructive">{error} <Button variant="outline" onClick={() => { setFeedback(null); setManual(null); setAnswer(''); requestId.current = ''; void load(); }}>{l.retry}</Button></div>}
        {q && <section className="space-y-5 rounded-2xl border-2 border-primary/15 bg-card p-5 md:p-7">
            {!feedback && view.topic && <p className="text-sm font-medium text-primary">{l.currentTopic} · {view.topic.name}</p>}
            <QuestionContent question={q} answer={answer} disabled={busy || !!feedback || !!manual} onAnswer={setAnswer} />
            {!q.choices && <label className="block space-y-2 text-sm">{l.answer}<textarea aria-label={l.answer} maxLength={5000} rows={3} disabled={busy || !!feedback || !!manual} value={answer} onChange={e => setAnswer(e.target.value)} className="w-full rounded-xl border bg-background p-3" /></label>}
            {!feedback && !manual && <div className="flex flex-wrap gap-3"><Button disabled={busy || (!answer.trim() && q.type !== 'self')} onClick={() => submit()}>{busy ? l.loading : l.submit}</Button><Button variant="outline" disabled={busy} onClick={() => submit(true)}>{l.skip}</Button></div>}
            {manual && <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100"><p>{l.manual}</p><MarkdownRenderer content={manual.answer} /><MarkdownRenderer content={manual.explanation} /><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => submit(false, 'correct')}>{l.selfCorrect}</Button><Button variant="outline" disabled={busy} onClick={() => submit(false, 'wrong')}>{l.selfWrong}</Button></div></div>}
            {feedback && <div className={`space-y-3 rounded-xl p-4 ${feedback.verdict === 'correct' ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-orange-50 text-orange-950 dark:bg-orange-950 dark:text-orange-100'}`}>
                <h2 className="text-lg font-bold">{heading}</h2><p className="text-xs">{feedback.method === 'self' ? l.selfLabel : l.rule}</p>
                <h3 className="font-semibold">{l.reference}</h3><MarkdownRenderer content={feedback.question.answer} />
                <StepLesson content={questionLesson(feedback.question)} source={{ kind: 'learning', id, questionId: feedback.question.id }} />
                {feedback.errorItemId && <p>{l.archived} · <Link href={`/error-items/${feedback.errorItemId}`} className="underline">{l.openMistake}</Link></p>}
                <Button onClick={() => { setFeedback(null); setAnswer(''); }}>{view.finished ? l.result : l.next}</Button>
            </div>}
        </section>}
        {view.finished && !feedback && <section className="space-y-5 rounded-2xl border bg-card p-5"><h2 className="text-xl font-bold">{l.result}</h2><p>{l.accuracy} {view.correct} / {view.answered}</p>
            <div className="grid gap-2 sm:grid-cols-2">{view.topics.map(topic => <div key={topic.id} className={`rounded-xl border p-3 ${topic.status === 'weak' || topic.status === 'shaky' ? 'border-orange-200 bg-orange-50 text-orange-950 dark:bg-orange-950 dark:text-orange-100' : ''}`}><strong>{topic.name}</strong><p className="text-sm">{l[topic.status]}</p><Link className="text-sm underline" href={`/learn?search=${encodeURIComponent(topic.name)}`}>{l.practice} →</Link></div>)}</div>
            <h3 className="font-semibold">{l.history}</h3>{view.history.map((h, i) => <details key={h.requestId} className="rounded-xl border p-3"><summary className="cursor-pointer">{i + 1}. {h.question.prompt.slice(0, 70)} · {h.verdict === 'correct' ? '✓' : '↻'}</summary><div className="mt-3 space-y-2"><p>{l.answer}：{h.answer || '—'}</p><MarkdownRenderer content={h.question.prompt} /><StepLesson content={questionLesson(h.question)} source={{ kind: 'learning', id, questionId: h.question.id }} />{h.errorItemId && <Link className="text-primary underline" href={`/error-items/${h.errorItemId}`}>{l.openMistake}</Link>}</div></details>)}
            <Link href="/learn" className="inline-block rounded-xl bg-primary px-5 py-3 text-primary-foreground">{l.home}</Link>
        </section>}
        <LearningAttribution />
    </main>;
}
