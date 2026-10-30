'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface VoiceConfig { enabled: boolean; apiKey: string; workspaceId: string; voice: 'longanyang' | 'longxiaochun_v3'; ready?: boolean }
export function VoiceSettings() {
    const l = useLanguage().t.lesson;
    const [config, setConfig] = useState<VoiceConfig>({ enabled: false, apiKey: '', workspaceId: '', voice: 'longxiaochun_v3' });
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [loaded, setLoaded] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const audio = useRef<HTMLAudioElement | null>(null), url = useRef('');
    const abort = useRef<AbortController | null>(null);
    const clear = () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); url.current = ''; };
    useEffect(() => {
        let alive = true;
        void fetch('/api/voice-settings').then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(v => { if (alive) { setConfig(v); setLoaded(true); } }).catch(() => { if (alive) setMessage(l.failed); });
        return () => { alive = false; abort.current?.abort(); clear(); };
    }, [l.failed]);
    async function save(test: boolean) {
        setBusy(true); setMessage(''); setPreviewUrl(''); clear();
        abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
        try {
            const r = await fetch('/api/voice-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config), signal: controller.signal });
            if (!r.ok) { setMessage(l.configFailed); return; }
            setConfig(c => ({ ...c, apiKey: c.apiKey ? '********' : '' }));
            if (!test) { setMessage(l.saved); return; }
            const result = await fetch('/api/voice-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }), signal: controller.signal });
            if (!result.ok) { const body = await result.json(); setMessage(body.code === 'AUDIO_CREDENTIALS' ? l.credentials : body.code === 'AUDIO_NOT_CONFIGURED' ? l.notConfigured : l.failed); return; }
            const blob = await result.blob(); if (controller.signal.aborted) return;
            url.current = URL.createObjectURL(blob); setPreviewUrl(url.current); setMessage(l.tapPreview);
        } catch { setMessage(l.failed); } finally { setBusy(false); }
    }
    return <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:bg-violet-950/20">
        <h3 className="font-bold">{l.voiceSettings}</h3><p className="text-sm text-muted-foreground">{l.configHint}</p>
        <fieldset disabled={!loaded || busy} className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />{l.enableNatural}</label>
            <label className="block text-sm">{l.workspace}<input autoComplete="off" className="mt-1 block min-h-10 w-full rounded border bg-background px-3" value={config.workspaceId} onChange={e => setConfig({ ...config, workspaceId: e.target.value })} /></label>
            <label className="block text-sm">{l.apiKey}<input type="password" autoComplete="new-password" className="mt-1 block min-h-10 w-full rounded border bg-background px-3" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} /></label>
            <label className="block text-sm">{l.voice}<select className="ml-2 min-h-10 rounded border bg-background px-3" value={config.voice} onChange={e => setConfig({ ...config, voice: e.target.value as VoiceConfig['voice'] })}><option value="longxiaochun_v3">{l.female}</option><option value="longanyang">{l.male}</option></select></label>
            <div className="flex flex-wrap gap-2"><Button onClick={() => void save(false)}>{l.saveVoice}</Button><Button variant="outline" onClick={() => void save(true)}>{busy ? l.preparing : l.previewVoice}</Button></div>
        </fieldset>
        <p role="status" className="text-sm">{message}</p>
        {previewUrl && <audio ref={audio} controls autoPlay src={previewUrl} className="max-w-full" aria-label={l.previewVoice} />}
    </section>;
}
