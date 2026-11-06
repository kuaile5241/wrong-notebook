'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { VideoEditor } from './editor';
import { VideoPlayer } from './player';
import type { VideoLesson } from './types';
export function VideoLibrary() {
    const { t } = useLanguage(), l = t.videos;
    const params = useSearchParams();
    const [videos, setVideos] = useState<VideoLesson[]>([]), [admin, setAdmin] = useState(false), [error, setError] = useState(false);
    const [search, setSearch] = useState(''), [grade, setGrade] = useState(''), [editing, setEditing] = useState<VideoLesson | null>(null);
    const [upload, setUpload] = useState(false);
    const errorId = params.get('errorId') || '';
    const selected = videos.find(v => v.id === params.get('id'));
    const load = useCallback(async () => {
        try {
            const response = await fetch('/api/videos?manage=true' + (errorId ? '&errorId=' + encodeURIComponent(errorId) : ''));
            if (!response.ok) throw new Error('LOAD_FAILED');
            const data = await response.json();
            setVideos(data.videos); setAdmin(data.canManage); setError(false);
        } catch { setError(true); }
    }, [errorId]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 进入课程页时从服务端加载列表。
    useEffect(() => { void load(); }, [load]);
    async function toggle(video: VideoLesson) {
        const response = await fetch('/api/videos/' + video.id + '/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ errorId, linked: !video.linked }) });
        if (response.ok) await load(); else setError(true);
    }
    const shown = videos.filter(v => (!grade || v.grade === Number(grade)) && [v.title, v.summary, ...v.topics].join(' ').toLowerCase().includes(search.toLowerCase()));
    return <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        <header className="space-y-2 rounded-3xl bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100 p-6 text-slate-900"><h1 className="text-3xl font-bold">{l.title}</h1><p>{l.intro}</p></header>
        {selected && <article className="space-y-4 rounded-2xl border bg-card p-4"><h2 className="text-2xl font-bold">{selected.title}</h2><p>{selected.summary}</p><VideoPlayer key={selected.id} id={selected.id} /><a href={'/api/videos/' + selected.id + '/media?download=1'} className="text-primary underline">{l.download}</a></article>}
        {admin && <Button variant="outline" onClick={() => { setUpload(!upload); setEditing(null); }}>{l.upload}</Button>}
        {(upload || editing) && <VideoEditor key={editing?.id || 'new'} video={editing || undefined} done={() => { setUpload(false); setEditing(null); void load(); }} />}
        <div className="flex gap-3"><input aria-label={l.search} placeholder={l.search} className="min-h-11 min-w-0 flex-1 rounded-xl border p-3" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label={l.grade} className="rounded-xl border px-3" value={grade} onChange={e => setGrade(e.target.value)}><option value="">{l.all}</option>{t.textbooks.gradeNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}</select></div>
        {error && <p role="alert" className="text-destructive">{l.failure}</p>}
        {!shown.length && <p>{l.empty}</p>}
        <div className="grid gap-4 sm:grid-cols-2">{shown.map(video => <article key={video.id} className="space-y-3 rounded-2xl border border-sky-200 bg-card p-5 shadow-sm">
            <Link href={'/videos?id=' + video.id + (errorId ? '&errorId=' + encodeURIComponent(errorId) : '')} className="text-xl font-bold text-primary underline">{video.title}</Link>
            <p>{video.summary}</p><p className="text-sm text-muted-foreground">{t.textbooks.gradeNames[video.grade - 1]} · {video.topics.join(' / ')} · {(video.bytes / 1048576).toFixed(1)} MB {(!video.published || video.archived) && ' · ' + l.draft}</p>
            {errorId && video.published && !video.archived && <Button variant="outline" onClick={() => void toggle(video)}>{video.linked ? l.unlink : l.link}</Button>}
            {admin && <Button variant="ghost" onClick={() => { setEditing(video); setUpload(false); }}>{l.edit}</Button>}
        </article>)}</div>
    </main>;
}
