'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Headphones, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildLesson, speechText } from '@/lib/lesson-content';
import type { LessonContent, LessonSource } from '@/lib/lesson-content';
import { INITIAL_PLAYBACK, LessonPlayer } from '@/lib/lesson-player';
import type { VoiceMode } from '@/lib/lesson-player';
import { figureSvgToDataUri, sanitizeFigureSvg } from '@/lib/figure-svg';

export function StepLesson({ content, source }: { content: LessonContent; source: LessonSource }) {
    const { t } = useLanguage(), l = t.lesson;
    const { question, answer, analysis, figure } = content;
    const lesson = useMemo(() => buildLesson({ question, answer, analysis }), [question, answer, analysis]);
    const { kind, id } = source, questionId = source.kind === 'learning' ? source.questionId : '';
    const sourceLanguage = source.kind === 'animation' ? source.language : 'zh';
    const player = useMemo(() => new LessonPlayer(lesson.steps, lesson.fingerprint, kind === 'learning' ? { kind, id, questionId } : kind === 'animation' ? { kind, id, language: sourceLanguage } : { kind, id }, lesson.language), [lesson, kind, id, questionId, sourceLanguage]);
    const state = useSyncExternalStore(player.subscribe, player.getSnapshot, () => INITIAL_PLAYBACK);
    useEffect(() => {
        const onVisibility = () => { if (document.hidden) player.pause(); };
        document.addEventListener('visibilitychange', onVisibility);
        return () => { document.removeEventListener('visibilitychange', onVisibility); player.stop(); };
    }, [player]);
    if (!lesson.steps.length) return null;
    const selected = lesson.steps[state.index], svg = sanitizeFigureSvg(figure);
    const running = state.status === 'playing' || state.status === 'loading';
    const error = state.error.startsWith('AUDIO_CACHE_') ? l.cacheFailed : state.error === 'DEVICE_VOICE_UNAVAILABLE' ? l.deviceUnavailable : state.error === 'AUDIO_NOT_CONFIGURED' ? l.notConfigured : state.error === 'AUDIO_CREDENTIALS' ? l.credentials : state.error === 'AUDIO_BUSY' ? l.busy : state.error === 'LESSON_CHANGED' ? l.changed : state.error === 'AUDIO_TAP_TO_PLAY' ? l.tap : state.error ? l.failed : '';
    return <section data-step-lesson className="space-y-4 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-sky-50 to-white p-4 text-slate-900 dark:border-violet-800 dark:from-violet-950 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
        <header><h3 className="flex items-center gap-2 text-lg font-bold text-violet-700 dark:text-violet-300"><Headphones className="h-5 w-5" />{l.title}</h3><p className="mt-2 text-sm text-muted-foreground">{l.hint}</p></header>
        <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">{l.rate}<select aria-label={l.rate} value={state.rate} onChange={e => player.setRate(Number(e.target.value))} className="min-h-10 rounded-lg border bg-background px-2">{[0.75, 1, 1.25].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>
            <label className="flex items-center gap-2">{l.voice}<select aria-label={l.voice} value={state.mode} onChange={e => player.setMode(e.target.value as VoiceMode)} className="min-h-10 rounded-lg border bg-background px-2">{(['auto', 'natural', 'device', 'compatible'] as const).map(mode => <option key={mode} value={mode}>{l[mode]}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={l.title}>{lesson.steps.map((_, i) => i < 2 || i >= lesson.steps.length - 2 || Math.abs(i - state.index) <= 2 ? <button key={i} aria-label={`${l.step} ${i + 1}`} aria-current={i === state.index ? 'step' : undefined} onClick={() => player.select(i)} className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-2 text-sm font-bold ${i === state.index ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 bg-background'}`}>{i + 1}</button> : null)}</div>
        <article key={`${lesson.fingerprint}-${state.index}`} className="animate-in fade-in slide-in-from-bottom-1 space-y-3 rounded-xl border border-sky-200 bg-background p-4 shadow-sm motion-reduce:animate-none dark:border-sky-800">
            <p className="text-sm font-bold text-primary">{state.index + 1} / {lesson.steps.length} · {l[selected.kind]}</p>
            <MarkdownRenderer content={selected.markdown} />
            {svg && <figure><figcaption className="text-sm text-primary">{l.originalFigure}</figcaption><img src={figureSvgToDataUri(svg)} alt={l.originalFigure} className="mt-2 max-h-64 max-w-full rounded-xl bg-white p-2" /></figure>}
        </article>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => running ? player.pause() : player.play(state.status === 'paused' && state.continuous)}>{running ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{running ? l.pause : state.status === 'paused' ? l.resume : l.play}</Button>
            <Button variant="outline" onClick={() => player.play(true)} disabled={running}>{l.continuous}</Button>
            <Button variant="outline" onClick={player.replay}><RotateCcw className="mr-2 h-4 w-4" />{l.replay}</Button>
        </div>
        <div className="flex items-center justify-between gap-2"><Button variant="ghost" disabled={state.index === 0} onClick={() => player.select(state.index - 1)}>← {l.previous}</Button><Button variant="ghost" disabled={state.index === lesson.steps.length - 1} onClick={() => player.select(state.index + 1)}>{l.next} →</Button></div>
        <p role="status" aria-live="polite" className="text-sm text-primary">{error || (state.status === 'loading' ? l.preparing : state.status === 'playing' ? l.speaking : '')}</p>
        {state.mode === 'compatible' && <p className="text-xs text-muted-foreground">{l.compatibleHint}</p>}
        {(state.mode === 'auto' || state.mode === 'natural') && <p className="text-xs text-muted-foreground">{l.naturalHint}</p>}
        {lesson.truncated && <p className="text-sm">{l.long}</p>}
        <details className="rounded-xl border bg-background p-3"><summary className="cursor-pointer text-sm">{l.speechText}</summary><p className="mt-2 text-sm leading-7">{speechText(selected.markdown, lesson.language)}</p></details>
        <details className="rounded-xl border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold">{l.full}</summary><div className="mt-3"><MarkdownRenderer content={analysis} /><MarkdownRenderer content={answer} /></div></details>
    </section>;
}
