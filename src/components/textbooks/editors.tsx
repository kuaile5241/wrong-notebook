'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import type { UnitView, TermView } from './types';
interface UnitProps { initial?: UnitView; busy: boolean; onSave: (value: Omit<UnitView, 'terms' | 'id'> & { id?: string }) => Promise<void> }
export function UnitEditor({ initial, busy, onSave }: UnitProps) {
    const { t } = useLanguage(), l = t.textbooks;
    const [value, setValue] = useState<Omit<UnitView, 'terms' | 'id'> & { id?: string }>(initial ?? { code: '', title: '', moduleTitle: '', position: 0, pageReference: '', notes: '', courseUrl: '', archived: false });
    const field = (key: 'code' | 'title' | 'moduleTitle' | 'pageReference' | 'courseUrl', label: string, required = false) => <label className="space-y-1 text-sm">{label}<Input aria-label={label} required={required} value={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} /></label>;
    return <form className="space-y-3" onSubmit={e => { e.preventDefault(); void onSave(value); }}><div className="grid gap-3 sm:grid-cols-2">{field('code', l.unitCode, true)}{field('title', l.unitTitle, true)}{field('moduleTitle', l.moduleTitle)}{field('pageReference', l.pages)}{field('courseUrl', l.courseUrl)}<label className="space-y-1 text-sm">{l.position}<Input aria-label={l.position} type="number" min="0" max="10000" value={value.position} onChange={e => setValue(v => ({ ...v, position: Number(e.target.value) }))} /></label></div><label className="block space-y-1 text-sm">{l.notes}<Textarea aria-label={l.notes} value={value.notes} onChange={e => setValue(v => ({ ...v, notes: e.target.value }))} /></label><label className="block text-sm"><input type="checkbox" checked={value.archived} onChange={e => setValue(v => ({ ...v, archived: e.target.checked }))} /> {l.archive}</label><Button type="submit" disabled={busy}>{l.save}</Button></form>;
}
interface TermProps { initial?: TermView; unitId: string; busy: boolean; onSave: (value: Omit<TermView, 'id'> & { id?: string }) => Promise<void> }
export function TermEditor({ initial, unitId, busy, onSave }: TermProps) {
    const { t } = useLanguage(), l = t.textbooks;
    const [value, setValue] = useState<Omit<TermView, 'id'> & { id?: string }>(initial ?? { unitId, word: '', meaning: '', example: '', translation: '', atlasId: '', useAtlasImage: false, position: 0, notes: '', verified: false, archived: false });
    const field = (key: 'word' | 'meaning' | 'example' | 'translation' | 'atlasId', label: string, required = false) => <label className="space-y-1 text-sm">{label}<Input aria-label={label} required={required} value={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} /></label>;
    return <form className="space-y-3" onSubmit={e => { e.preventDefault(); void onSave(value); }}><div className="grid gap-3 sm:grid-cols-2">{field('word', l.word, true)}{field('meaning', l.meaning, true)}{field('example', l.example)}{field('translation', l.translation)}{field('atlasId', l.atlasId)}<label className="space-y-1 text-sm">{l.position}<Input aria-label={l.position} type="number" min="0" max="10000" value={value.position} onChange={e => setValue(v => ({ ...v, position: Number(e.target.value) }))} /></label></div><label className="block space-y-1 text-sm">{l.notes}<Textarea aria-label={l.notes} value={value.notes} onChange={e => setValue(v => ({ ...v, notes: e.target.value }))} /></label><div className="space-y-2 text-sm">{(['useAtlasImage', 'verified', 'archived'] as const).map((key, i) => <label key={key} className="block"><input type="checkbox" checked={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.checked }))} /> {[l.image, l.verified, l.archive][i]}</label>)}</div><Button type="submit" disabled={busy}>{l.save}</Button></form>;
}
