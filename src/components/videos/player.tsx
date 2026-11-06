'use client';
import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
export function VideoPlayer({ id }: { id: string }) {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const player = useRef<HTMLVideoElement>(null);
    const lastSave = useRef(0);
    const [failed, setFailed] = useState(false);
    const key = 'video-progress:' + session?.user?.id + ':' + id;
    function restore() {
        const video = player.current;
        if (!video || !session?.user?.id) return;
        try {
            const position = Number(localStorage.getItem(key));
            if (Number.isFinite(position) && position > 0 && position < video.duration - 2) video.currentTime = position;
        } catch { /* 存储不可用时从头播放。 */ }
    }
    function save() {
        const video = player.current;
        if (!video || !session?.user?.id) return;
        try { localStorage.setItem(key, String(video.ended ? 0 : video.currentTime)); } catch { /* 播放不依赖本地存储。 */ }
    }
    return <div className="space-y-3">
        <video ref={player} controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-black" src={'/api/videos/' + id + '/media'}
            onLoadedMetadata={restore} onPause={save} onEnded={save} onError={() => setFailed(true)}
            onTimeUpdate={() => { if (Date.now() - lastSave.current > 3000) { save(); lastSave.current = Date.now(); } }} />
        <label className="flex items-center gap-3">{t.videos.rate}<select defaultValue="1" className="min-h-11 rounded-xl border px-3" onChange={e => { if (player.current) player.current.playbackRate = Number(e.target.value); }}>
            {[0.75, 1, 1.25, 1.5, 2].map(rate => <option key={rate}>{rate}</option>)}
        </select></label>
        {failed && <p role="alert" className="text-destructive">{t.videos.error}</p>}
    </div>;
}
