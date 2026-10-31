'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { WordEntry } from '@/lib/vocabulary/catalog';
import { RecordedAudio } from './recorded-audio';
interface Props { word: WordEntry & { media: number }; accent: 'uk' | 'us' }
export function WordCard({ word, accent }: Props) {
    const { t } = useLanguage(), l = t.vocabulary, [imageFailed, setImageFailed] = useState(false);
    return <div className="space-y-4">
        {!!(word.media & 1) && !imageFailed && <Image unoptimized src={`/api/vocabulary/media/image/${encodeURIComponent(word.mediaId ?? word.id)}`} alt={word.w} width={640} height={400} onError={() => setImageFailed(true)} className="max-h-80 w-full rounded-2xl bg-sky-50 object-contain" />}
        <div><h2 className="text-3xl font-bold tracking-wide">{word.w}</h2><p className="mt-1 text-muted-foreground">{word[accent]} · {word.cefr}</p></div>
        <div className="flex flex-wrap gap-3">{!!(word.media & 2) && <RecordedAudio id={word.mediaId ?? word.id} kind="uk" label={l.uk} />}{!!(word.media & 4) && <RecordedAudio id={word.mediaId ?? word.id} kind="us" label={l.us} />}{word.onlineSpeechId && <RecordedAudio id={word.onlineSpeechId} kind="natural" label={l.naturalAudio} source={`/api/textbooks/terms/${word.onlineSpeechId}/audio`} />}</div>
        <p className="rounded-xl bg-sky-50 p-3 text-lg font-medium text-sky-950 dark:bg-sky-950 dark:text-sky-100">{word.senses[0]?.pos} {word.senses[0]?.zh}</p>
        {word.ex[0] && <div className="space-y-2 rounded-xl bg-violet-50 p-4 text-violet-950 dark:bg-violet-950 dark:text-violet-100"><p className="text-lg leading-relaxed">{word.ex[0].en}</p><p className="text-sm">{word.ex[0].zh}</p>{!!(word.media & 8) && <RecordedAudio id={word.mediaId ?? word.id} kind="ex" label={l.sentence} />}</div>}
        <p className="text-sm leading-relaxed">{word.tip}</p>
        <details className="rounded-xl border p-3"><summary className="cursor-pointer font-medium">{l.details}</summary><div className="mt-3 space-y-3 text-sm leading-relaxed">
            <p className="text-muted-foreground">{l.firstExample}</p>
            {word.senses.map((s, i) => <p key={i}>{s.pos} {s.zh}<br />{s.en}</p>)}
            {word.ex.slice(1).map((e, i) => <div key={i}><p>{e.en}</p><p>{e.zh}</p>{i === 0 && !!(word.media & 16) && <RecordedAudio id={word.mediaId ?? word.id} kind="ex2" label={l.sentence} />}</div>)}
            <p>{[...word.col, ...word.fam, ...word.syn, ...word.ant].join(' · ')}</p>{word.note && <p>{word.note}</p>}
        </div></details>
    </div>;
}
