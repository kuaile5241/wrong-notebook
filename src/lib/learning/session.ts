import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import type { LearningSession } from '@prisma/client';
import * as Engine from './vendor/engine';
import { getCatalog, publicQuestion } from './catalog';
import type { AnswerHistory, BankQuestion, LearningView, StoredLearning, TopicStatus } from './types';

export const createLearningSchema = z.object({
    topicIds: z.array(z.string().max(60)).min(1).max(400), mode: z.enum(['practice', 'diagnose']),
    count: z.number().int().min(3).max(30).default(10),
});
export const answerLearningSchema = z.object({
    revision: z.number().int().nonnegative(), requestId: z.string().uuid(), questionId: z.string().max(100),
    answer: z.string().max(5000).default(''), selfResult: z.enum(['correct', 'wrong', 'skip']).optional(),
    skip: z.boolean().optional(),
});
export function parseLearning(raw: string): StoredLearning { return JSON.parse(raw) as StoredLearning; }
export function nextLearningQuestion(state: StoredLearning): BankQuestion | null {
    const catalog = getCatalog();
    return state.engine ? Engine.nextItem(catalog.graph, state.engine)?.question ?? null
        : catalog.questionsById.get(state.queue[state.history.length]) ?? null;
}
export function createLearningState(topicIds: string[], mode: string, count: number, avoid: string[] = []): StoredLearning {
    const { byId, graph, questions } = getCatalog();
    if (topicIds.some(id => !byId.has(id))) throw new Error('UNKNOWN_TOPIC');
    const seed = randomUUID();
    if (mode === 'diagnose') return { engine: Engine.createSession(graph, topicIds, { limit: count, confirm: 2, seed, avoid }), queue: [], history: [] };
    const targets = new Set(topicIds), seen = new Set(avoid);
    const candidates = questions.filter(q => targets.has(q.topicId)).map(q => ({ q,
        order: createHash('sha256').update(seed + q.id).digest('hex') }));
    candidates.sort((a, b) => Number(seen.has(a.q.id)) - Number(seen.has(b.q.id)) || a.order.localeCompare(b.order));
    return { engine: null, queue: candidates.slice(0, count).map(c => c.q.id), history: [] };
}
export function applyLearningAnswer(state: StoredLearning, q: BankQuestion, input: z.infer<typeof answerLearningSchema>): { state: StoredLearning; history: AnswerHistory } | { manual: true } {
    let verdict: AnswerHistory['verdict'], method: AnswerHistory['method'] = 'rule';
    if (input.skip) verdict = 'skip';
    else {
        const judged = Engine.judgeQuestion(q, input.answer);
        if (judged.verdict === 'manual') {
            if (!input.selfResult) return { manual: true };
            verdict = input.selfResult; method = 'self';
        } else verdict = judged.verdict;
    }
    const history: AnswerHistory = { requestId: input.requestId, question: q, answer: input.answer, verdict, method };
    const engine = state.engine ? Engine.applyAnswer(getCatalog().graph, state.engine, q.topicId, verdict, { text: input.answer }) : null;
    return { state: { ...state, engine, history: [...state.history, history] }, history };
}
export function learningView(row: LearningSession): LearningView {
    const state = parseLearning(row.state), catalog = getCatalog(), question = nextLearningQuestion(state);
    const topics: TopicStatus[] = [];
    if (state.engine) for (const id of state.engine.order) {
        const topic = catalog.byId.get(id); if (!topic) continue;
        const result = state.engine.status[id];
        const pending = !result && state.engine.attempts[id]?.some(a => a.result !== 'correct');
        if (!result && !pending) continue;
        const status = pending ? 'pending' : result.s === 'mastered' ? (result.src === 'direct' ? 'direct' : 'inferred') : result.s === 'shaky' ? 'shaky' : 'weak';
        topics.push({ id, name: topic.name, chapter: topic.chapter, status });
    }
    return { id: row.id, title: row.title, mode: row.mode, revision: row.revision, finished: !question,
        answered: state.history.length, limit: state.engine?.limit ?? state.queue.length,
        correct: state.history.filter(h => h.verdict === 'correct').length,
        question: question ? publicQuestion(question) : null,
        topic: question ? catalog.byId.get(question.topicId) ?? null : null,
        history: state.history, topics };
}
