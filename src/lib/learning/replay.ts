import { getCatalog } from './catalog';
import { applyLearningAnswer, learningGraph, nextLearningQuestion } from './session';
import type { StoredLearning } from './types';
export function replayLearning(source: StoredLearning, history = source.history, limit = source.engine?.limit) {
    const original = source.engine;
    const Engine = getCatalog(source.datasetVersion).engine;
    let state: StoredLearning = { datasetVersion: source.datasetVersion, engine: original ? { ...Engine.createSession(learningGraph(original, source.datasetVersion), original.targets, { ...original, limit: limit ?? original.limit }), ...(original.graphMode ? { graphMode: original.graphMode } : {}) } : null, queue: source.queue, history: [] };
    for (const h of history) {
        const q = nextLearningQuestion(state); if (!q || q.id !== h.question.id) throw new Error('Replay order changed');
        const applied = applyLearningAnswer(state, q, { revision: 0, requestId: h.requestId, questionId: q.id, answer: h.answer, skip: h.verdict === 'skip', selfResult: h.method === 'self' ? h.verdict : undefined });
        if ('manual' in applied) throw new Error('Missing self assessment'); applied.history.errorItemId = h.errorItemId; state = applied.state;
    }
    return state;
}
