'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BookOpen, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VocabularySettings, WordEntry } from '@/lib/vocabulary/catalog';
import type { VocabularyView } from '@/lib/vocabulary/service';
import type { PracticeView } from '@/lib/vocabulary/practice';
import { vocabularyRequest } from './client';
import { WordCard } from './word-card';

export function VocabularyBrowser() {
    const { t } = useLanguage(), l = t.vocabulary, router = useRouter(), { data: session } = useSession();
    const owner = session?.user?.id ?? '', activeOwner = useRef(owner); activeOwner.current = owner;
    const [stored, setStored] = useState<{ owner: string; value: VocabularyView } | null>(null);
    const data = stored?.owner === owner ? stored.value : null;
    const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [scope, setScope] = useState('all'), [page, setPage] = useState(1);
    const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [mode, setMode] = useState('meaning'), [detail, setDetail] = useState<{ owner: string; word: WordEntry & { media: number } } | null>(null);
    useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
    useEffect(() => {
        if (!owner) return;
        let cancelled = false;
        const params = new URLSearchParams({ search: query, scope, page: String(page) });
        vocabularyRequest<VocabularyView>(`/api/vocabulary?${params}`).then(value => { if (!cancelled) { setStored({ owner, value }); setError(''); } }).catch(() => { if (!cancelled) setError(l.failure); });
        return () => { cancelled = true; };
    }, [owner, query, scope, page, refresh, l.failure]);
    async function act(task: () => Promise<void>) {
        if (busy) return; setBusy(true); setError(''); const currentOwner = owner;
        try { await task(); } catch { if (activeOwner.current === currentOwner) setError(l.failure); }
        finally { setBusy(false); }
    }
    async function save(patch: Partial<VocabularySettings>) {
        if (!data) return;
        await act(async () => { const settings = await vocabularyRequest<VocabularySettings>('/api/vocabulary/preferences', { ...data.settings, ...patch }); if (activeOwner.current === owner) { setStored(previous => previous?.owner === owner ? { owner, value: { ...previous.value, settings } } : previous); setPage(1); setRefresh(n => n + 1); } });
    }
    async function start(wordId = '') { await act(async () => { const value = await vocabularyRequest<PracticeView>('/api/vocabulary/practice', { wordId, mode }); if (activeOwner.current === owner) router.push(`/words/practice/${value.id}`); }); }
    async function open(id: string) { await act(async () => { const value = await vocabularyRequest<{ word: WordEntry & { media: number } }>(`/api/vocabulary/words/${encodeURIComponent(id)}`); if (activeOwner.current === owner) setDetail({ owner, word: value.word }); }); }
    const selectClass = 'min-h-11 w-full rounded-xl border bg-background px-3 text-sm';
    const select = (label: string, value: string | number, options: [string, string][], change: (value: string) => void) => <label className="space-y-1 text-sm">{label}<select aria-label={label} disabled={busy} className={selectClass} value={value} onChange={e => change(e.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>;
    return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8">
        <header className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-100 via-violet-50 to-rose-100 p-6 text-slate-900 dark:border-sky-900 dark:from-sky-950 dark:via-slate-950 dark:to-violet-950 dark:text-slate-100"><p className="mb-3 flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" />{l.subtitle}</p><h1 className="text-3xl font-bold">{l.title}</h1><p className="mt-3 leading-relaxed">{l.intro}</p></header>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{l.notice}</p>
        {error && <p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={() => setRefresh(n => n + 1)}>{l.retry}</Button></p>}
        {!data ? <p>{l.loading}</p> : <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[l.learned, data.stats.learned], [l.due, data.stats.due], [l.today, `${data.stats.today}/${data.settings.dailyGoal}`], [l.accuracy, data.stats.correct + data.stats.wrong ? `${Math.round(data.stats.correct * 100 / (data.stats.correct + data.stats.wrong))}%` : '—']].map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold text-primary">{value}</p></div>)}</section>
            <section className="space-y-3 rounded-2xl border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-3">{select(l.stage, data.settings.stage, [['primary', l.primary], ['junior', l.junior], ['senior', l.senior], ['all', l.all]], stage => void save({ stage: stage as VocabularySettings['stage'], level: 'all', topic: '' }))}{select(l.level, data.settings.level, [['all', l.all], ...['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(x => [x, x] as [string, string])], level => void save({ level: level as VocabularySettings['level'] }))}{select(l.topic, data.settings.topic, [['', l.allTopics], ...data.topics], topic => void save({ topic }))}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{l.stageHint}</p>
                <div className="grid gap-3 sm:grid-cols-3">{select(l.accent, data.settings.accent, [['uk', l.uk], ['us', l.us]], accent => void save({ accent: accent as 'uk' | 'us' }))}{select(l.dailyGoal, data.settings.dailyGoal, ['5', '10', '20'].map(x => [x, x]), goal => void save({ dailyGoal: Number(goal) as 5 | 10 | 20 }))}{select(l.mode, mode, [['meaning', l.meaning], ['listening', l.listening], ['spelling', l.spelling], ['self', l.self]], setMode)}</div>
                <Button className="min-h-12 rounded-xl" disabled={busy || !data.planAvailable} onClick={() => void start()}><BookOpen className="mr-2 h-4 w-4" />{l.plan}</Button><p className="text-xs leading-relaxed text-muted-foreground">{data.planAvailable ? l.planHint : l.noDue}</p>
            </section>
            <div className="flex flex-wrap gap-2">{[['all', l.scopeAll], ['due', l.scopeDue], ['mistakes', l.scopeMistakes], ['favorite', l.scopeFavorite]].map(([key, name]) => <Button key={key} aria-pressed={scope === key} variant={scope === key ? 'default' : 'outline'} onClick={() => { setScope(key); setPage(1); }}>{name}</Button>)}</div>
            <Input aria-label={l.search} placeholder={l.search} value={search} onChange={e => setSearch(e.target.value)} /><p className="text-sm text-muted-foreground">{l.results}：{data.total} / {data.totalWords}</p>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{!data.words.length && <p>{l.empty}</p>}{data.words.map(word => <article key={word.id} className="rounded-2xl border-2 border-violet-100 bg-card p-4 dark:border-violet-900"><div className="flex items-start gap-3"><Image unoptimized loading="lazy" src={`/api/vocabulary/media/thumb/${word.id}`} width={72} height={72} alt="" className="rounded-xl bg-sky-50 object-contain" /><div className="min-w-0 flex-1"><h2 className="break-words text-xl font-bold">{word.word}</h2><p className="text-xs text-muted-foreground">{word.ipa} · {word.cefr}</p><p className="mt-2 text-sm leading-relaxed">{word.zh}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void open(word.id)}>{l.view}</Button><Button disabled={busy} variant="outline" onClick={() => void start(word.id)}>{l.practice}</Button><Button disabled={busy} variant="ghost" size="icon" aria-label={word.favorite ? l.unfavorite : l.favorite} aria-pressed={word.favorite} onClick={() => void act(async () => { await vocabularyRequest(`/api/vocabulary/words/${word.id}`, { favorite: !word.favorite }); setRefresh(n => n + 1); })}><Star className={word.favorite ? 'fill-amber-400 text-amber-500' : ''} /></Button></div></article>)}</section>
            <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>{l.previous}</Button><span>{page} / {Math.max(1, Math.ceil(data.total / 24))}</span><Button variant="outline" disabled={page * 24 >= data.total} onClick={() => setPage(n => n + 1)}>{l.nextPage}</Button></div>
            <Dialog open={detail?.owner === owner} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{l.view}</DialogTitle></DialogHeader>{detail?.owner === owner && <WordCard key={detail.word.id} word={detail.word} accent={data.settings.accent} />}</DialogContent></Dialog>
        </>}
        <p className="text-xs text-muted-foreground"><a href="https://github.com/designfuchen/word-atlas" target="_blank" rel="noreferrer">{l.source}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
    </main>;
}
