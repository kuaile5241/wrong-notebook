import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ id: 'memory-a', request: vi.fn(), push: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: mocks.id ? { user: { id: mocks.id } } : null }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/learning/client', () => ({ learningRequest: mocks.request }));
import { TopicBrowser } from '@/components/learning/topic-browser';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { learningFiltersKey } from '@/lib/learning/preferences';
let root: Root, container: HTMLDivElement;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
async function render() { await act(async () => { root.render(<LanguageProvider><TopicBrowser /></LanguageProvider>); await flush(); }); }
async function change(index: number, value: string) { await act(async () => { const select = container.querySelectorAll('select')[index]; select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); await flush(); }); }
beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear(); mocks.id = 'memory-a'; vi.clearAllMocks();
    mocks.request.mockImplementation(async (url: string) => {
        const p = new URL(url, 'http://localhost').searchParams, subject = p.get('subject'), volume = p.get('volume') || '1-上', chapter = p.get('chapter');
        return { subjects: [{ key: 'math', name: '数学', topics: 2 }, { key: 'english', name: '英语', topics: 2 }], volumes: [{ key: '1-上', name: '1年级上册' }, { key: '2-下', name: '2年级下册' }], volume, chapters: ['第一单元', '第二单元'], topics: [{ id: 'topic', name: subject + volume + chapter, chapter: chapter || '第一单元', description: '描述' }], total: 1, recent: [] };
    });
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe('首页恢复上次选择', () => {
    it('首次目录请求就使用记忆，不先请求默认年级覆盖；切账号独立恢复', async () => {
        localStorage.setItem(learningFiltersKey('memory-a'), JSON.stringify({ subject: 'english', volume: '2-下', chapter: '第二单元', count: 20 }));
        await render(); expect(mocks.request.mock.calls[0][0]).toContain('subject=english'); expect(new URL(mocks.request.mock.calls[0][0], 'http://localhost').searchParams.get('volume')).toBe('2-下');
        expect([...container.querySelectorAll('select')].map(s => s.value)).toEqual(['english', '2-下', '20']);
        expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('第二单元');
        mocks.id = 'memory-b'; await render(); expect([...container.querySelectorAll('select')].map(s => s.value)).toEqual(['math', '1-上', '10']);
        mocks.id = 'memory-a'; await render(); expect([...container.querySelectorAll('select')].map(s => s.value)).toEqual(['english', '2-下', '20']);
    });
    it('修改后立即保存，离开重进仍保留年级和章节', async () => {
        await render(); await change(0, 'english'); await change(1, '2-下'); await change(2, '5');
        await act(async () => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === '第二单元')!; button.click(); await flush(); });
        expect(JSON.parse(localStorage.getItem(learningFiltersKey('memory-a'))!)).toEqual({ subject: 'english', volume: '2-下', chapter: '第二单元', count: 5 });
        await act(async () => root.render(<div />)); await render();
        expect([...container.querySelectorAll('select')].map(s => s.value)).toEqual(['english', '2-下', '5']); expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('第二单元');
    });
});
