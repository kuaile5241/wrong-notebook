
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
interface Job { id: string; status: 'queued' | 'planning' | 'rendering' | 'completed' | 'unsupported' | 'failed'; progress: number; error: string }
export function GenerateVideo({ id }: { id: string }) {
    const { t } = useLanguage(), l = t.generation;
    const [voice, setVoice] = useState('zh-CN-XiaoxiaoNeural');
    const [job, setJob] = useState<Job | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const endpoint = '/api/error-items/' + id + '/video';
    const load = useCallback(async () => {
        const response = await fetch(endpoint + '?voice=' + voice);
        if (!response.ok) throw new Error('LOAD_FAILED');
        setJob((await response.json()).job);
    }, [endpoint, voice]);
    useEffect(() => {
        let active = true;
        async function poll() { try { if (active) await load(); } catch { if (active) setError(l.failure); } }
        void poll(); const timer = setInterval(() => void poll(), 4000);
        return () => { active = false; clearInterval(timer); };
    }, [load, l.failure]);
    async function generate() {
        setBusy(true); setError('');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice, retry: job?.status === 'failed' }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message === 'COMPLETE_ANSWER_REQUIRED' ? l.missing : response.status === 403 || response.status === 429 ? l.limited : l.failure);
            setJob(data.job);
        } catch (error) { setError(error instanceof Error ? error.message : l.failure); }
        finally { setBusy(false); }
    }
    const running = !!job && ['queued','planning','rendering'].includes(job.status);
    const media = job ? endpoint + '/media?job=' + job.id : '';
    const failure = job?.error === 'EDGE_TTS_FAILED' ? l.edgeFailed : job?.error === 'INVALID_ARITHMETIC' ? l.invalid : job?.error === 'TASK_INTERRUPTED' ? l.interrupted : l.failed;
    return <section className="space-y-4 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-sky-50 to-amber-50 p-5 text-slate-900">
        <h2 className="text-xl font-bold">{l.title}</h2><p className="text-sm">{l.hint}</p>
        <label className="flex items-center gap-3">{l.voice}<select aria-label={l.voice} value={voice} onChange={e => { setVoice(e.target.value); setJob(null); }} className="min-h-11 rounded-xl border bg-white px-3" disabled={running || busy}>
            <option value="zh-CN-XiaoxiaoNeural">{l.girl}</option><option value="zh-CN-YunxiNeural">{l.boy}</option>
        </select></label>
        {(!job || job.status === 'failed') && <Button disabled={busy} onClick={() => void generate()}>{job ? l.retry : l.generate}</Button>}
        {job && <p role="status">{job.status === 'unsupported' ? job.error : job.status === 'failed' ? failure : l[job.status]}{job.status === 'rendering' ? ' ' + job.progress + '%' : ''}</p>}
        {job?.status === 'completed' && <><video controls playsInline preload="metadata" src={media} className="aspect-video w-full rounded-xl bg-black" /><a href={media + '&download=1'} className="inline-block text-primary underline">{l.download}</a><p className="text-xs">{l.review}</p></>}
        {error && <p role="alert" className="text-red-700">{error}</p>}<p className="text-xs text-slate-600">{l.cache}</p>
    </section>;
}
