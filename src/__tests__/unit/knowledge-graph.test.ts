// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCatalog } from '@/lib/learning/catalog';
import { localKnowledgeGraph } from '@/lib/learning/knowledge';
describe('完整知识图谱', () => {
    it('准确复现用户截图导数的概念：向上两层、下游一层，共六节点五条边', () => {
        const c = getCatalog(), map = localKnowledgeGraph(c.topics, c.dependencies, 'cnm_h217', 2);
        expect(map.nodes.map(n => n.id).sort()).toEqual(['cnm_h215', 'cnm_h216', 'cnm_h217', 'cnm_h218', 'cnm_h219', 'cnm_h221']); expect(map.edges).toHaveLength(5);
        const row = map.nodes.filter(n => n.id !== 'cnm_h217' && n.y > map.nodes.find(n => n.id === 'cnm_h217')!.y).sort((a, b) => a.x - b.x);
        for (let i = 1; i < row.length; i++) expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(190);
        expect(map.nodes.find(n => n.id === 'cnm_h215')!.y).toBeLessThan(map.nodes.find(n => n.id === 'cnm_h217')!.y);
    });
    it('全层图不裁100条，保留软硬边；所有课标引用都能找到条文，待答答案未混入知识详情', () => {
        const c = getCatalog(), standards = JSON.parse(readFileSync(join(process.cwd(), 'resources/learning/standards.json'), 'utf8')) as { id: string }[], ids = new Set(standards.map(s => s.id));
        for (const topic of c.topics) { for (const ref of topic.standards ?? []) expect(ids.has(ref.id), ref.id).toBe(true); expect(topic).not.toHaveProperty('diagnostic_question'); }
        const map = localKnowledgeGraph(c.topics, c.dependencies, '*', 9999); expect(map.nodes).toHaveLength(c.topics.length); expect(map.edges).toHaveLength(c.dependencies.length); expect(map.edges.some(e => e.strength === 'soft')).toBe(true);
        expect(c.byId.get('cnm_h217')).toMatchObject({ domain: '数与代数', type: 'conceptual' });
    });
});
