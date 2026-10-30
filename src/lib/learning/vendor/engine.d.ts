import type { Topic, Dependency, BankQuestion, EngineSession } from '../types';
export interface Graph { byId: Record<string, Topic>; prereqs: Record<string, { id: string; strength: string }[]> }
export function buildGraph(topics: Topic[], dependencies: Dependency[], questions: BankQuestion[]): Graph;
export function createSession(graph: Graph, targets: string[], options: { limit: number; confirm: number; seed: string; avoid?: string[] }): EngineSession;
export function nextItem(graph: Graph, session: EngineSession): { topicId: string; question: BankQuestion; attempt: number } | null;
export function applyAnswer(graph: Graph, session: EngineSession, id: string, result: string, extra: { text: string }): EngineSession;
export function judgeQuestion(question: BankQuestion, answer: string): { verdict: 'correct' | 'wrong' | 'manual'; reason?: string };
