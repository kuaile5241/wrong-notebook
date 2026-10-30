import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeFigureSvg } from '@/lib/figure-svg';
import * as Engine from './vendor/engine';
import type { BankQuestion, Dependency, PublicQuestion, Topic } from './types';

export const DATASET_REVISION = '068db3c2550626529269d40939e3c93311a61349';
// 本次快照只追加数据，原题、知识点和先修关系均逐条核实未改，允许旧会话继续。
export const COMPATIBLE_DATASET_REVISIONS = [DATASET_REVISION, '27f7cce7e8c875fd740184c93e99d0777ae8bf06'];
export const SUBJECT_NAMES: Record<string, string> = { math: '数学', english: '英语', physics: '物理', chinese: '语文', science: '科学', morality: '道德与法治', history: '历史' };
export function topicSubject(topic: Topic): string {
    return topic.subject || (topic.id.startsWith('cnm_') ? 'math' : topic.id.startsWith('cne_') ? 'english' : '');
}
export function topicStage(topic: Topic) { return topic.grade <= 6 ? 'primary' : topic.grade <= 9 ? 'junior_high' : 'senior_high'; }
export function volumeLabel(topic: Topic) {
    if (topic.grade <= 9) return `${topic.grade}年级${topic.semester}册`;
    const subject = topicSubject(topic);
    const offset = subject === 'math' ? 12 : 13;
    return topic.grade < offset ? `必修${topic.grade - 9}` : `选择性必修${topic.grade - offset + 1}`;
}
let cached: ReturnType<typeof loadCatalog> | undefined;
function loadCatalog() {
    const read = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'resources/learning', name), 'utf8'));
    const topics = (read('topics.json') as Topic[]).map(t => ({ id: t.id, name: t.name, subject: t.subject,
        grade: t.grade, semester: t.semester, chapter: t.chapter, description: t.description,
        mastery_criteria: t.mastery_criteria, external: t.external }));
    const dependencies = read('dependencies.json') as Dependency[];
    const questions = (read('questions.json') as BankQuestion[]).map(q => ({
        ...q, figure: sanitizeFigureSvg(q.figure) || undefined,
        choices: q.choices?.map(c => ({ ...c, figure: sanitizeFigureSvg(c.figure) || undefined })),
    }));
    return { topics, dependencies, questions, byId: new Map(topics.map(t => [t.id, t])),
        questionsById: new Map(questions.map(q => [q.id, q])),
        // 教学诊断仅沿硬先修回溯；软关系不用于推断孩子不会哪些基础。
        graph: Engine.buildGraph(topics, dependencies.filter(d => d.strength === 'hard'), questions) };
}
export function getCatalog() { return cached ??= loadCatalog(); }
export function publicQuestion(q: BankQuestion): PublicQuestion {
    // 白名单输出，防止 verify 或未来新增字段泄露答案。
    return { id: q.id, topicId: q.topicId, type: q.type, difficulty: q.difficulty, prompt: q.prompt,
        choices: q.choices, figure: q.figure, hideChoiceText: q.hideChoiceText, unordered: q.unordered, percent: q.percent };
}
