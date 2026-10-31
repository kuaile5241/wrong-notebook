'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LearningView } from '@/lib/learning/types';
import { KnowledgeGraph } from './knowledge-graph';
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function LearningReport({ view, busy, action, restart }: { view: LearningView; busy: boolean; action: (body: Record<string, unknown>) => void; restart: () => void }) {
    const { t } = useLanguage(), l = t.learning, router = useRouter(), report = view.report, names = new Map([...Object.entries(view.relatedNames ?? {}), ...view.topics.map(p => [p.id, p.name] as [string, string])]);
    const name = (id: string) => names.get(id) ?? id;
    function share() {
        const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 1250; const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.fillStyle = '#f0f9ff'; ctx.fillRect(0, 0, 1100, 1250); ctx.fillStyle = '#0f172a'; ctx.font = 'bold 38px sans-serif'; ctx.fillText(view.title.slice(0, 24), 55, 75);
        const lines = [l.result, `${l.progress}: ${view.answered} / ${view.limit}`, `${l.weak}: ${report?.weak.length ?? 0}   ${l.shaky}: ${report?.shaky.length ?? 0}   ${l.untested}: ${report?.untested.length ?? 0}`, l.roots, ...(report?.roots.slice(0, 8).map(r => name(r.id)) ?? []), l.path, ...(report?.path.slice(0, 10).map((p, i) => `${i + 1}. ${name(p.id)}`) ?? []), l.diagnosisHint];
        ctx.font = '25px sans-serif'; let y = 135; for (const line of lines) { const chars = Array.from(line); for (let i = 0; i < chars.length; i += 35) { if (y > 1190) break; ctx.fillText(chars.slice(i, i + 35).join(''), 55, y); y += 36; } y += 8; }
        canvas.toBlob(blob => { if (blob) download(blob, 'learning-report.png'); }, 'image/png');
    }
    return <section className="space-y-5" aria-label={l.result}>
        <div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" onClick={() => window.print()}>{l.print}</Button><Button variant="outline" onClick={() => download(new Blob([JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), ...view }, null, 2)], { type: 'application/json' }), 'learning-report.json')}>{l.exportReport}</Button><Button variant="outline" onClick={share}>{l.shareImage}</Button><Button disabled={busy} variant="outline" onClick={restart}>{l.restart}</Button>{!!view.history.length && <Button disabled={busy} variant="outline" onClick={() => action({ action: 'undo' })}>{l.undo}</Button>}</div>
        {report && <><h3 className="text-lg font-bold">{l.reportStats}</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[[l.progress, report.asked], [l.weak, report.weak.length], [l.shaky, report.shaky.length], [l.mastered, report.mastered.length], [l.untested, report.untested.length]].map(([label, n]) => <div key={label} className="rounded-xl border bg-sky-50 p-3 text-sky-950 dark:bg-sky-950 dark:text-sky-100"><strong className="text-2xl">{n}</strong><p className="text-sm">{label}</p></div>)}</div><p className="text-sm text-muted-foreground">{l.diagnosisHint}</p>
            {report.limitReached && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><p>{l.rootNotice}</p>{view.limit < 60 && <Button disabled={busy} onClick={() => action({ action: 'extend' })}>{l.extend}</Button>}</div>}
            <section className="space-y-3"><h3 className="text-xl font-bold">{l.roots}</h3>{report.roots.map(root => <article key={root.id} className="space-y-2 rounded-xl border border-orange-200 p-3"><Link className="font-bold text-primary underline" href={'/knowledge?id=' + root.id}>{name(root.id)}</Link>{!!root.pendingPrereqs.length && <p className="text-sm">{l.rootNotice} {root.pendingPrereqs.map(name).join('、')}</p>}{!!root.outOfScopePrereqs.length && <p className="text-sm">{l.outside} {root.outOfScopePrereqs.map(name).join('、')}</p>}{!!root.externalPrereqs.length && <p className="text-sm">{l.untested}：{root.externalPrereqs.map(name).join('、')}</p>}</article>)}</section>
            <details className="rounded-xl border p-3" open><summary className="cursor-pointer text-lg font-bold">{l.chapters}</summary><div className="space-y-2 pt-3">{report.chapters.map(ch => <div key={ch.key} className="rounded-lg bg-muted p-3 text-sm"><strong>{ch.label}</strong><p>{l.weak} {ch.weak} · {l.shaky} {ch.shaky} · {l.mastered} {ch.mastered} · {l.untested} {ch.untested} / {ch.total}</p></div>)}</div></details>
            <section className="space-y-3"><h3 className="text-xl font-bold">{l.path}</h3><ol className="list-inside list-decimal space-y-2">{report.path.map(p => <li key={p.id}><Link href={'/knowledge?id=' + p.id} className="text-primary underline">{name(p.id)}</Link> · {p.isRoot ? l.roots : p.status === 'shaky' ? l.shaky : l.weak}</li>)}</ol>{!!view.network?.topics.length && <KnowledgeGraph topics={view.network.topics} dependencies={view.network.dependencies} selected="*" depth={9999} onSelect={id => router.push('/knowledge?id=' + id)} />}</section>
            <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{l.result} · {view.topics.length}</summary><div className="grid gap-2 pt-3 sm:grid-cols-2">{view.topics.map(topic => <Link href={'/knowledge?id=' + topic.id} key={topic.id} className="rounded-xl border p-3"><strong>{topic.name}</strong><p className="text-sm">{l[topic.status]}</p></Link>)}</div></details>
        </>}
    </section>;
}
