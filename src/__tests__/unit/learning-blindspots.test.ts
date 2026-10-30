// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { summarizeBlindspots } from '@/lib/learning/blindspots';
import { getCatalog } from '@/lib/learning/catalog';
import { createLearningState } from '@/lib/learning/session';
import type { AnswerHistory } from '@/lib/learning/types';

const questions = getCatalog().questions.filter(q => q.topicId === 'cnm_p001');
function record(id: string, verdicts: AnswerHistory['verdict'][], time: number, method: AnswerHistory['method'] = 'rule') {
    const state = createLearningState(['cnm_p001'], 'practice', 3);
    state.history = verdicts.map((verdict, i) => ({ requestId: `${id}-${i}`, question: questions[i], answer: '', verdict, method }));
    return { id, state: JSON.stringify(state), updatedAt: new Date(time) };
}
describe('账号知识盲区汇总', () => {
    it('未完成会话的错题/不会题纳入，按学科和册次隔离且不发送答案', () => {
        const records = [record('a', ['wrong', 'skip'], 1)];
        const groups = summarizeBlindspots(records, 'math', '1-上');
        expect(groups).toHaveLength(1); expect(groups[0].topicIds).toEqual(['cnm_p001']);
        expect(groups[0].pending).toBe(1); expect(JSON.stringify(groups)).not.toContain('answer');
        expect(summarizeBlindspots(records, 'history', '7-上')).toEqual([]);
        expect(summarizeBlindspots(records, 'math', '3-上')).toEqual([]);
    });
    it('单次答对、自评不抹除薄弱；两道不同题实测通过后移出，再错会重新出现', () => {
        const wrong = record('a', ['wrong'], 1);
        expect(summarizeBlindspots([wrong, record('b', ['correct'], 2)], 'math', '')).toHaveLength(1);
        expect(summarizeBlindspots([wrong, record('c', ['correct', 'correct'], 3, 'self')], 'math', '')).toHaveLength(1);
        const passed = record('d', ['correct', 'correct'], 4);
        expect(summarizeBlindspots([passed, wrong], 'math', '')).toEqual([]);
        expect(summarizeBlindspots([passed, wrong, record('e', ['wrong'], 5)], 'math', '')).toHaveLength(1);
    });
    it('重复同一题的正确记录不能清除待确认', () => {
        const wrong = record('a', ['wrong'], 1), repeated = record('b', ['correct', 'correct'], 2);
        const state = JSON.parse(repeated.state); state.history[1].question = state.history[0].question;
        repeated.state = JSON.stringify(state);
        expect(summarizeBlindspots([wrong, repeated], 'math', '')).toHaveLength(1);
    });
});
