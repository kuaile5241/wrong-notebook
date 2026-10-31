'use client';
import { useCallback, useSyncExternalStore } from 'react';
export interface KnowledgeFilters { subject: string; selected: string; stage: string; volume: string; domain: string; depth: number }
const defaults: KnowledgeFilters = { subject: 'math', selected: 'cnm_h217', stage: '', volume: '', domain: '', depth: 2 };
const cache = new Map<string, { raw: string | null; value: KnowledgeFilters; memoryOnly?: boolean }>(), listeners = new Set<() => void>();
function read(owner: string) {
    if (cache.get(owner)?.memoryOnly) return cache.get(owner)!.value;
    let raw: string | null = null; try { raw = localStorage.getItem('knowledge-filters:' + owner); } catch { return cache.get(owner)?.value ?? defaults; }
    const old = cache.get(owner); if (old?.raw === raw) return old.value;
    let parsed: Partial<KnowledgeFilters> = {}; try { parsed = JSON.parse(raw || '{}') || {}; } catch { /* 使用明确默认值。 */ }
    const value = { subject: ['math', 'english', 'physics', 'chinese', 'science', 'morality', 'history'].includes(parsed.subject || '') ? parsed.subject! : 'math', selected: typeof parsed.selected === 'string' ? parsed.selected.slice(0, 100) : defaults.selected,
        stage: ['', 'primary', 'junior', 'senior'].includes(parsed.stage || '') ? parsed.stage || '' : '', volume: typeof parsed.volume === 'string' ? parsed.volume.slice(0, 40) : '', domain: typeof parsed.domain === 'string' ? parsed.domain.slice(0, 100) : '', depth: [1, 2, 3, 9999].includes(parsed.depth || 0) ? parsed.depth! : 2 };
    cache.set(owner, { raw, value }); return value;
}
function subscribe(callback: () => void) { listeners.add(callback); window.addEventListener('storage', callback); return () => { listeners.delete(callback); window.removeEventListener('storage', callback); }; }
export function useKnowledgeFilters(owner: string) {
    const snapshot = useCallback(() => owner ? read(owner) : null, [owner]);
    const value = useSyncExternalStore(subscribe, snapshot, () => null);
    function save(next: KnowledgeFilters) { const raw = JSON.stringify(next); let memoryOnly = false; try { localStorage.setItem('knowledge-filters:' + owner, raw); } catch { memoryOnly = true; } cache.set(owner, { raw, value: next, memoryOnly }); listeners.forEach(f => f()); }
    return { value, save };
}
export function subjectForTopic(id: string) { return id.startsWith('cne_') ? 'english' : id.startsWith('cnp_') ? 'physics' : id.startsWith('cnc_') ? 'chinese' : id.startsWith('cns_') ? 'science' : id.startsWith('cnd_') ? 'morality' : id.startsWith('cnh_') ? 'history' : 'math'; }
