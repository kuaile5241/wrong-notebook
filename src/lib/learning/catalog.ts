import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeFigureSvg } from '@/lib/figure-svg';
import * as Engine from './vendor/engine';
import * as LegacyEngine from './vendor/engine-068db3';
import type { BankQuestion, Dependency, PublicQuestion, Topic } from './types';

export const DATASET_REVISION = '07941bcf70bff6a59105e953b8d0e78f1dfa0d55';
// 已有记录使用不可变旧快照继续；新记录使用新版，禁止同题号改写串分。
export const LEGACY_DATASET_REVISION = '068db3c2550626529269d40939e3c93311a61349';
export const COMPATIBLE_DATASET_REVISIONS = [DATASET_REVISION, LEGACY_DATASET_REVISION, '27f7cce7e8c875fd740184c93e99d0777ae8bf06'];
export const SUBJECT_NAMES: Record<string, string> = { math: '数学', english: '英语', physics: '物理', chinese: '语文', science: '科学', morality: '道德与法治', history: '历史', geography: '地理', biology: '生物', chemistry: '化学' };
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
const cached = new Map<string, ReturnType<typeof loadCatalog>>();
function loadCatalog(revision: string) {
    const legacy = revision !== DATASET_REVISION, engine = legacy ? LegacyEngine : Engine;
    const read = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'resources/learning', legacy ? 'legacy-068db3c' : '', name), 'utf8'));
    const topics = (read('topics.json') as Topic[]).map(t => ({ id: t.id, name: t.name, subject: t.subject,
        domain: t.domain, type: t.type, standards: t.standards, mathLinks: t.mathLinks, root_reason: t.root_reason,
        grade: t.grade, semester: t.semester, chapter: t.chapter, description: t.description,
        mastery_criteria: t.mastery_criteria, external: t.external }));
    const dependencies = read('dependencies.json') as Dependency[];
    const questions = (read('questions.json') as BankQuestion[]).map(q => ({
        ...q, figure: sanitizeFigureSvg(q.figure) || undefined,
        choices: q.choices?.map(c => ({ ...c, figure: sanitizeFigureSvg(c.figure) || undefined })),
    }));
    return { engine, topics, dependencies, questions, byId: new Map(topics.map(t => [t.id, t])),
        questionsById: new Map(questions.map(q => [q.id, q])),
        // 新会话接回原版完整关系；旧会话保留硬先修图，避免改变既有选题顺序。
        fullGraph: engine.buildGraph(topics, dependencies, questions),
        graph: engine.buildGraph(topics, dependencies.filter(d => d.strength === 'hard'), questions) };
}
export function getCatalog(revision = DATASET_REVISION) {
    if (!COMPATIBLE_DATASET_REVISIONS.includes(revision)) throw new Error('UNKNOWN_DATASET');
    const key = revision === DATASET_REVISION ? revision : LEGACY_DATASET_REVISION;
    if (!cached.has(key)) cached.set(key, loadCatalog(key));
    return cached.get(key)!;
}
export function publicQuestion(q: BankQuestion): PublicQuestion {
    // 白名单输出，防止 verify 或未来新增字段泄露答案。
    return { id: q.id, topicId: q.topicId, type: q.type, difficulty: q.difficulty, prompt: q.prompt,
        choices: q.choices, figure: q.figure, hideChoiceText: q.hideChoiceText, unordered: q.unordered, percent: q.percent };
}

/** 只有题目内容一致才把旧作答用于新版避重和薄弱统计，改写题应重新测。 */
export function sameQuestion(a: BankQuestion, b: BankQuestion | undefined) {
    const identity = (q: BankQuestion) => JSON.stringify([q.topicId, q.type, q.prompt, q.answer, q.choices, q.figure, q.accept, q.unordered, q.percent]);
    return !!b && identity(a) === identity(b);
}
