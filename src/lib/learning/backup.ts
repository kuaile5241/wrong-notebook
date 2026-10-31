import { z } from 'zod';
import * as Engine from './vendor/engine';
import { COMPATIBLE_DATASET_REVISIONS, getCatalog } from './catalog';
import { applyLearningAnswer, nextLearningQuestion } from './session';
import type { StoredLearning } from './types';

export const learningBackupSchema = z.object({ id: z.string().min(1).max(100), userId: z.string().min(1).max(100),
    title: z.string().max(300), profileId: z.string().max(100).optional(), mode: z.enum(['practice', 'diagnose', 'screen']), datasetVersion: z.string().refine(v => COMPATIBLE_DATASET_REVISIONS.includes(v)),
    state: z.string().max(2_000_000), createdAt: z.string().datetime().optional() });
const stateSchema = z.object({
    engine: z.object({ targets: z.array(z.string()).min(1).max(4000), limit: z.number().int().min(3).max(60),
        mode: z.enum(['target', 'screen']).optional(), graphMode: z.literal('full').optional(), confirm: z.union([z.literal(2), z.literal(3), z.literal(5)]), seed: z.string().max(100), avoid: z.array(z.string()).max(1200) }).nullable(),
    queue: z.array(z.string()).max(60),
    history: z.array(z.object({ requestId: z.string().uuid(), question: z.object({ id: z.string() }), answer: z.string().max(5000),
        verdict: z.enum(['correct', 'wrong', 'skip']), method: z.enum(['rule', 'self']), errorItemId: z.string().optional() })).max(60),
});
/** 从服务端原题和作答重建状态，绝不信任备份中的答案、SVG 或已掌握状态。 */
export function restoreLearningState(raw: string, mode: string, itemMap: Map<string, string>): StoredLearning {
    const input = stateSchema.parse(JSON.parse(raw)), { graph, byId, questionsById } = getCatalog();
    if ((mode !== 'practice') !== !!input.engine) throw new Error('Invalid learning mode');
    if (input.queue.some(id => !questionsById.has(id)) || new Set(input.queue).size !== input.queue.length) throw new Error('Invalid question queue');
    if (input.engine?.targets.some(id => !byId.has(id))) throw new Error('Unknown topic');
    let state: StoredLearning = { engine: input.engine ? { ...Engine.createSession(input.engine.graphMode === 'full' ? getCatalog().fullGraph : graph, input.engine.targets, { ...input.engine, mode: mode === 'screen' ? 'screen' : 'target' }), ...(input.engine.graphMode ? { graphMode: input.engine.graphMode } : {}) } : null, queue: input.queue, history: [] };
    const requests = new Set<string>();
    for (const h of input.history) {
        if (requests.has(h.requestId)) throw new Error('Duplicate answer'); requests.add(h.requestId);
        const q = nextLearningQuestion(state);
        if (!q || q.id !== h.question.id) throw new Error('Invalid question order');
        const applied = applyLearningAnswer(state, q, { revision: state.history.length, requestId: h.requestId,
            questionId: q.id, answer: h.answer, skip: h.verdict === 'skip', selfResult: h.method === 'self' ? h.verdict : undefined });
        if ('manual' in applied) throw new Error('Missing self assessment');
        applied.history.errorItemId = h.errorItemId ? itemMap.get(h.errorItemId) : undefined;
        state = applied.state;
    }
    return state;
}
