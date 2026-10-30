// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getCatalog, publicQuestion, volumeLabel } from '@/lib/learning/catalog';
import { applyLearningAnswer, createLearningState, nextLearningQuestion } from '@/lib/learning/session';
import { restoreLearningState } from '@/lib/learning/backup';
import * as Engine from '@/lib/learning/vendor/engine';
import type { BankQuestion } from '@/lib/learning/types';

describe('固定版本题库与规则判题', () => {
    it('数据引用完整、硬先修无环、输出不泄露诊断答案', () => {
        const c = getCatalog();
        expect([c.topics.length, c.dependencies.length, c.questions.length]).toEqual([2804, 4239, 11363]);
        expect(new Set(c.questions.map(q => q.id)).size).toBe(c.questions.length);
        for (const q of c.questions) { expect(c.byId.has(q.topicId)).toBe(true); expect(q.explanation).toBeTruthy(); }
        for (const t of c.topics) expect(t).not.toHaveProperty('diagnostic_question');
        const visited = new Set<string>(), visiting = new Set<string>();
        const visit = (id: string) => { if (visited.has(id)) return; expect(visiting.has(id)).toBe(false); visiting.add(id); for (const p of c.graph.prereqs[id]) visit(p.id); visiting.delete(id); visited.add(id); };
        c.topics.forEach(t => visit(t.id)); expect(visited.size).toBe(c.topics.length);
    });
    it('待答题只包含白名单字段', () => {
        const q = getCatalog().questions[0];
        expect(publicQuestion(q)).not.toHaveProperty('answer'); expect(publicQuestion(q)).not.toHaveProperty('verify'); expect(publicQuestion(q)).not.toHaveProperty('accept');
    });
    it('数值精确判分且不把未知代数表达式判错', () => {
        const q: BankQuestion = { id: 'test', topicId: 'cnm_p001', prompt: '', answer: '1/2', explanation: '', type: 'numeric', difficulty: 'basic' };
        expect(Engine.judgeQuestion(q, '50%').verdict).toBe('correct');
        expect(Engine.judgeQuestion({ ...q, answer: '1/3' }, '0.333').verdict).toBe('wrong');
        expect(Engine.judgeQuestion({ ...q, type: 'short', answer: 'x²-4x+3' }, '(x-2)²-1').verdict).toBe('manual');
    });
    it('练习不重复题目且优先未做过的题', () => {
        const first = createLearningState(['cnm_p001'], 'practice', 3);
        const next = createLearningState(['cnm_p001'], 'practice', 3, first.queue);
        expect(new Set(first.queue).size).toBe(3); expect(first.queue.includes(next.queue[0])).toBe(false);
    });
    it('高中册次没有误显示成十二年级', () => {
        expect(volumeLabel(getCatalog().byId.get('cnm_h144')!)).toBe('选择性必修1');
    });
    it('备份从原题重建，丢弃伪造答案、SVG和掌握状态', () => {
        let state = createLearningState(['cnm_p001'], 'practice', 3);
        const q = nextLearningQuestion(state)!;
        const applied = applyLearningAnswer(state, q, { revision: 0, questionId: q.id, requestId: '12345678-1234-4234-8234-123456789012', answer: '', skip: true });
        if ('manual' in applied) throw new Error('Unexpected manual'); state = applied.state;
        state.history[0].question = { ...q, answer: '伪造', figure: '<svg onload="alert(1)"></svg>' };
        const restored = restoreLearningState(JSON.stringify(state), 'practice', new Map());
        expect(restored.history[0].question.answer).not.toBe('伪造'); expect(restored.history[0].question.figure ?? '').not.toContain('onload');
        expect(restored.history[0].verdict).toBe('skip');
    });
});
