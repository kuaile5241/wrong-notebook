'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';

export interface LearningFilters { subject: string; volume: string; chapter: string; count: number }
export const DEFAULT_LEARNING_FILTERS: LearningFilters = { subject: 'math', volume: '', chapter: '', count: 10 };
const listeners = new Set<() => void>();
const snapshots = new Map<string, { raw: string | null; value: LearningFilters; memoryOnly?: boolean }>();
export function learningFiltersKey(userId: string) { return `learning-filters:v1:${userId}`; }
export function parseLearningFilters(raw: string | null): LearningFilters {
    try {
        const value: unknown = JSON.parse(raw || 'null');
        if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_LEARNING_FILTERS;
        const v = value as Record<string, unknown>;
        return {
            subject: typeof v.subject === 'string' && /^[a-z][a-z_]{0,39}$/.test(v.subject) ? v.subject : 'math',
            volume: typeof v.volume === 'string' && v.volume.length <= 40 ? v.volume : '',
            chapter: typeof v.chapter === 'string' && v.chapter.length <= 160 ? v.chapter : '',
            count: typeof v.count === 'number' && [5, 10, 20, 30].includes(v.count) ? v.count : 10,
        };
    } catch { return DEFAULT_LEARNING_FILTERS; }
}
export function readLearningFilters(userId: string): LearningFilters {
    const previous = snapshots.get(userId);
    if (previous?.memoryOnly) return previous.value;
    try {
        const raw = localStorage.getItem(learningFiltersKey(userId));
        if (previous?.raw === raw) return previous.value;
        const value = parseLearningFilters(raw); snapshots.set(userId, { raw, value }); return value;
    } catch { return previous?.value ?? DEFAULT_LEARNING_FILTERS; }
}
export function saveLearningFilters(userId: string, patch: Partial<LearningFilters>) {
    const value = parseLearningFilters(JSON.stringify({ ...readLearningFilters(userId), ...patch })), raw = JSON.stringify(value);
    if (snapshots.get(userId)?.raw === raw) return;
    let memoryOnly = false;
    try { localStorage.setItem(learningFiltersKey(userId), raw); } catch { memoryOnly = true; }
    snapshots.set(userId, { raw, value, memoryOnly }); listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
    listeners.add(listener); window.addEventListener('storage', listener);
    return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
}
/** 水合完成、账号就绪后才读取并请求上次选择，防止默认值先覆盖记忆。 */
export function useLearningFilters() {
    const { data: session } = useSession(), userId = session?.user?.id || '';
    const getSnapshot = useCallback(() => userId ? readLearningFilters(userId) : null, [userId]);
    const stored = useSyncExternalStore(subscribe, getSnapshot, () => null);
    const update = useCallback((patch: Partial<LearningFilters>) => { if (userId) saveLearningFilters(userId, patch); }, [userId]);
    return { filters: stored ?? DEFAULT_LEARNING_FILTERS, ready: !!stored && !!userId, userId, update };
}
export function reconcileLearningFilters(filters: LearningFilters, catalog: { subjects: { key: string }[]; volumes: { key: string }[]; volume: string; chapters: string[] }): LearningFilters {
    if (!catalog.subjects.some(s => s.key === filters.subject)) return { ...DEFAULT_LEARNING_FILTERS, count: filters.count };
    const volume = catalog.volumes.some(v => v.key === filters.volume) ? filters.volume : catalog.volumes.some(v => v.key === catalog.volume) ? catalog.volume : catalog.volumes[0]?.key || '';
    const chapter = (!filters.volume || filters.volume === volume) && catalog.chapters.includes(filters.chapter) ? filters.chapter : '';
    return { ...filters, volume, chapter };
}
