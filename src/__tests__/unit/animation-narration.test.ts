import { describe, expect, it } from 'vitest';
import { buildAnimationNarration } from '@/lib/animation-narration';
const svg = (desc = '') => `<svg xmlns="http://www.w3.org/2000/svg">${desc}<rect width="50" height="50"><animate attributeName="x" from="0" to="20" dur="10s" fill="freeze"/></rect></svg>`;
const content = { question: '40-12=?', analysis: '先减十，再减二。', answer: '28' };
describe('SVG 讲稿与动画时间轴', () => {
    it('从已保存SVG取详细讲稿和场景时间，保留符号，修改画面后音频指纹失效', () => {
        const desc = '<desc data-voice-start="0" data-voice-end="5">先观察条件，40-12=28。</desc><desc data-voice-start="5" data-voice-end="10">核对结果，28&lt;40。</desc>';
        const lesson = buildAnimationNarration(svg(desc), content, 'zh'); expect(lesson.detailed).toBe(true);
        expect(lesson.cues).toEqual([{ start: 0, end: 5 }, { start: 5, end: 10 }]); expect(lesson.steps[1].markdown).toBe('核对结果，28<40。');
        expect(buildAnimationNarration(svg(desc).replace('to="20"', 'to="30"'), content, 'zh').fingerprint).not.toBe(lesson.fingerprint);
    });
    it('旧动画按原解析配音，不额外生成或改写结论', () => {
        const lesson = buildAnimationNarration(svg(), content, 'zh'); expect(lesson.detailed).toBe(false);
        expect(lesson.steps.map(s => s.markdown)).toEqual(['40-12=?', '先减十，再减二。', '28']); expect(lesson.cues[2].end).toBe(10);
    });
    it('拒绝重叠、越界和缺失时间，避免只朗读部分损坏讲稿', () => {
        for (const desc of ['<desc data-voice-start="0" data-voice-end="50">错误</desc>', '<desc data-voice-start="0">错误</desc>', '<desc data-voice-start="0" data-voice-end="5">第一步</desc><desc data-voice-start="4" data-voice-end="10">重叠</desc>']) {
            expect(buildAnimationNarration(svg(desc), content, 'zh').detailed).toBe(false);
        }
    });
});
