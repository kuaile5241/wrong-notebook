export interface Topic {
    domain?: string; type?: string; standards?: { id: string; confidence: string; note?: string }[]; mathLinks?: { id: string; reason: string }[]; root_reason?: string;
    id: string; name: string; subject?: string; grade: number; semester: string;
    chapter: string; description: string; mastery_criteria: string[]; external?: boolean;
    prerequisites?: { id: string; name: string; strength: string }[];
}
export interface Dependency { topicId: string; prerequisiteId: string; strength: 'hard' | 'soft'; reason: string }
export interface BankQuestion {
    id: string; topicId: string; type: 'choice' | 'numeric' | 'short' | 'self';
    difficulty: string; prompt: string; answer: string; explanation: string;
    choices?: { key: string; text: string; figure?: string }[]; figure?: string;
    hideChoiceText?: boolean; unordered?: boolean; accept?: string[]; percent?: boolean;
}
export type PublicQuestion = Omit<BankQuestion, 'answer' | 'explanation' | 'accept'>;
export interface EngineSession {
    graphMode?: 'full';
    targets: string[]; limit: number; confirm: number; order: string[];
    status: Record<string, { s: string; src: string }>; stack: string[];
    answers: { id: string; qid: string; result: string; text?: string }[];
    attempts: Record<string, { qid: string; result: string }[]>;
    mode: string; scope: string[] | null; seed: string; avoid: string[];
}
export interface AnswerHistory {
    requestId: string; question: BankQuestion; answer: string;
    verdict: 'correct' | 'wrong' | 'skip'; method: 'rule' | 'self'; errorItemId?: string;
}
export interface StoredLearning {
    engine: EngineSession | null; queue: string[]; history: AnswerHistory[];
}
export interface TopicStatus { id: string; name: string; chapter: string; status: 'direct' | 'self' | 'inferred' | 'shaky' | 'weak' | 'pending' | 'untested' }
export interface LearningView {
    id: string; title: string; mode: string; revision: number; finished: boolean;
    answered: number; limit: number; correct: number; question: PublicQuestion | null;
    topic: Topic | null; history: AnswerHistory[]; topics: TopicStatus[];
    relatedNames?: Record<string, string>; network?: { topics: Topic[]; dependencies: Dependency[] }; report?: DiagnosticReport; configuration?: { topicIds: string[]; count: number; confirm: number; mode: string; profileId: string };

}

export interface DiagnosticReport {
    asked: number; limit: number; limitReached: boolean; mastered: string[]; shaky: string[]; weak: string[]; unconfirmed: string[]; untested: string[];
    roots: { id: string; pendingPrereqs: string[]; outOfScopePrereqs: string[]; externalPrereqs: string[] }[];
    path: { id: string; status: string; isRoot: boolean; isTarget: boolean }[];
    chapters: { key: string; label: string; total: number; mastered: number; shaky: number; weak: number; untested: number; weakIds: string[]; shakyIds: string[]; untestedIds: string[] }[];
}
