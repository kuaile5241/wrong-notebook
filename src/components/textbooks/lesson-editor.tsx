'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { readWordLesson } from '@/lib/textbooks/lesson';
import type { WordLesson } from '@/lib/textbooks/lesson';
const empty: WordLesson = { version: 1, overview: '', spokenWord: '', usage: [], examples: [{ en: '', zh: '', analysis: '' }, { en: '', zh: '', analysis: '' }], pitfalls: [], memory: '' };
export function WordLessonEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const { t } = useLanguage(), l = t.textbooks;
    let data: WordLesson;
    try { data = readWordLesson(value) ?? { ...empty, ...JSON.parse(value) } as WordLesson; } catch { data = readWordLesson(value) ?? empty; }
    if (!data || !Array.isArray(data.examples)) data = empty;
    const current = { ...data, examples: [...data.examples, ...Array.from({ length: Math.max(0, 2 - data.examples.length) }, () => ({ en: '', zh: '', analysis: '' }))] };
    function update(next: WordLesson) { const hasContent = next.overview || next.memory || next.spokenWord || next.usage.length || next.pitfalls.length || next.examples.some(e => e.en || e.zh || e.analysis); onChange(hasContent ? JSON.stringify({ ...next, examples: next.examples.filter(e => e.en || e.zh || e.analysis) }) : ''); }
    const area = (key: 'overview' | 'memory', label: string) => <label className="block space-y-1 text-sm">{label}<Textarea aria-label={label} rows={3} maxLength={700} value={current[key]} onChange={e => update({ ...current, [key]: e.target.value })} /></label>;
    function example(index: number, key: 'en' | 'zh' | 'analysis', text: string) { const examples = [...current.examples]; examples[index] = { ...examples[index], [key]: text }; update({ ...current, examples }); }
    return <details className="space-y-3 rounded-xl border p-3"><summary className="cursor-pointer font-bold">{l.lessonEdit}</summary><div className="space-y-3 pt-3">
        {area('overview', l.lessonOverview)}<label className="block space-y-1 text-sm">{l.lessonSpokenWord}<Input aria-label={l.lessonSpokenWord} maxLength={250} value={current.spokenWord} onChange={e => update({ ...current, spokenWord: e.target.value })} /></label>
        {(['usage', 'pitfalls'] as const).map((key, i) => <label className="block space-y-1 text-sm" key={key}>{[l.lessonUsage, l.lessonPitfalls][i]}<Textarea aria-label={[l.lessonUsage, l.lessonPitfalls][i]} rows={4} value={current[key].join('\n')} onChange={e => update({ ...current, [key]: e.target.value.split('\n').filter(Boolean) })} /></label>)}
        {current.examples.map((ex, i) => <fieldset className="space-y-2 rounded-xl border p-3" key={i}><legend className="text-sm font-bold">{l.lessonExample} {i + 1}</legend><Input aria-label={`${l.lessonExample} ${i + 1}`} value={ex.en} maxLength={350} onChange={e => example(i, 'en', e.target.value)} /><Input aria-label={`${l.translation} ${i + 1}`} value={ex.zh} maxLength={350} onChange={e => example(i, 'zh', e.target.value)} /><Textarea aria-label={`${l.sentenceAnalysis} ${i + 1}`} rows={3} maxLength={600} value={ex.analysis} onChange={e => example(i, 'analysis', e.target.value)} /></fieldset>)}
        {area('memory', l.lessonMemory)}<p className="text-xs text-muted-foreground">{l.lessonNotice}</p>
    </div></details>;
}
