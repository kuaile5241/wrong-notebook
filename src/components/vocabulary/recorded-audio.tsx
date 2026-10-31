'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props { id: string; kind: string; label?: string }
export function RecordedAudio({ id, kind, label }: Props) {
    const { t } = useLanguage(), l = t.vocabulary;
    const ref = useRef<HTMLAudioElement>(null), [playing, setPlaying] = useState(false), [error, setError] = useState(false);
    useEffect(() => { const a = ref.current; return () => { a?.pause(); }; }, [id, kind]);
    async function toggle() {
        const audio = ref.current; if (!audio) return;
        if (!audio.paused) { audio.pause(); return; }
        if (error) audio.load();
        setError(false);
        try { await audio.play(); } catch { setError(true); setPlaying(false); }
    }
    return <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
            <audio ref={ref} data-vocabulary-audio preload="none" src={`/api/vocabulary/media/${kind}/${encodeURIComponent(id)}`} onPlay={() => { document.querySelectorAll<HTMLAudioElement>('audio[data-vocabulary-audio]').forEach(a => { if (a !== ref.current) a.pause(); }); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setError(true); setPlaying(false); }} />
            <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={label || l.audio} onClick={toggle}>{playing ? <Pause className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}{playing ? l.pause : label || l.audio}</Button>
            <select aria-label={l.speed} className="min-h-11 rounded-xl border bg-background px-2 text-sm" defaultValue="1" onChange={e => { if (ref.current) ref.current.playbackRate = Number(e.target.value); }}>{[0.75, 1, 1.25].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{l.audioError}</p>}
    </div>;
}
