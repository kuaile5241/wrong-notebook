import { describe, expect, it } from 'vitest';
import { MAX_SVG_ANIMATION_LENGTH, sanitizeSvgAnimation } from '@/lib/svg-animation';
import { generateSvgAnimationPrompt } from '@/lib/ai/prompts';

const animation = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">'
    + '<rect width="800" height="500" fill="#fff"/>'
    + '<line x1="0" y1="0" x2="100" y2="100" stroke="#000"><animate attributeName="x2" from="0" to="100" dur="2s" fill="freeze"/></line>'
    + '<text x="20" y="480" opacity="0">第一步<set attributeName="opacity" to="1" begin="2s" fill="freeze"/></text>'
    + '<g><animateTransform attributeName="transform" type="rotate" from="0" to="90" dur="3s" fill="freeze"/></g>'
    + '</svg>';

describe('sanitizeSvgAnimation', () => {
    it('保留 SMIL 动画元素', () => {
        expect(sanitizeSvgAnimation(animation)).toBe(animation);
    });

    it('去掉脚本、事件属性和改写链接的动画', () => {
        const dirty = animation.replace('</svg>', ''
            + '<script>alert(1)</script>'
            + '<a><animate attributeName="href" to="https://evil.example" begin="1s"/><circle r="3" onclick="x()"/></a>'
            + '<set attributeName="xlink:href" to="#other"/>'
            + '</svg>');
        const clean = sanitizeSvgAnimation(dirty)!;

        expect(clean).not.toMatch(/script|onclick|evil\.example|attributeName="(xlink:)?href"/);
        expect(clean).toContain('<circle r="3"/>');
        expect(clean).toContain('<animate attributeName="x2"');
    });

    it('没有有效 SVG 或超长时返回 null', () => {
        expect(sanitizeSvgAnimation('无法生成')).toBeNull();
        expect(sanitizeSvgAnimation(null)).toBeNull();
        const long = animation.replace('</svg>', `<text>${'x'.repeat(MAX_SVG_ANIMATION_LENGTH)}</text></svg>`);
        expect(sanitizeSvgAnimation(long)).toBeNull();
    });

    it('长度在配图上限以上、动画上限以内时仍可保存', () => {
        const svg = animation.replace('</svg>', `<text>${'x'.repeat(150_000)}</text></svg>`);
        expect(sanitizeSvgAnimation(svg)).not.toBeNull();
    });
});

describe('generateSvgAnimationPrompt', () => {
    it('填入题目、答案、解析和配图，空字段显示占位', () => {
        const prompt = generateSvgAnimationPrompt('求面积', '', '底乘高', '<svg><rect/></svg>');
        expect(prompt).toContain('求面积');
        expect(prompt).toContain('底乘高');
        expect(prompt).toContain('（无）');
        expect(prompt).toContain('<svg><rect/></svg>');
        expect(prompt).toContain('<svg_animation>');
        expect(prompt).toContain('data-voice-start="0"');
        expect(prompt).toContain('详细语音讲稿');
        expect(prompt).not.toMatch(/\{\{\w+\}\}/);
    });

    it('没有配图时不输出配图段落', () => {
        expect(generateSvgAnimationPrompt('求面积', '6', '解析')).not.toContain('题目配图');
    });

    it('默认要求动画文字使用简体中文', () => {
        const prompt = generateSvgAnimationPrompt('求面积', '6', '解析');
        expect(prompt).toContain('简体中文，每行不超过 24 个字');
        expect(prompt).not.toContain('must be in English');
        expect(prompt).not.toContain('{{');
    });

    it('language=en 时要求动画中全部文字使用英文', () => {
        const prompt = generateSvgAnimationPrompt('求面积', '6', '解析', null, 'en');
        expect(prompt).toContain('All text in the animation');
        expect(prompt).toContain('must be in English');
        expect(prompt).toContain('英文，每行不超过 48 个字符');
        expect(prompt).not.toContain('简体中文，每行不超过 24 个字');
        expect(prompt).not.toContain('{{');
    });
});

import { buildSvgAnimationDocument, getSvgAnimationDuration, getSvgAspectRatio, parseClockValue } from '@/lib/svg-animation';

describe('SVG 动画时长与画面', () => {
    it('解析 SMIL 时钟值', () => {
        expect(parseClockValue('2s')).toBe(2);
        expect(parseClockValue('500ms')).toBe(0.5);
        expect(parseClockValue('1.5')).toBe(1.5);
        expect(parseClockValue('1min')).toBe(60);
        expect(parseClockValue('0:05')).toBe(5);
        expect(parseClockValue('a.end')).toBeNull();
        expect(parseClockValue(null)).toBeNull();
    });

    it('总时长取 begin + dur × repeatCount 的最大值，跳过无限循环和引用其他元素的动画', () => {
        const svg = '<svg viewBox="0 0 800 500">'
            + '<animate attributeName="x" dur="2s"/>'
            + '<set attributeName="opacity" to="1" begin="10s"/>'
            + "<animate attributeName='r' begin='4s;a.end' dur='3s' repeatCount='2'/>"
            + '<animate attributeName="y" dur="1s" repeatCount="indefinite"/>'
            + '<animate attributeName="z" begin="a.end" dur="100s"/>'
            + '</svg>';
        expect(getSvgAnimationDuration(svg)).toBe(10);
        expect(getSvgAnimationDuration(animation)).toBe(3);
        expect(getSvgAnimationDuration('<svg><rect/></svg>')).toBe(0);
    });

    it('宽高比取 viewBox，其次 width/height，缺省 8:5', () => {
        expect(getSvgAspectRatio('<svg viewBox="0 0 800 400">')).toBe(2);
        expect(getSvgAspectRatio('<svg width="300" height="300">')).toBe(1);
        expect(getSvgAspectRatio('<svg>')).toBe(1.6);
    });

    it('iframe 文档禁止加载外部资源', () => {
        const doc = buildSvgAnimationDocument(animation);
        expect(doc).toContain("default-src 'none'");
        expect(doc).toContain(animation);
    });
});
