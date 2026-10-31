// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matchesSettings, settingsSchema, vocabularyCatalog } from '@/lib/vocabulary/catalog';
import { makeChoices, gradeAttempt } from '@/lib/vocabulary/practice';
import { scheduleWord } from '@/lib/vocabulary/srs';
import { mediaRange } from '@/lib/vocabulary/media';

describe('词汇资源与复习规则', () => {
    it('词条完整且唯一，学段筛选不冒充教材目录', () => {
        const c = vocabularyCatalog(); expect(c.words).toHaveLength(7298); expect(c.byId.size).toBe(7298);
        for (const w of c.words) { expect(w.senses[0].zh).toBeTruthy(); expect(w.ex[0].en).toBeTruthy(); expect(w.id).toMatch(/^[a-z0-9-]+$/); }
        const settings = settingsSchema.parse({});
        expect(matchesSettings(c.byId.get('apple')!, settings)).toBe(true);
        expect(matchesSettings(c.byId.get('library')!, settings)).toBe(true);
        expect(matchesSettings(c.byId.get('coefficient')!, settings)).toBe(false);
        expect(matchesSettings(c.byId.get('coefficient')!, { ...settings, stage: 'all' })).toBe(true);
    });
    it('选项唯一、正确答案仅一项；拼写规范化而不是模糊判对', () => {
        const choices = makeChoices('library', 'meaning'); expect(new Set(choices).size).toBe(4); expect(choices.filter(id => id === 'library')).toHaveLength(1);
        expect(gradeAttempt({ mode: 'meaning', wordId: 'library', choices: JSON.stringify(choices) }, { answer: ['A', 'B', 'C', 'D'][choices.indexOf('library')] }).correct).toBe(true);
        expect(gradeAttempt({ mode: 'spelling', wordId: 'library', choices: '[]' }, { answer: ' Library ' }).correct).toBe(true);
        expect(gradeAttempt({ mode: 'spelling', wordId: 'library', choices: '[]' }, { answer: 'libary' }).correct).toBe(false);
    });
    it('FSRS为真实复习安排后续时间；自评不变成客观正确成绩', () => {
        const now = new Date('2026-10-31T01:00:00Z'), first = scheduleWord('', 3, now);
        expect(first.dueAt > now).toBe(true); expect(JSON.parse(first.state).reps).toBe(1);
        const second = scheduleWord(first.state, 3, first.dueAt); expect(JSON.parse(second.state).reps).toBe(2);
        expect(gradeAttempt({ mode: 'self', wordId: 'library', choices: '[]' }, { answer: '', grade: 4 }).correct).toBeNull();
        expect(() => scheduleWord('', 0)).toThrow();
    });
    it('Range支持起止和后缀范围，拒绝越界及多段', () => {
        expect(mediaRange(null, 100)).toBeNull(); expect(mediaRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
        expect(mediaRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 }); expect(mediaRange('bytes=20-', 100)).toEqual({ start: 20, end: 99 });
        expect(mediaRange('bytes=100-', 100)).toBe(false); expect(mediaRange('bytes=0-2,4-5', 100)).toBe(false); expect(mediaRange('bytes=-0', 100)).toBe(false);
    });
});
