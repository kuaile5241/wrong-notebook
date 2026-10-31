import type { Dependency, Topic } from './types';
export interface KnowledgeTopic extends Topic { volumeName: string }
export interface Standard { id: string; text: string; text_status?: string; note?: string; page_or_ref?: string; sourceTitle?: string }
export interface KnowledgeData { revision: string; subjects: Record<string, string>; topics: KnowledgeTopic[]; dependencies: Dependency[]; standards: Standard[]; names: Record<string, { name: string; subject: string }>; aliases: Record<string, { targets?: string[] } | string[]> }
export function localKnowledgeGraph(topics: Topic[], dependencies: Dependency[], selected: string, depth: number) {
    const byId = new Map(topics.map(t => [t.id, t])), levels = new Map<string, number>(selected === '*' ? topics.map(t => [t.id, 0] as [string, number]) : [[selected, 0]]); let front = selected === '*' ? [] : [selected];
    if (selected === '*') {
        const degree = new Map(topics.map(t => [t.id, 0])); for (const d of dependencies) if (byId.has(d.topicId) && byId.has(d.prerequisiteId)) degree.set(d.topicId, degree.get(d.topicId)! + 1);
        const queue = topics.filter(t => !degree.get(t.id)).map(t => t.id), visited = new Set<string>();
        while (queue.length) { const id = queue.shift()!; visited.add(id); for (const edge of dependencies.filter(d => d.prerequisiteId === id && byId.has(d.topicId))) { levels.set(edge.topicId, Math.max(levels.get(edge.topicId)!, levels.get(id)! + 1)); degree.set(edge.topicId, degree.get(edge.topicId)! - 1); if (!degree.get(edge.topicId)) queue.push(edge.topicId); } }
        const last = Math.max(0, ...levels.values()) + 1; for (const topic of topics) if (!visited.has(topic.id)) levels.set(topic.id, last);
    }
    for (let step = 1; front.length && step <= depth && step <= topics.length; step++) {
        const next: string[] = [];
        for (const edge of dependencies) if (front.includes(edge.topicId) && byId.has(edge.prerequisiteId) && !levels.has(edge.prerequisiteId)) { levels.set(edge.prerequisiteId, -step); next.push(edge.prerequisiteId); }
        front = next;
    }
    for (const edge of dependencies) if (edge.prerequisiteId === selected && byId.has(edge.topicId) && !levels.has(edge.topicId)) levels.set(edge.topicId, 1);
    const rows = new Map<number, string[]>(); for (const [id, level] of levels) { if (!byId.has(id)) continue; rows.set(level, [...(rows.get(level) ?? []), id]); }
    const sorted = [...rows.keys()].sort((a, b) => a - b), width = Math.max(480, ...[...rows.values()].map(r => r.length * 190 + 40)), height = Math.max(360, sorted.length * 110 + 50);
    const nodes = sorted.flatMap((level, row) => rows.get(level)!.map((id, i, arr) => ({ ...byId.get(id)!, x: width / 2 + (i - (arr.length - 1) / 2) * 190, y: 60 + row * 110 })));
    return { nodes, edges: dependencies.filter(d => levels.has(d.topicId) && levels.has(d.prerequisiteId)), width, height };
}
