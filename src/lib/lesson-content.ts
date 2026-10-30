export interface LessonContent { question?: string | null; answer?: string | null; analysis?: string | null; figure?: string | null }
export type LessonSource = { kind: 'learning'; id: string; questionId: string } | { kind: 'error'; id: string };
export interface LessonStep { kind: 'question' | 'analysis' | 'answer'; markdown: string }
export function questionLesson(q: { prompt: string; answer: string; explanation: string; figure?: string; choices?: { key: string; text: string }[] }): LessonContent {
    return { question: [q.prompt, ...(q.choices ?? []).map(c => `${c.key}. ${c.text}`)].join('\n'), answer: q.answer, analysis: q.explanation, figure: q.figure };
}

/** 只把原解析分段，不推演或添加新的解题结论；公式和代码块整体保护。 */
function paragraphs(raw: string) {
    const protectedParts: string[] = [];
    const text = raw.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$/g, part => {
        protectedParts.push(part); return `\uE000${protectedParts.length - 1}\uE001`;
    });
    const restore = (part: string) => part.replace(/\uE000(\d+)\uE001/g, (_, id: string) => protectedParts[Number(id)]);
    const lines = text.replace(/\r\n/g, '\n').replace(/\n(?=\s*(?:\d+[.)、]|[一二三四五六七八九十]+[、.]|[-*+]\s|#{1,6}\s))/g, '\n\n').split(/\n\s*\n/);
    return lines.flatMap(line => {
        if (line.length < 240) return [restore(line.trim())];
        return line.replace(/([。！？；]|[.!?](?=\s+[A-Z]))/g, '$1\n').split('\n').map(p => restore(p.trim()));
    }).filter(Boolean);
}
export function buildLesson(content: LessonContent) {
    const steps: LessonStep[] = [];
    let truncated = false;
    for (const kind of ['question', 'analysis', 'answer'] as const) {
        const raw = content[kind]?.trim() || '';
        if (raw.length > 80_000) truncated = true;
        for (const markdown of paragraphs(raw.slice(0, 80_000))) steps.push({ kind, markdown });
    }
    return { steps, truncated, language: /[\u3400-\u9fff]/.test(steps.map(s => s.markdown).join('')) ? 'zh' as const : 'en' as const,
        fingerprint: lessonFingerprint(steps.map(s => `${s.kind}:${s.markdown}`).join('\n')) };
}
export function lessonFingerprint(text: string) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16);
}

/** 常见数学符号转为可朗读文本；不做代数化简或求值。 */
export function speechText(markdown: string, language?: 'zh' | 'en'): string {
    const chinese = language ? language === 'zh' : /[\u3400-\u9fff]/.test(markdown);
    let text = markdown.replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<\/?(?:p|div|span|br|strong|em|sup|sub|table|thead|tbody|tr|td|th)\b[^>]*>/gi, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/```[^\n]*\n|```|~~~/g, ' ').replace(/^\s*(?:#{1,6}\s*|>\s*|[-*+]\s+|\d+[.)、]\s*)/gm, '')
        .replace(/\\(?:left|right|displaystyle|textstyle)\b/g, '').replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1');
    text = text.replace(/\\%/g, '%').replace(/\\(?:qquad|quad)\b/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    for (let i = 0; i < 8; i++) {
        const before = text;
        text = text.replace(/\\(?:dfrac|tfrac|frac)\{([^{}]+)\}\{([^{}]+)\}/g, (_, a: string, b: string) => chinese ? `（${b}）分之（${a}）` : `(${a}) over (${b})`)
            .replace(/\\sqrt\{([^{}]+)\}/g, (_, x: string) => chinese ? `根号（${x}）` : `square root of (${x})`);
        if (before === text) break;
    }
    text = text.replace(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/g, (_, a: string, b: string) => chinese ? `${b}分之${a}` : `${a} over ${b}`)
        .replace(/\^\{2\}|\^2(?![\d.])|²/g, chinese ? '的平方' : ' squared').replace(/\^\{3\}|\^3(?![\d.])|³/g, chinese ? '的立方' : ' cubed')
        .replace(/\^\{([^}]+)\}/g, chinese ? '的$1次方' : ' to the power $1').replace(/\^(-?\d+(?:\.\d+)?|[a-zA-Z])/g, chinese ? '的$1次方' : ' to the power $1')
        .replace(/_\{([^}]+)\}|_([a-zA-Z0-9])/g, (_, a: string, b: string) => chinese ? `下标${a || b}` : ` sub ${a || b}`);
    text = text.replace(/(-?\d+(?:\.\d+)?)\s*%/g, chinese ? '百分之$1' : '$1 percent ')
        .replace(/(^|[=（(，,:：\s之])[-−－](?=\d|[a-zA-Z])/g, chinese ? '$1负' : '$1negative ');
    const symbols: Record<string, [string, string]> = {
        '\\times': ['乘以', ' times '], '\\cdot': ['乘以', ' times '], '\\div': ['除以', ' divided by '],
        '\\leq': ['小于等于', ' less than or equal to '], '\\geq': ['大于等于', ' greater than or equal to '],
        '\\neq': ['不等于', ' not equal to '], '\\pm': ['正负', ' plus or minus '], '\\pi': ['派', ' pi '],
        '≤': ['小于等于', ' less than or equal to '], '≥': ['大于等于', ' greater than or equal to '], '≠': ['不等于', ' not equal to '],
        '×': ['乘以', ' times '], '÷': ['除以', ' divided by '], '±': ['正负', ' plus or minus '], '√': ['根号', 'square root of '], 'π': ['派', ' pi '],
        '+': ['加', ' plus '], '=': ['等于', ' equals '], '%': ['百分号', ' percent '], '°': ['度', ' degrees '],
    };
    for (const [symbol, names] of Object.entries(symbols)) text = text.split(symbol).join(names[chinese ? 0 : 1]);
    text = text.replace(/(?:-|−|－)/g, chinese ? '减' : ' minus ').replace(/[<>]/g, m => chinese ? (m === '<' ? '小于' : '大于') : (m === '<' ? ' less than ' : ' greater than '));
    // 未覆盖的 TeX 用屏幕公式提示，避免将未知命令当作已理解的数学念出来。
    text = text.replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?/g, chinese ? '（公式请看屏幕）' : ' (see the formula) ')
        .replace(/\\[()[\]!,:;]|[$`*#{}]/g, ' ').replace(/&(?:nbsp|amp|lt|gt);/g, ' ')
        .replace(/\s+/g, ' ').trim();
    return text;
}
export function speechChunks(text: string, limit = 150) {
    const chunks: string[] = [];
    let rest = text.trim();
    while (rest.length > limit) {
        let at = -1;
        for (let i = limit; i >= Math.floor(limit / 2); i--) if (/[。！？；，,;.!?\s]/.test(rest[i])) { at = i + 1; break; }
        const end = at > 0 ? at : limit;
        chunks.push(rest.slice(0, end)); rest = rest.slice(end).trim();
    }
    if (rest) chunks.push(rest);
    return chunks;
}
