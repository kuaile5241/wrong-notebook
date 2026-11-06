'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VideoLesson } from './types';
export function VideoEditor({ video, done }: { video?: VideoLesson; done: () => void }) {
    const { t } = useLanguage(), l = t.videos;
    const [busy, setBusy] = useState(false), [error, setError] = useState(false);
    const field = 'min-h-11 w-full rounded-xl border bg-background p-2';
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const body = { title: String(data.get('title')), summary: String(data.get('summary')), subject: String(data.get('subject')),
            grade: Number(data.get('grade')), topics: String(data.get('topics')).split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            published: data.get('published') === 'on', archived: data.get('archived') === 'on', bookId: video?.bookId || '', unitId: video?.unitId || '' };
        const file = data.get('file');
        if (!video && (!(file instanceof File) || !file.size || file.size > 100 * 1024 * 1024)) { setError(true); return; }
        setBusy(true); setError(false);
        try {
            const response = video ? await fetch('/api/videos/' + video.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, revision: video.revision }) })
                : await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': 'video/mp4', 'X-Video-Metadata': encodeURIComponent(JSON.stringify(body)) }, body: file });
            if (!response.ok) throw new Error('SAVE_FAILED');
            done();
        } catch { setError(true); } finally { setBusy(false); }
    }
    return <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-xl font-bold">{video ? l.edit : l.upload}</h2>
        <p className="text-sm text-muted-foreground">{l.hint}</p>
        {!video && <label className="block">{l.file}<input className={field} type="file" name="file" accept="video/mp4,.mp4" required /></label>}
        <label className="block">{l.name}<input name="title" className={field} required maxLength={120} defaultValue={video?.title} /></label>
        <label className="block">{l.summary}<textarea name="summary" className={field} maxLength={2000} defaultValue={video?.summary} /></label>
        <div className="grid grid-cols-2 gap-3"><label>{l.grade}<select name="grade" className={field} defaultValue={video?.grade || 3}>{t.textbooks.gradeNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}</select></label>
        <label>{l.subject}<select className={field} name="subject" defaultValue={video?.subject || 'math'}>{['math','english','physics','chinese','science','morality','history'].map(subject => <option key={subject} value={subject}>{l.subjects[subject as keyof typeof l.subjects]}</option>)}</select></label></div>
        <label className="block">{l.topics}<textarea name="topics" className={field} defaultValue={video?.topics.join('\n')} maxLength={3000} /></label>
        <label className="flex gap-2"><input name="published" type="checkbox" defaultChecked={video?.published} />{l.publish}</label>
        {video && <label className="flex gap-2"><input name="archived" type="checkbox" defaultChecked={video.archived} />{l.archive}</label>}
        <Button disabled={busy}>{busy ? l.busy : l.save}</Button>
        {error && <p role="alert" className="text-destructive">{l.failure}</p>}
    </form>;
}
