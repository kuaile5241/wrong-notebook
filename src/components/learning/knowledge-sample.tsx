'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useLanguage } from '@/contexts/LanguageContext';
import { learningRequest } from './client';
export function KnowledgeSample({ id }: { id: string }) {
    const { t } = useLanguage(), l = t.knowledge;
    const [value, setValue] = useState<{ question: string; answer?: string; figure?: string } | null>(null), [error, setError] = useState(false);
    async function load(reveal = false) { try { setValue(await learningRequest('/api/knowledge/sample?id=' + encodeURIComponent(id) + (reveal ? '&reveal=1' : ''))); setError(false); } catch { setError(true); } }
    return <details className="space-y-3 rounded-xl border p-3" onToggle={e => { if (e.currentTarget.open && !value) void load(); }}><summary className="cursor-pointer font-bold">{l.sampleTitle}</summary><p className="text-xs text-muted-foreground">{l.sampleHint}</p>{error && <p role="alert">{l.failure}</p>}{value && <div className="space-y-3"><MarkdownRenderer content={value.question} />{value.figure && <div dangerouslySetInnerHTML={{ __html: value.figure }} />}{value.answer === undefined ? <Button variant="outline" onClick={() => void load(true)}>{l.reveal}</Button> : <MarkdownRenderer content={value.answer} />}</div>}</details>;
}
