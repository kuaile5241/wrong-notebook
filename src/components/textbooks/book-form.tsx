'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TextbookInput } from '@/lib/textbooks/schema';
interface Props { initial?: TextbookInput; busy: boolean; canPublish?: boolean; onSave: (book: TextbookInput) => Promise<void> }
export const blankBook: TextbookInput = { title: '', subject: 'english', stage: 'primary', grade: 3, volume: '上册', publisher: '', edition: '', isbn: '', sourceTitle: '', sourceUrl: '', verificationNote: '', published: false, archived: false };
export function BookForm({ initial, busy, canPublish = false, onSave }: Props) {
    const { t } = useLanguage(), l = t.textbooks, [value, setValue] = useState(initial ?? blankBook);
    const field = (key: keyof TextbookInput, label: string, required = false) => <label className="space-y-1 text-sm">{label}<Input aria-label={label} required={required} value={String(value[key])} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} /></label>;
    return <form className="space-y-4" onSubmit={e => { e.preventDefault(); void onSave(value); }}>
        <div className="grid gap-3 sm:grid-cols-2">{field('title', l.bookTitle, true)}
            <label className="space-y-1 text-sm">{l.subject}<select aria-label={l.subject} className="min-h-11 w-full rounded-xl border bg-background px-3" value={value.subject} onChange={e => setValue(v => ({ ...v, subject: e.target.value as TextbookInput['subject'] }))}>{['english', 'math', 'chinese', 'science', 'morality', 'physics', 'history', 'chemistry', 'biology'].map(key => <option key={key} value={key}>{l[key as 'english']}</option>)}</select></label>
            <label className="space-y-1 text-sm">{l.stage}<select aria-label={l.stage} className="min-h-11 w-full rounded-xl border bg-background px-3" value={value.stage} onChange={e => setValue(v => ({ ...v, stage: e.target.value as TextbookInput['stage'], grade: e.target.value === 'primary' ? 3 : e.target.value === 'junior_high' ? 7 : 10 }))}>{['primary', 'junior_high', 'senior_high'].map(key => <option key={key} value={key}>{l[key as 'primary']}</option>)}</select></label>
            <label className="space-y-1 text-sm">{l.grade}<select aria-label={l.grade} className="min-h-11 w-full rounded-xl border bg-background px-3" value={value.grade} onChange={e => setValue(v => ({ ...v, grade: Number(e.target.value) }))}>{(value.stage === 'primary' ? [1, 2, 3, 4, 5, 6] : value.stage === 'junior_high' ? [7, 8, 9] : [10, 11, 12]).map(n => <option key={n} value={n}>{l.gradeNames[n - 1]}</option>)}</select></label>
            {field('volume', l.volume, true)}{field('publisher', l.publisher, true)}{field('edition', l.edition, true)}{field('isbn', l.isbn)}{field('sourceTitle', l.sourceTitle)}{field('sourceUrl', l.sourceUrl)}
        </div>
        <label className="block space-y-1 text-sm">{l.verificationNote}<Textarea aria-label={l.verificationNote} value={value.verificationNote} onChange={e => setValue(v => ({ ...v, verificationNote: e.target.value }))} /></label>
        {initial && <div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" disabled={!canPublish} checked={value.published} onChange={e => setValue(v => ({ ...v, published: e.target.checked }))} /> {l.publish}</label><label><input type="checkbox" checked={value.archived} onChange={e => setValue(v => ({ ...v, archived: e.target.checked }))} /> {l.archive}</label></div>}
        <Button type="submit" disabled={busy}>{l.save}</Button>
    </form>;
}
