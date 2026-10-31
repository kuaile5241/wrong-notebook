'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { vocabularyRequest } from '@/components/vocabulary/client';
import type { TextbookInput } from '@/lib/textbooks/schema';
import { BookForm } from './book-form';
interface ShelfBook extends TextbookInput { id: string; _count: { units: number } }
export function TextbookShelf({ manage = false }: { manage?: boolean }) {
    const { t } = useLanguage(), l = t.textbooks, router = useRouter(), { data: session } = useSession(), owner = session?.user?.id ?? '';
    const [state, setState] = useState<{ owner: string; books: ShelfBook[]; canManage: boolean } | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
    const [search, setSearch] = useState(''), [stage, setStage] = useState('all'), [subject, setSubject] = useState('all');
    const data = state?.owner === owner ? state : null;
    useEffect(() => {
        if (!owner) return; let cancelled = false;
        vocabularyRequest<{ books: ShelfBook[]; canManage: boolean }>(`/api/textbooks?manage=${manage}`).then(result => { if (!cancelled) { setState({ owner, ...result }); setError(''); } }).catch(() => { if (!cancelled) setError(l.failure); });
        return () => { cancelled = true; };
    }, [owner, manage, refresh, l.failure]);
    async function create(book: TextbookInput) { setBusy(true); setError(''); try { const result = await vocabularyRequest<{ id: string }>('/api/textbooks', book); router.push('/admin/textbooks/' + result.id); } catch { setError(l.failure); } finally { setBusy(false); } }
    async function seed() { setBusy(true); setError(''); try { await vocabularyRequest('/api/textbooks/seed', {}); setRefresh(n => n + 1); } catch { setError(l.failure); } finally { setBusy(false); } }
    const books = data?.books.filter(b => (stage === 'all' || b.stage === stage) && (subject === 'all' || b.subject === subject) && `${b.title} ${b.publisher} ${b.edition} ${b.grade} ${b.volume}`.toLowerCase().includes(search.toLowerCase())) ?? [];
    return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-8">
        <header className="space-y-3 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-100 via-sky-50 to-violet-100 p-6 text-slate-900 dark:border-emerald-900 dark:from-emerald-950 dark:via-slate-950 dark:to-violet-950 dark:text-slate-100"><h1 className="text-3xl font-bold">{manage ? l.manage : l.title}</h1><p>{l.intro}</p><div className="flex flex-wrap gap-2"><Link className="text-primary underline" href="/words">{l.freeAtlas}</Link>{data?.canManage && <Link className="text-primary underline" href={manage ? '/books' : '/admin/textbooks'}>{manage ? l.title : l.manage}</Link>}</div></header>
        {error && <p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={() => setRefresh(n => n + 1)}>{l.retry}</Button></p>}
        {manage && data?.canManage && <><details className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer text-lg font-bold">{l.create}</summary><div className="mt-4"><BookForm busy={busy} onSave={create} /></div></details><section className="space-y-2 rounded-2xl border bg-card p-4"><p className="text-sm leading-relaxed">{l.seedHint}</p><Button disabled={busy} variant="outline" onClick={seed}>{l.seed}</Button></section></>}
        <div className="grid gap-3 sm:grid-cols-3"><Input aria-label={l.search} placeholder={l.search} value={search} onChange={e => setSearch(e.target.value)} /><select aria-label={l.stage} className="min-h-11 rounded-xl border bg-background px-3" value={stage} onChange={e => setStage(e.target.value)}>{['all', 'primary', 'junior_high', 'senior_high'].map(key => <option key={key} value={key}>{l[key as 'all']}</option>)}</select><select aria-label={l.subject} className="min-h-11 rounded-xl border bg-background px-3" value={subject} onChange={e => setSubject(e.target.value)}>{['all', 'english', 'math', 'chinese', 'science', 'morality', 'physics', 'history', 'chemistry', 'biology'].map(key => <option key={key} value={key}>{l[key as 'all']}</option>)}</select></div>
        {!data ? <p>{l.loading}</p> : <section className="grid gap-4 sm:grid-cols-2">{!books.length && <p>{l.empty}</p>}{books.map(book => <article key={book.id} className="space-y-3 rounded-2xl border-2 border-sky-100 bg-card p-5 dark:border-sky-900"><BookOpen className="h-8 w-8 text-violet-500" /><h2 className="text-xl font-bold">{book.title}</h2><p className="text-sm">{l[book.stage]} · {l.gradeNames[book.grade - 1]} · {book.volume}</p><p className="text-sm text-muted-foreground">{book.publisher}<br />{book.edition}</p><p className="text-sm">{book._count.units} {l.units}{manage && ` · ${book.archived ? l.archived : book.published ? l.published : l.draft}`}</p><Button asChild><Link href={(manage ? '/admin/textbooks/' : '/books/') + book.id}>{manage ? l.edit : l.open}</Link></Button></article>)}</section>}
    </main>;
}
