'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LearningView, Topic } from '@/lib/learning/types';
import { learningRequest } from './client';
import { LearningAttribution } from './attribution';

interface CatalogView {
    subjects: { key: string; name: string; topics: number }[]; volumes: { key: string; name: string }[];
    volume: string; chapters: string[]; topics: Topic[]; total: number;
    recent: { id: string; title: string; mode: string; status: string; updatedAt: string }[];
}
export function TopicBrowser({ initialSearch = '' }: { initialSearch?: string }) {
    const { t } = useLanguage(), l = t.learning, router = useRouter();
    const [subject, setSubject] = useState('math'), [volume, setVolume] = useState(''), [chapter, setChapter] = useState('');
    const [search, setSearch] = useState(initialSearch), [query, setQuery] = useState(initialSearch), [count, setCount] = useState(10);
    const [data, setData] = useState<CatalogView | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
    useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
    useEffect(() => {
        let cancelled = false;
        const p = new URLSearchParams({ subject, volume, chapter, search: query });
        learningRequest<CatalogView>(`/api/learning?${p}`).then(value => { if (!cancelled) { setData(value); setError(''); } }).catch(() => { if (!cancelled) setError(l.failure); });
        return () => { cancelled = true; };
    }, [subject, volume, chapter, query, refresh, l.failure]);
    async function start(topicIds: string[], mode: string) {
        setBusy(true); setError('');
        try { const view = await learningRequest<LearningView>('/api/learning', { topicIds, mode, count }); router.push(`/learn/${view.id}`); }
        catch { setError(l.failure); setBusy(false); }
    }
    const selectClass = 'min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm';
    return <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8">
        <header className="rounded-3xl border border-primary/15 bg-gradient-to-br from-violet-100 via-sky-50 to-emerald-100 p-6 text-slate-900 dark:from-violet-950 dark:via-slate-900 dark:to-emerald-950 dark:text-slate-100">
            <div className="mb-3 flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" />{l.subtitle}</div>
            <h1 className="text-3xl font-bold">{l.title}</h1><p className="mt-3 max-w-2xl leading-relaxed">{l.intro}</p>
        </header>
        <LearningAttribution />
        <section className="space-y-4 rounded-2xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">{l.subject}<select aria-label={l.subject} className={selectClass} value={subject} onChange={e => { setSubject(e.target.value); setVolume(''); setChapter(''); setSearch(''); }}>{(data?.subjects ?? [{ key: 'math', name: '数学', topics: 870 }]).map(s => <option key={s.key} value={s.key}>{s.name} · {s.topics}</option>)}</select></label>
                <label className="space-y-1 text-sm">{l.volume}<select aria-label={l.volume} className={selectClass} value={volume || data?.volume || ''} onChange={e => { setVolume(e.target.value); setChapter(''); }}>{data?.volumes.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}</select></label>
                <label className="space-y-1 text-sm">{l.count}<select aria-label={l.count} className={selectClass} value={count} onChange={e => setCount(Number(e.target.value))}>{[5, 10, 20, 30].map(n => <option key={n}>{n}</option>)}</select></label>
            </div>
            <Input aria-label={l.search} placeholder={l.search} value={search} onChange={e => setSearch(e.target.value)} />
            {!query && <div className="flex flex-wrap gap-2">{['', ...(data?.chapters ?? [])].map(c => <Button key={c} size="sm" variant={chapter === c ? 'default' : 'outline'} className="h-auto min-h-10 max-w-full whitespace-normal text-left" onClick={() => setChapter(c)}>{c || l.all}</Button>)}</div>}
            {chapter && !query && <div className="flex flex-wrap gap-2"><Button disabled={busy || !data?.topics.length} onClick={() => start(data!.topics.map(t => t.id), 'practice')}>{l.chapterPractice}</Button><Button variant="outline" disabled={busy || !data?.topics.length} onClick={() => start(data!.topics.map(t => t.id), 'diagnose')}>{l.chapterDiagnose}</Button></div>}
        </section>
        {error && <p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={() => setRefresh(n => n + 1)}>{l.retry}</Button></p>}
        {!data ? <p>{l.loading}</p> : <section className="grid gap-3 sm:grid-cols-2">
            {!data.topics.length && <p>{l.empty}</p>}
            {data.topics.map(topic => <article key={topic.id} className="flex flex-col rounded-2xl border-2 border-sky-100 bg-card p-5 shadow-sm dark:border-sky-900">
                <div className="mb-2 flex items-center gap-2 text-primary"><BookOpen className="h-4 w-4" /><span className="text-xs">{topic.chapter}</span></div>
                <h2 className="text-lg font-semibold">{topic.name}</h2><p className="my-3 flex-1 text-sm leading-relaxed text-muted-foreground">{topic.description}</p>
                {!!topic.prerequisites?.length && <details className="mb-3 text-sm"><summary className="cursor-pointer text-primary">{l.prerequisites}</summary><div className="mt-2 flex flex-wrap gap-2">{topic.prerequisites.map(p => <Button key={p.id} variant="outline" size="sm" className="h-auto min-h-10 whitespace-normal" disabled={busy} onClick={() => start([p.id], 'practice')}>{p.name} · {p.strength === 'hard' ? l.required : l.suggested}</Button>)}</div></details>}
                <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => start([topic.id], 'practice')}>{l.practice}</Button><Button disabled={busy} variant="outline" onClick={() => start([topic.id], 'diagnose')}>{l.diagnose}</Button></div>
            </article>)}
            {data.total > 100 && <p>{l.more}</p>}
        </section>}
        {!!data?.recent.length && <section className="space-y-3"><h2 className="text-xl font-bold">{l.recent}</h2>{data.recent.map(s => <Link key={s.id} href={`/learn/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"><span className="min-w-0 break-words">{s.title}<span className="ml-2 text-xs text-muted-foreground">{s.mode === 'diagnose' ? l.diagnose : l.practice}</span></span><span className="shrink-0 text-sm text-primary">{s.status === 'active' ? l.active : l.completed} →</span></Link>)}</section>}
    </main>;
}
