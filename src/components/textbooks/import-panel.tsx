'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { vocabularyRequest, VocabularyRequestError } from '@/components/vocabulary/client';
import { parseTextbookFile, textbookTemplate } from '@/lib/textbooks/import-file';
import type { ImportRow } from '@/lib/textbooks/schema';
interface Preview { revision: number; rows: ImportRow[]; issues: { row: number; field: string }[]; totalIssues: number; summary: { newUnits: number; added: number; updated: number; skipped: number; noAtlas: number } }
interface Props { bookId: string; onChanged: () => void }
export function TextbookImport({ bookId, onChanged }: Props) {
    const { t } = useLanguage(), l = t.textbooks;
    const [text, setText] = useState(''), [format, setFormat] = useState<'csv' | 'tsv' | 'json'>('csv'), [mode, setMode] = useState<'skip' | 'update'>('skip');
    const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    function template() { const url = URL.createObjectURL(new Blob([textbookTemplate()], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'textbook-import.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    async function inspect() {
        setBusy(true); setMessage(''); setPreview(null);
        try { const rows = parseTextbookFile(text, format); setPreview(await vocabularyRequest<Preview>(`/api/textbooks/${bookId}/import`, { action: 'preview', rows, mode })); }
        catch { setMessage(l.invalidFile); } finally { setBusy(false); }
    }
    async function commit() {
        if (!preview || preview.totalIssues) return; setBusy(true); setMessage('');
        try { await vocabularyRequest(`/api/textbooks/${bookId}/import`, { action: 'commit', revision: preview.revision, rows: preview.rows, mode }); setPreview(null); setMessage(l.imported); onChanged(); }
        catch (e) { setMessage(e instanceof VocabularyRequestError && e.status === 409 ? l.conflict : l.failure); } finally { setBusy(false); }
    }
    return <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="text-xl font-bold">{l.importTitle}</h2><p className="text-sm leading-relaxed text-muted-foreground">{l.importHelp}</p>
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={template}>{l.template}</Button><label className="text-sm">{l.file}<input aria-label={l.file} className="mt-1 block max-w-full" type="file" accept=".csv,.tsv,.json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setPreview(null); if (file.size > 2_000_000) { setMessage(l.invalidFile); return; } try { setText(await file.text()); setFormat(file.name.toLowerCase().endsWith('.json') ? 'json' : file.name.toLowerCase().endsWith('.tsv') ? 'tsv' : 'csv'); setMessage(''); } catch { setMessage(l.invalidFile); } }} /></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{l.format}<select aria-label={l.format} className="ml-2 min-h-11 rounded-xl border bg-background px-3" value={format} onChange={e => { setFormat(e.target.value as typeof format); setPreview(null); }}>{['csv', 'tsv', 'json'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label><label className="text-sm">{l.mode}<select aria-label={l.mode} className="ml-2 min-h-11 rounded-xl border bg-background px-3" value={mode} onChange={e => { setMode(e.target.value as typeof mode); setPreview(null); }}><option value="skip">{l.skip}</option><option value="update">{l.update}</option></select></label></div>
        <Textarea aria-label={l.input} placeholder={l.input} rows={7} value={text} onChange={e => { setText(e.target.value); setPreview(null); }} /><Button disabled={busy || !text.trim()} onClick={inspect}>{l.preview}</Button>
        {message && <p role="status" className="text-sm">{message}</p>}
        {preview && <div className="space-y-3"><p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950 dark:text-sky-100">{l.summary}：{Object.values(preview.summary).join(' / ')}</p>{preview.totalIssues > 0 && <div role="alert" className="text-sm text-destructive"><p>{l.importErrors}（{preview.totalIssues}）</p>{preview.issues.map((i, n) => <p key={n}>{l.row} {i.row} · {i.field}</p>)}</div>}<div className="max-h-96 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr>{[l.unitCode, l.word, l.meaning].map(s => <th key={s} className="p-2">{s}</th>)}</tr></thead><tbody>{preview.rows.map((row, i) => <tr key={i} className="border-t"><td className="p-2">{row.unitCode}</td><td className="p-2">{row.word}</td><td className="p-2">{row.meaning}</td></tr>)}</tbody></table></div><Button disabled={busy || preview.totalIssues > 0} onClick={commit}>{l.commit}</Button></div>}
    </section>;
}
