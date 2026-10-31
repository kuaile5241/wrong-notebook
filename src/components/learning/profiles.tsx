'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ProfileSettings } from '@/lib/learning/profiles';
import { learningRequest } from './client';
interface ProfilesView extends ProfileSettings { sessions: { id: string; title: string; mode: string; profileId: string; status: string; updatedAt: string }[] }
export function useLearningProfiles() {
    const { data: session } = useSession(), owner = session?.user?.id || '', [stored, setStored] = useState<{ owner: string; value: ProfilesView } | null>(null), [error, setError] = useState(false);
    const load = useCallback(async () => { if (!owner) return; try { const value = await learningRequest<ProfilesView>('/api/learning/profiles'); setStored({ owner, value }); setError(false); } catch { setError(true); } }, [owner]);
    useEffect(() => { if (!owner) return; let cancelled = false; learningRequest<ProfilesView>('/api/learning/profiles').then(value => { if (!cancelled) { setStored({ owner, value }); setError(false); } }).catch(() => { if (!cancelled) setError(true); }); return () => { cancelled = true; }; }, [owner]);
    const data = stored?.owner === owner ? stored.value : null;
    const save = async (value: Record<string, unknown>) => { if (!data) return; await learningRequest('/api/learning/profiles', { ...value, revision: data.revision }); await load(); };
    return { data, save, error, load };
}
export function ProfileSelector({ data, onChange }: { data: ProfilesView; onChange: (id: string) => void }) {
    const { t } = useLanguage(); return <label className="text-sm">{t.knowledge.chooseProfile}<select aria-label={t.knowledge.chooseProfile} className="ml-2 min-h-11 max-w-full rounded-xl border bg-background px-3" value={data.active} onChange={e => onChange(e.target.value)}><option value="">{t.knowledge.profileDefault}</option>{data.profiles.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
}
export function LearningProfiles() {
    const { t } = useLanguage(), l = t.knowledge, { data, save, error, load } = useLearningProfiles(), [name, setName] = useState(''), [grade, setGrade] = useState(3), [busy, setBusy] = useState(false), [failure, setFailure] = useState(false);
    async function update(body: Record<string, unknown>) { setBusy(true); setFailure(false); try { await save(body); setName(''); } catch { setFailure(true); } finally { setBusy(false); } }
    return <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-8"><Link className="text-primary underline" href="/learn">← {l.back}</Link><h1 className="text-3xl font-bold">{l.profiles}</h1>{(error || failure) && <p role="alert">{l.failure}<Button onClick={load}>{t.learning.retry}</Button></p>}
        <form className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4" onSubmit={e => { e.preventDefault(); void update({ action: 'create', name, grade }); }}><Input required maxLength={40} aria-label={l.profileName} placeholder={l.profileName} value={name} onChange={e => setName(e.target.value)} /><select className="rounded-xl border bg-background p-2" aria-label={l.grade} value={grade} onChange={e => setGrade(Number(e.target.value))}>{t.textbooks.gradeNames.map((label, i) => <option value={i + 1} key={label}>{label}</option>)}</select><Button disabled={busy || !data}>{l.newProfile}</Button></form>
        {data && <><ProfileSelector data={data} onChange={id => void update({ action: 'select', id })} /><div className="grid gap-3 sm:grid-cols-2">{data.profiles.map(p => <article className="space-y-3 rounded-2xl border bg-card p-4" key={p.id}><h2 className="font-bold">{p.name} · {t.textbooks.gradeNames[p.grade - 1]}</h2><form className="flex gap-2" onSubmit={e => { e.preventDefault(); const values = new FormData(e.currentTarget); void update({ action: 'edit', id: p.id, name: values.get('name'), grade: Number(values.get('grade')) }); }}><Input name="name" aria-label={`${l.profileName} ${p.name}`} defaultValue={p.name} maxLength={40} required /><select name="grade" aria-label={`${l.grade} ${p.name}`} className="max-w-28 rounded-xl border bg-background px-2" defaultValue={p.grade}>{t.textbooks.gradeNames.map((label, i) => <option value={i + 1} key={label}>{label}</option>)}</select><Button disabled={busy} variant="outline">{l.save}</Button></form><Button disabled={busy} variant="outline" onClick={() => void update({ action: 'edit', id: p.id, archived: !p.archived })}>{p.archived ? l.restore : l.archive}</Button><p className="text-sm">{l.records}：{data.sessions.filter(s => s.profileId === p.id).length}</p></article>)}</div><section className="space-y-3"><h2 className="text-xl font-bold">{l.records}</h2>{data.sessions.filter(s => s.profileId === data.active).map(s => <Link className="block rounded-xl border bg-card p-4" key={s.id} href={'/learn/' + s.id}>{s.title} · {s.status} · {new Date(s.updatedAt).toLocaleString()}</Link>)}</section></>}
    </main>;
}
