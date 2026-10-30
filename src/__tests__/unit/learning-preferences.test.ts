import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LEARNING_FILTERS, learningFiltersKey, parseLearningFilters, readLearningFilters, reconcileLearningFilters, saveLearningFilters } from '@/lib/learning/preferences';
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('按账号记忆练习首页选择', () => {
    it('读取最后学科、册别、章节与题数，账号间不串用', () => {
        saveLearningFilters('a', { subject: 'english', volume: '7-下', chapter: '第二单元', count: 20 });
        expect(JSON.parse(localStorage.getItem(learningFiltersKey('a'))!)).toEqual({ subject: 'english', volume: '7-下', chapter: '第二单元', count: 20 });
        expect(readLearningFilters('a').chapter).toBe('第二单元'); expect(readLearningFilters('b')).toEqual(DEFAULT_LEARNING_FILTERS);
    });
    it('损坏或不合法记录安全回退，只保留合法字段', () => {
        expect(parseLearningFilters('{broken')).toEqual(DEFAULT_LEARNING_FILTERS);
        expect(parseLearningFilters(JSON.stringify({ subject: 4, volume: 'x'.repeat(50), chapter: [], count: 999 }))).toEqual(DEFAULT_LEARNING_FILTERS);
        expect(parseLearningFilters(JSON.stringify({ subject: 'english', volume: '7-下', count: 5 }))).toMatchObject({ subject: 'english', volume: '7-下', chapter: '', count: 5 });
    });
    it('目录更新后不存在的册别/章节回退，仍有效的选择原样保留', () => {
        const catalog = { subjects: [{ key: 'math' }], volumes: [{ key: '2-上' }], volume: '1-上', chapters: ['第一单元'] };
        expect(reconcileLearningFilters({ subject: 'math', volume: '1-上', chapter: '旧章节', count: 20 }, catalog)).toEqual({ subject: 'math', volume: '2-上', chapter: '', count: 20 });
        const chosen = { subject: 'math', volume: '2-上', chapter: '第一单元', count: 5 };
        expect(reconcileLearningFilters(chosen, catalog)).toEqual(chosen);
    });
    it('浏览器限制存储时仍能正常选择，不让页面报错', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
        expect(() => saveLearningFilters('blocked', { volume: '3-上', chapter: '第一单元' })).not.toThrow();
        expect(readLearningFilters('blocked').volume).toBe('3-上');
    });
});
