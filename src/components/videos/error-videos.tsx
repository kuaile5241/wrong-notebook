'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VideoLesson } from './types';
export function ErrorVideos({ id }: { id: string }) {
    const { t } = useLanguage();
    const [videos, setVideos] = useState<VideoLesson[]>([]);
    useEffect(() => {
        let active = true;
        fetch('/api/videos?errorId=' + encodeURIComponent(id)).then(r => r.ok ? r.json() : null).then(data => { if (active) setVideos((data?.videos || []).filter((v: VideoLesson) => v.linked)); }).catch(() => {});
        return () => { active = false; };
    }, [id]);
    return <section className="space-y-3 rounded-2xl border border-violet-200 bg-card p-4"><h2 className="text-xl font-bold">{t.videos.linked}</h2>
        {videos.map(video => <Link key={video.id} className="block text-primary underline" href={'/videos?id=' + video.id}>{video.title}</Link>)}
        <Link className="inline-block rounded-xl bg-violet-100 px-4 py-3 text-violet-900" href={'/videos?errorId=' + encodeURIComponent(id)}>{t.videos.choose}</Link>
    </section>;
}
