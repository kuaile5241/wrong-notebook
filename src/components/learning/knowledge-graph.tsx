'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { localKnowledgeGraph } from '@/lib/learning/knowledge';
import type { Dependency, Topic } from '@/lib/learning/types';
export function KnowledgeGraph({ topics, dependencies, selected, depth, onSelect }: { topics: Topic[]; dependencies: Dependency[]; selected: string; depth: number; onSelect: (id: string) => void }) {
    const { t } = useLanguage(), l = t.knowledge, svg = useRef<SVGSVGElement>(null), drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
    const [view, setView] = useState({ x: 0, y: 0, scale: 1 }), map = localKnowledgeGraph(topics, dependencies, selected, depth);
    useEffect(() => {
        const element = svg.current; if (!element) return;
        const wheel = (e: WheelEvent) => { e.preventDefault(); setView(v => ({ ...v, scale: Math.min(5, Math.max(0.15, v.scale * (e.deltaY > 0 ? 0.85 : 1.15))) })); };
        element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
    }, []);
    const zoom = (factor: number) => setView(v => ({ ...v, scale: Math.min(5, Math.max(0.15, v.scale * factor)) }));
    return <section className="min-w-0 space-y-3 rounded-2xl border bg-slate-50 p-3 dark:bg-slate-950" aria-label={l.graph}>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => zoom(0.8)}>{l.zoomOut}</Button><Button size="sm" variant="outline" onClick={() => zoom(1.25)}>{l.zoomIn}</Button><Button size="sm" variant="outline" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>{l.fit}</Button></div>
        <svg ref={svg} className="h-[440px] w-full touch-none rounded-xl border bg-background lg:h-[560px]" role="img" aria-label={l.graph} viewBox={`${view.x} ${view.y} ${map.width / view.scale} ${map.height / view.scale}`}
            onPointerDown={e => { if ((e.target as Element).closest('[data-topic]')) { drag.current = null; return; } drag.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={e => { const d = drag.current; if (!d || !e.buttons) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.moved ||= Math.abs(dx) + Math.abs(dy) > 3; d.x = e.clientX; d.y = e.clientY; const ratio = map.width / Math.max(1, e.currentTarget.clientWidth) / view.scale; setView(v => ({ ...v, x: v.x - dx * ratio, y: v.y - dy * ratio })); }}
            onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setTimeout(() => { drag.current = null; }, 0); }}>
            <defs><marker id="knowledge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>
            {map.edges.map(edge => { const a = map.nodes.find(n => n.id === edge.prerequisiteId)!, b = map.nodes.find(n => n.id === edge.topicId)!; return <path key={`${edge.topicId}:${edge.prerequisiteId}`} d={`M ${a.x} ${a.y + 22} L ${b.x} ${b.y - 22}`} stroke={edge.strength === 'hard' ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeDasharray={edge.strength === 'soft' ? '7 5' : undefined} fill="none" markerEnd="url(#knowledge-arrow)"><title>{edge.reason}</title></path>; })}
            {map.nodes.map(node => <g key={node.id} data-topic={node.id} role="button" tabIndex={0} aria-label={node.name} aria-pressed={node.id === selected} className="cursor-pointer" onClick={() => { if (!drag.current?.moved) { onSelect(node.id); setView({ x: 0, y: 0, scale: 1 }); } }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id); setView({ x: 0, y: 0, scale: 1 }); } }}>
                <title>{node.name}</title><rect x={node.x - 82} y={node.y - 22} width="164" height="44" rx="10" fill={node.grade <= 6 ? '#d1fae5' : node.grade <= 9 ? '#dbeafe' : '#fae8ff'} stroke={node.id === selected ? '#f97316' : node.grade <= 6 ? '#059669' : node.grade <= 9 ? '#2563eb' : '#a21caf'} strokeWidth={node.id === selected ? 4 : 2} /><text x={node.x} y={node.y + 5} textAnchor="middle" fill="#0f172a" fontSize="13">{Array.from(node.name).slice(0, 11).join('')}{Array.from(node.name).length > 11 ? '…' : ''}</text>
            </g>)}
        </svg><div className="flex flex-wrap gap-3 text-xs"><span className="text-emerald-600">● {l.primary}</span><span className="text-blue-600">● {l.junior}</span><span className="text-fuchsia-600">● {l.senior}</span><span className="text-orange-600">● {l.current}</span></div><p className="text-xs text-muted-foreground">{map.nodes.length} {l.nodes} · {map.edges.length} {l.edges} · {l.hard} · {l.soft}</p>
    </section>;
}
