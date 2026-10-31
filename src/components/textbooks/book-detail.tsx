'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { vocabularyRequest, VocabularyRequestError } from '@/components/vocabulary/client';
import { WordCard } from '@/components/vocabulary/word-card';
import type { VocabularySettings, WordEntry } from '@/lib/vocabulary/catalog';
import { BookForm } from './book-form';
import { UnitEditor, TermEditor } from './editors';
import { TextbookImport } from './import-panel';
import type { BookView, UnitView, TermView } from './types';
interface Props { id: string; manage?: boolean; initialUnit?: string }
export function TextbookDetail({ id, manage = false, initialUnit = '' }: Props) {
    const { t } = useLanguage(), l = t.textbooks, router = useRouter(), { data: session } = useSession(), owner = session?.user?.id ?? '';
    const [stored, setStored] = useState<{ owner: string; book: BookView; canManage: boolean } | null>(null), [refresh, setRefresh] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState(initialUnit), [unitEdit, setUnitEdit] = useState<UnitView | 'new' | null>(null), [termEdit, setTermEdit] = useState<TermView | 'new' | null>(null);
    const [card, setCard] = useState<{ owner: string; word: WordEntry & { media: number } } | null>(null);
    const data = stored?.owner === owner && stored.book.id === id ? stored : null, book = data?.book, editing = !!(manage && data?.canManage);
    const unit = book?.units.find(u => u.id === selected) ?? book?.units[0];
    useEffect(() => {
        if (!owner) return; let cancelled = false;
        vocabularyRequest<{ book: BookView; canManage: boolean }>(`/api/textbooks/${id}?manage=${manage}`).then(value => { if (!cancelled) { setStored({ owner, ...value }); setError(''); } }).catch(() => { if (!cancelled) setError(l.failure); });
        return () => { cancelled = true; };
    }, [id, owner, manage, refresh, l.failure]);
    function reload() { setRefresh(n => n + 1); }
    async function save(path: string, body: unknown) {
        setBusy(true); setError('');
        try { await vocabularyRequest(path, body); setUnitEdit(null); setTermEdit(null); reload(); }
        catch (e) { setError(e instanceof VocabularyRequestError && e.status === 409 ? l.conflict : l.failure); }
        finally { setBusy(false); }
    }
    async function study(unitId: string) {
        setBusy(true); setError('');
        try { const account = await vocabularyRequest<{ settings: VocabularySettings }>('/api/vocabulary'); await vocabularyRequest('/api/vocabulary/preferences', { ...account.settings, bookId: id, unitId, level: 'all', topic: '' }); router.push('/words'); }
        catch { setError(l.failure); } finally { setBusy(false); }
    }
    async function show(term: TermView) {
        setBusy(true); try { const result = await vocabularyRequest<{ word: WordEntry & { media: number } }>('/api/vocabulary/words/tb-' + term.id); setCard({ owner, word: result.word }); }
        catch { setError(l.failure); } finally { setBusy(false); }
    }
    return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-8">
        <Link href={manage ? '/admin/textbooks' : '/books'} className="text-primary">← {l.back}</Link>
        {error && <p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={reload}>{l.retry}</Button></p>}
        {!book ? <p>{l.loading}</p> : <>
            <header className="space-y-3 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-100 via-emerald-50 to-violet-100 p-6 text-slate-900 dark:border-sky-900 dark:from-sky-950 dark:via-slate-950 dark:to-violet-950 dark:text-slate-100"><h1 className="text-2xl font-bold sm:text-3xl">{book.title}</h1><p>{book.publisher} · {book.edition}</p><p className="text-sm">{l[book.stage]} · {l.gradeNames[book.grade - 1]} · {book.volume} · {book.isbn}</p><div className="flex flex-wrap gap-3">{book.sourceUrl && <a className="text-primary underline" href={book.sourceUrl} target="_blank" rel="noreferrer">{l.source}</a>}{data?.canManage && <Link className="text-primary underline" href={editing ? '/books/' + id : '/admin/textbooks/' + id}>{editing ? l.open : l.manage}</Link>}{!editing && book.subject === 'english' && <Button disabled={busy} onClick={() => void study('')}>{l.study}</Button>}</div></header>
            {!!book.verificationNote && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{book.verificationNote}</p>}
            {editing && <><details className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer text-lg font-bold">{l.metadata} · {book.archived ? l.archived : book.published ? l.published : l.draft}</summary><div className="mt-4"><BookForm key={book.revision} initial={book} canPublish={book.units.some(u => !u.archived)} busy={busy} onSave={value => save(`/api/textbooks/${id}`, { ...value, revision: book.revision })} /></div></details><TextbookImport bookId={id} onChanged={reload} /></>}
            <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{l.units}（{book.units.length}）</h2>{editing && <Button disabled={busy} variant="outline" onClick={() => setUnitEdit('new')}>{l.addUnit}</Button>}</div><div className="flex flex-wrap gap-2">{book.units.map(u => <Button key={u.id} className="h-auto min-h-11 whitespace-normal text-left" variant={u.id === unit?.id ? 'default' : 'outline'} aria-pressed={u.id === unit?.id} onClick={() => setSelected(u.id)}>{u.code} {u.title}{u.archived ? ` · ${l.archived}` : ''}</Button>)}</div></section>
            {unit && <section className="space-y-4 rounded-2xl border bg-card p-5"><p className="text-sm text-primary">{unit.moduleTitle} · {unit.pageReference}</p><h2 className="text-2xl font-bold">{unit.code} {unit.title}</h2>{unit.notes && <p className="text-sm leading-relaxed text-muted-foreground">{unit.notes}</p>}<div className="flex flex-wrap gap-2">{editing ? <><Button disabled={busy} variant="outline" onClick={() => setUnitEdit(unit)}>{l.edit} {l.units}</Button><Button disabled={busy} onClick={() => setTermEdit('new')}>{l.addTerm}</Button></> : book.subject === 'english' && <Button disabled={busy} onClick={() => void study(unit.id)}>{l.studyUnit}</Button>}{unit.courseUrl && <Button asChild variant="outline"><a href={unit.courseUrl} target="_blank" rel="noreferrer">{l.course}</a></Button>}</div>
                <p className="text-sm text-muted-foreground">{l.audioHint}</p><div className="grid gap-3 sm:grid-cols-2">{!unit.terms.length && <p>{l.emptyUnit}</p>}{unit.terms.map(term => <article key={term.id} className={`space-y-2 rounded-xl border border-violet-100 p-4 dark:border-violet-900 ${term.archived ? 'opacity-50' : ''}`}><h3 className="text-lg font-bold">{term.word}</h3><p>{term.meaning}</p><p className="text-xs text-muted-foreground">{term.verified ? l.checked : l.unchecked}{term.archived ? ` · ${l.archived}` : ''}</p>{editing ? <Button disabled={busy} size="sm" variant="outline" onClick={() => setTermEdit(term)}>{l.edit}</Button> : <Button disabled={busy} size="sm" variant="outline" onClick={() => void show(term)}>{t.vocabulary.view}</Button>}</article>)}</div>
            </section>}
            <Dialog open={unitEdit !== null && editing} onOpenChange={open => { if (!open) setUnitEdit(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{unitEdit === 'new' ? l.addUnit : l.edit}</DialogTitle></DialogHeader>{unitEdit && <UnitEditor key={`${unitEdit === 'new' ? 'new' : unitEdit.id}:${book.revision}`} initial={unitEdit === 'new' ? undefined : unitEdit} busy={busy} onSave={value => save(`/api/textbooks/${id}/units`, { ...value, revision: book.revision })} />}</DialogContent></Dialog>
            <Dialog open={termEdit !== null && editing} onOpenChange={open => { if (!open) setTermEdit(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{termEdit === 'new' ? l.addTerm : l.edit}</DialogTitle></DialogHeader>{termEdit && unit && <TermEditor key={`${termEdit === 'new' ? 'new' : termEdit.id}:${book.revision}`} initial={termEdit === 'new' ? undefined : termEdit} unitId={unit.id} busy={busy} onSave={value => save(`/api/textbooks/${id}/terms`, { ...value, revision: book.revision })} />}</DialogContent></Dialog>
            <Dialog open={card?.owner === owner} onOpenChange={open => { if (!open) setCard(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{t.vocabulary.view}</DialogTitle></DialogHeader>{card?.owner === owner && <WordCard key={card.word.id} word={card.word} accent="uk" />}</DialogContent></Dialog>
        </>}
    </main>;
}
