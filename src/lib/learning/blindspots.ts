import { getCatalog, topicSubject } from './catalog';
import { parseLearning } from './session';
import type { AnswerHistory } from './types';

export interface BlindspotChapter {
    chapter: string; volume: string; topicIds: string[]; names: string[]; weak: number; pending: number;
}
interface LearningRecord { id: string; state: string; updatedAt: Date }

/** 从账号保存的学习快照汇总；推断掌握不抹去实测错题，自评通过不当成实测。 */
export function summarizeBlindspots(records: LearningRecord[], subject: string, volume: string): BlindspotChapter[] {
    const catalog = getCatalog();
    const latest = new Map<string, 'weak' | 'pending' | 'passed'>();
    for (const row of [...records].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id))) {
        const state = parseLearning(row.state);
        const attempts = new Map<string, AnswerHistory[]>();
        for (const h of state.history) {
            const id = h.question.topicId;
            attempts.set(id, [...(attempts.get(id) ?? []), h]);
        }
        for (const [id, history] of attempts) {
            const result = state.engine?.status[id];
            const last = history.at(-1)!;
            const tail = history.slice(-2);
            // 至少两道不同题的规则判分通过才移出；单次做对或自评仍保留为待确认。
            const passed = tail.length === 2 && new Set(tail.map(h => h.question.id)).size === 2
                && tail.every(h => h.verdict === 'correct' && h.method === 'rule');
            if (passed) latest.set(id, 'passed');
            else if (last.verdict !== 'correct') latest.set(id, result?.s === 'weak' ? 'weak' : 'pending');
            else if (latest.has(id) && latest.get(id) !== 'passed') latest.set(id, 'pending');
        }
    }
    const groups = new Map<string, BlindspotChapter>();
    for (const [id, status] of latest) {
        if (status === 'passed') continue;
        const topic = catalog.byId.get(id);
        if (!topic || topicSubject(topic) !== subject) continue;
        const book = `${topic.grade}-${topic.semester}`;
        if (volume && book !== volume) continue;
        const key = JSON.stringify([book, topic.chapter]);
        const group = groups.get(key) ?? { chapter: topic.chapter, volume: book, topicIds: [], names: [], weak: 0, pending: 0 };
        group.topicIds.push(id); group.names.push(topic.name); group[status]++;
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.weak - a.weak || b.topicIds.length - a.topicIds.length || a.chapter.localeCompare(b.chapter, 'zh-CN'));
}
