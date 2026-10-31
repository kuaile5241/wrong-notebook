'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AnswerHistory } from '@/lib/learning/types';
export function AnswerCorrection({ history, index, busy, save }: { history: AnswerHistory; index: number; busy: boolean; save: (value: Record<string, unknown>) => void }) {
    const { t } = useLanguage(), l = t.learning, [open, setOpen] = useState(false), [answer, setAnswer] = useState(history.answer);
    return <div className="space-y-2 print:hidden"><Button variant="outline" size="sm" onClick={() => setOpen(!open)}>{l.correctAnswer}</Button>{open && <div className="space-y-2 rounded-xl bg-muted p-3"><p className="text-sm">{l.correctionHint}</p><textarea aria-label={l.correctAnswer} className="w-full rounded-xl border bg-background p-3" maxLength={5000} value={answer} onChange={e => setAnswer(e.target.value)} /><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => save({ action: 'correct', index, answer })}>{l.submit}</Button><Button disabled={busy} variant="outline" onClick={() => save({ action: 'correct', index, answer, selfResult: 'correct' })}>{l.selfCorrect}</Button><Button disabled={busy} variant="outline" onClick={() => save({ action: 'correct', index, answer, selfResult: 'wrong' })}>{l.selfWrong}</Button></div></div>}</div>;
}
