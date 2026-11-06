// Papermorph 引擎负责时钟、入场和笔画动画；场景只读取受约束的JSON。
const CHAPTER = { number: 1, title: PLAN.title, language: 'zh', minutes: 2, film: true };
function lines(p, text, x, y, size, t, color) {
    const chars = Array.from(text);
    for (let n = 0; n < chars.length; n += 18) {
        show(T(p, chars.slice(n, n + 18).join(''), { x, y: y + n / 18 * (size + 14), size, fill: color, o: 0 }), t, .6);
    }
}
function counter(p, group, row, duration) {
    const top = 310 + row * 175;
    lines(p, group.label + ' × ' + group.count, 160, top - 45, 34, .4, row ? '#92400e' : '#0f766e');
    for (let i = 0; i < group.count; i++) {
        const x = 180 + (i % 10) * 64, y = top + Math.floor(i / 10) * 70;
        const g = G(p, { x, y, o: 0 });
        mk('circle', { cx: 0, cy: 0, r: 20, fill: row ? '#f59e0b' : '#14b8a6' }, g);
        for (let j = 0; j < group.legs; j++) {
            mk('path', { d: `M${-15 + j * 10} 18v17`, stroke: COL.chalk, 'stroke-width': 3 }, g);
        }
        pop(g, .6 + i / Math.max(1, group.count) * Math.min(duration * .5, 4));
    }
}
const BEATS = PLAN.scenes.map((scene, index) => ({
    id: 's' + index, title: scene.title,
    run: (_marks, duration) => {
        const p = panel(0);
        lines(p, scene.title, 100, 110, 48, .1, COL.chalk);
        const visual = scene.visual;
        if (visual.kind === 'counters') visual.groups.forEach((g, i) => counter(p, g, i, duration));
        if (visual.kind === 'bars') {
            const max = Math.max(...visual.groups.map(g => g.value));
            visual.groups.forEach((g, i) => {
                const y = 280 + i * 110;
                lines(p, g.label, 120, y - 20, 30, .3 + i * .5, COL.chalk);
                const bar = mk('rect', { x: 120, y, width: 0, height: 45, rx: 7, fill: ['#14b8a6','#f59e0b','#8b5cf6'][i] }, p);
                put(bar, { 'a_width': 0 }); tw(bar, { 'a_width': 680 * g.value / max }, .6 + i * .6, 1.2, out);
                lines(p, String(g.value), 820, y + 35, 30, 1.5 + i * .6, COL.chalk);
            });
        }
        if (visual.kind === 'fraction') {
            for (let i = 0; i < visual.denominator; i++) {
                const g = G(p, { o: 0 });
                mk('rect', { x: 130 + i % 10 * 66, y: 300 + Math.floor(i / 10) * 85, width: 58, height: 65, rx: 6, fill: i < visual.numerator ? '#14b8a6' : '#cbd5e1' }, g);
                show(g, .5 + i * .13);
            }
            lines(p, `${visual.numerator} / ${visual.denominator}`, 380, 540, 64, 2, COL.chalk);
        }
        if (visual.kind === 'numberLine') {
            const low = Math.min(0, visual.from, visual.to), high = Math.max(1, visual.from, visual.to);
            const x = n => 140 + (n - low) / (high - low) * 640;
            draw(path(p, 'M120 390H840', { stroke: COL.chalk, 'stroke-width': 4 }, { d: 0 }), .3, 1);
            for (const value of [...new Set([low, visual.from, visual.to, high])]) lines(p, String(value), x(value) - 14, 445, 34, .8, COL.chalk);
            const dot = mk('circle', { cx: x(visual.from), cy: 390, r: 16, fill: '#f59e0b' }, p);
            put(dot, { 'a_cx': x(visual.from) }); tw(dot, { 'a_cx': x(visual.to) }, 1.4, Math.max(2, Math.min(duration * .5, 5)), io);
        }
        scene.lines.forEach((text, i) => lines(p, text, 940, 260 + i * 140, 30, .7 + i * Math.min(duration / 4, 3), COL.chalk));
        if (scene.equation) lines(p, scene.equation, 130, 730, 46, Math.min(duration * .5, 4), COL.task);
    },
}));
boot();
