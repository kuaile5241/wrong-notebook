'use client';
import { KnowledgeSample } from './knowledge-sample';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useLanguage } from '@/contexts/LanguageContext';
import type { KnowledgeData, KnowledgeTopic } from '@/lib/learning/knowledge';
export function KnowledgeDetail({ topic, data, busy, start, select }: { topic: KnowledgeTopic; data: KnowledgeData; busy: boolean; start: (ids: string[], mode: string) => void; select: (id: string, subject?: string) => void }) {
    const { t } = useLanguage(), l = t.knowledge;
    const related = (up: boolean) => data.dependencies.filter(d => up ? d.topicId === topic.id : d.prerequisiteId === topic.id).map(d => { const id = up ? d.prerequisiteId : d.topicId; return <li className="space-y-1 rounded-xl border p-3" key={id}><button className="font-semibold text-primary underline" onClick={() => select(id)}>{data.names[id]?.name ?? id}</button><p className="text-xs">{d.strength === 'hard' ? l.hard : l.soft}</p><p className="text-sm">{d.reason}</p></li>; });
    return <aside className="min-w-0 space-y-4 rounded-2xl border bg-card p-4" aria-label={l.detail}>
        <h2 className="text-2xl font-bold">{topic.name}</h2><p className="text-sm text-muted-foreground">{topic.id} · {topic.volumeName}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => start([topic.id], 'diagnose')}>{l.diagnose}</Button><Button disabled={busy} variant="outline" onClick={() => start([topic.id], 'practice')}>{l.sample}</Button></div>
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-3 text-sm"><div><dt>{l.domain}</dt><dd className="font-semibold">{topic.domain || '—'}</dd></div><div><dt>{l.type}</dt><dd>{{ conceptual: l.typeConcept, procedural: l.typeProcedure, application: l.typeApplication }[topic.type || ''] || topic.type || '—'}</dd></div><div className="col-span-2"><dt>{l.chapter}</dt><dd>{topic.chapter}</dd></div></dl>
        <MarkdownRenderer content={topic.description} /><section className="space-y-2"><h3 className="font-bold">{l.criteria}</h3><ul className="list-inside list-disc space-y-1">{topic.mastery_criteria.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
        <section className="space-y-2"><h3 className="font-bold">{l.standards}</h3><p className="text-xs text-muted-foreground">{l.unverified}</p>{(topic.standards ?? []).map(ref => { const standard = data.standards.find(s => s.id === ref.id); return <article className="space-y-2 rounded-xl bg-muted p-3 text-sm" key={ref.id}><strong>{ref.id} · {ref.confidence}</strong><p>{standard?.text ?? ref.note ?? '—'}</p>{standard && <p className="text-xs text-muted-foreground">{standard.sourceTitle} · {standard.page_or_ref} · {standard.text_status} {standard.note}</p>}</article>; })}</section>
        {!!topic.mathLinks?.length && <section className="space-y-2"><h3 className="font-bold">{l.relatedMath}</h3><p className="text-xs text-muted-foreground">{l.crossSubject}</p>{topic.mathLinks.map(link => <p key={link.id}><button className="text-primary underline" onClick={() => select(link.id, 'math')}>{data.names[link.id]?.name ?? link.id}</button> · {link.reason}</p>)}</section>}
        <KnowledgeSample key={topic.id} id={topic.id} />
        <section className="space-y-2"><h3 className="font-bold">{l.prerequisites}</h3><ul className="space-y-2">{related(true)}</ul>{!related(true).length && <p>{l.noEarlier}</p>}</section><section className="space-y-2"><h3 className="font-bold">{l.dependents}</h3><ul className="space-y-2">{related(false)}</ul>{!related(false).length && <p>{l.noLater}</p>}</section>
    </aside>;
}
