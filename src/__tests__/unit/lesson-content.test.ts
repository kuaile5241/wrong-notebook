import { describe, expect, it } from 'vitest';
import { buildLesson, speechChunks, speechText } from '@/lib/lesson-content';

describe('原解析分步与公式朗读', () => {
    it('保留公式整体和原内容，分开列表步骤', () => {
        const formula = '$$\nx=\\frac{1}{2}\\\\\ny=2\n$$';
        const lesson = buildLesson({ question: '求解方程', analysis: `1. 两边移项。\n2. 合并同类项。\n\n${formula}`, answer: 'x=1/2' });
        expect(lesson.steps.map(s => s.kind)).toEqual(['question', 'analysis', 'analysis', 'analysis', 'answer']);
        expect(lesson.steps[3].markdown).toBe(formula);
        expect(lesson.language).toBe('zh');
    });
    it('不把数学不等号当HTML吞掉，不把20次方误读成平方', () => {
        expect(speechText('结果 x<3 且 y>4；x^20=1')).toContain('x小于三');
        expect(speechText('结果 x^20=1')).toContain('x的二十次方，等于一');
        expect(speechText('结果 x^2-1=0')).toContain('x的平方减去一，等于零');
        expect(speechText('解为 x=-2')).toContain('x，等于负二');
        expect(speechText('$-2$', 'zh')).toBe('负二');
        expect(speechText('$x$ -2', 'zh')).toContain('x 减去二');
        expect(speechText('计算 x*2')).toContain('x乘以二');
    });
    it('转换分数根号和百分数，中文上下文中纯公式仍读中文', () => {
        expect(speechText('$\\frac{1}{2}$', 'zh')).toContain('（二）分之（一）');
        expect(speechText('得到 50%')).toContain('百分之五十');
        expect(speechText('得到 $50\\%$')).toContain('百分之五十');
        expect(speechText('满足 x&lt;3')).toContain('x小于三');
        expect(speechText('取 $\\sqrt{9}$')).toContain('根号（九）');
        expect(speechText('Compute x^2=4')).toContain('squared');
    });
    it('去掉SVG、链接地址和标记，不朗读外部网址与脚本', () => {
        const text = speechText('解析 <script>alert(1)</script><svg><text>危险</text></svg> [下一步](https://example.com)');
        expect(text).toContain('下一步'); expect(text).not.toContain('alert'); expect(text).not.toContain('example.com'); expect(text).not.toContain('危险');
    });
    it('完整读出普通、全角、实体和TeX算式的运算关系', () => {
        for (const formula of ['40-12=28', '４０－１２＝２８', '40&#45;12&equals;28', '$40−12=28$']) expect(speechText(formula, 'zh')).toBe('四十减去十二，等于二十八');
        expect(buildLesson({ analysis: '40-12=28' }).language).toBe('zh');
        expect(speechText('计算 6×4÷2+1=13')).toBe('计算 六乘以四除以二加上一，等于十三');
        expect(speechText('满足 x<=3；y>=2；z!=1')).toBe('满足 x小于等于三；y大于等于二；z不等于一');
        expect(speechText('结果 -0.5+10=9.5')).toBe('结果 负零点五加上十，等于九点五');
        expect(speechText('3.14×2=6.28', 'zh')).toBe('三点一四乘以二，等于六点二八');
        expect(speechText('- 2+5=3', 'zh')).toBe('负 二加上五，等于三');
    });
    it('较长段落保留整句，常用公式不会被按150字硬切', () => {
        const text = '这是一段完整的讲解。'.repeat(25); expect(speechChunks(text)).toEqual([text]);
    });
    it('短音频分块有长度上限且不丢字，修改内容后指纹变化', () => {
        const text = '一'.repeat(420), chunks = speechChunks(text);
        expect(chunks.join('')).toBe(text); expect(chunks.every(c => c.length <= 450)).toBe(true);
        expect(buildLesson({ analysis: '第一步' }).fingerprint).not.toBe(buildLesson({ analysis: '第二步' }).fingerprint);
    });
});
