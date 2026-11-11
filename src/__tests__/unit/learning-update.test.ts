// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { getCatalog, LEGACY_DATASET_REVISION, DATASET_REVISION, sameQuestion } from '@/lib/learning/catalog';
import { parseLearning, nextLearningQuestion, applyLearningAnswer } from '@/lib/learning/session';
import { restoreLearningState } from '@/lib/learning/backup';
import { replayLearning } from '@/lib/learning/replay';
import { summarizeBlindspots } from '@/lib/learning/blindspots';
import { subjectForTopic } from '@/lib/learning/knowledge-preferences';
import * as Engine from '@/lib/learning/vendor/engine';
import type { StoredLearning } from '@/lib/learning/types';
describe('上游快照升级与原始记录隔离', () => {
 it('固定数据和保留快照与公开清单的哈希一致', () => {
  const manifest=JSON.parse(readFileSync('resources/learning/manifest.json','utf8'));
  expect(manifest.revision).toBe(DATASET_REVISION);
  for(const file of manifest.files)expect(createHash('sha256').update(readFileSync(join(process.cwd(),file.path))).digest('hex')).toBe(file.sha256);
 });
 it('原题号被改写时，旧练习、撤销和备份仍读取原题', () => {
  const legacy = getCatalog(LEGACY_DATASET_REVISION), q = legacy.questionsById.get('cnc_p124_q3')!;
  expect(q.prompt).toContain('离离原上草'); expect(getCatalog().questionsById.get(q.id)!.prompt).toContain('水洒');
  const raw = JSON.stringify({ datasetVersion: DATASET_REVISION, engine: null, queue: [q.id], history: [] });
  const state = parseLearning(raw, LEGACY_DATASET_REVISION); expect(nextLearningQuestion(state)!.prompt).toBe(q.prompt);
  const applied = applyLearningAnswer(state, q, { revision: 0, requestId: randomUUID(), questionId: q.id, answer: '', skip: true });
  if ('manual' in applied) throw new Error('unexpected');
  expect(replayLearning(applied.state, []).datasetVersion).toBe(LEGACY_DATASET_REVISION);
  expect(nextLearningQuestion(replayLearning(applied.state, []))!.prompt).toBe(q.prompt);
  const restored = restoreLearningState(JSON.stringify(applied.state), 'practice', new Map(), LEGACY_DATASET_REVISION);
  expect(restored.history[0].question.prompt).toBe(q.prompt); expect(restored.datasetVersion).toBe(LEGACY_DATASET_REVISION);
  expect(sameQuestion(q, getCatalog().questionsById.get(q.id))).toBe(false);
 });
 it('旧古诗的薄弱记录不能套用到新版语气题，未改写题仍可沿用', () => {
  const q = getCatalog(LEGACY_DATASET_REVISION).questionsById.get('cnc_p124_q3')!;
  const state: StoredLearning = { engine: null, queue: [q.id], history: [{ requestId: randomUUID(), question: q, answer: '', verdict: 'wrong', method: 'rule' }] };
  expect(summarizeBlindspots([{ id: 'old', datasetVersion: LEGACY_DATASET_REVISION, state: JSON.stringify(state), updatedAt: new Date() }], 'chinese', '')).toEqual([]);
  expect(sameQuestion(getCatalog(LEGACY_DATASET_REVISION).questionsById.get('cnm_p001_q1')!, getCatalog().questionsById.get('cnm_p001_q1'))).toBe(true);
 });
 it('新增学科可按编号定位，教材对照不改变原学科归属', () => {
  for (const [prefix,subject] of [['cng_','geography'],['cnb_','biology'],['cnk_','chemistry']]) {
   const topic=getCatalog().topics.find(t=>t.id.startsWith(prefix))!; expect(topic).toBeTruthy(); expect(subjectForTopic(topic.id)).toBe(subject);
  }
 });
 it('新版整体筛查只通过硬先修推断，不把建议先修当作掌握', () => {
  const topics=getCatalog().topics.slice(0,2).map((t,i)=>({...t,id:i?'target':'base'}));
  const questions=[1,2].map(i=>({...getCatalog().questions[0],id:'target_q'+i,topicId:'target'}));
  for (const strength of ['soft','hard'] as const) {
   const graph=Engine.buildGraph(topics,[{topicId:'target',prerequisiteId:'base',strength,reason:''}],questions);
   let state=Engine.createSession(graph,['base','target'],{limit:5,confirm:2,seed:'test',mode:'screen'});
   for(const q of questions)state=Engine.applyAnswer(graph,state,'target','correct',{text:'',pin:true,qid:q.id});
   expect(state.status.target.s).toBe('mastered'); expect(state.status.base?.s).toBe(strength==='hard'?'mastered':undefined);
  }
 });
});
