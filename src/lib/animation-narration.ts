import { buildLesson, lessonFingerprint } from './lesson-content';
import type { LessonContent, LessonStep } from './lesson-content';
import { getSvgAnimationDuration, parseClockValue, sanitizeSvgAnimation } from './svg-animation';

export interface AnimationCue { start: number; end: number }
function attribute(tag: string, name: string) { return tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]; }
function decode(text: string) {
    return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
/** 讲稿随 SVG 的 desc 元素存储，沿用已有动画的备份与导入；不执行 XML、脚本或外部资源。 */
export function buildAnimationNarration(raw: string, content: LessonContent, language: 'zh' | 'en') {
    const svg = sanitizeSvgAnimation(raw) || '';
    const duration = Math.max(1, getSvgAnimationDuration(svg));
    let steps: LessonStep[] = [], cues: AnimationCue[] = [];
    let previousEnd = 0;
    let invalid = false;
    for (const match of svg.matchAll(/<desc\b([^>]*)>([\s\S]*?)<\/desc>/gi)) {
        if (!/data-voice-start/i.test(match[1])) continue;
        const start = parseClockValue(attribute(' ' + match[1], 'data-voice-start') ?? null), end = parseClockValue(attribute(' ' + match[1], 'data-voice-end') ?? null);
        const markdown = decode(match[2].replace(/<[^>]*>/g, '')).trim();
        if (start === null || end === null || start < previousEnd || end <= start || end > duration + 0.1 || !markdown || markdown.length > 2000 || steps.length >= 20) { invalid = true; break; }
        steps.push({ kind: 'analysis', markdown }); cues.push({ start, end }); previousEnd = end;
    }
    const detailed = !invalid && steps.length > 0;
    if (!detailed) {
        steps = buildLesson(content).steps;
        cues = steps.map((_, i) => ({ start: duration * i / steps.length, end: duration * (i + 1) / steps.length }));
    }
    return { steps, cues, language, detailed, fingerprint: lessonFingerprint(svg + '\0' + language + '\0' + JSON.stringify(steps)) };
}
