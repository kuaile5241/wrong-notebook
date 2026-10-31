// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lessonSpeech, readWordLesson, wordLessonJsonSchema } from '@/lib/textbooks/lesson';
const rows = JSON.parse(readFileSync(join(process.cwd(), 'resources/textbooks/ljxj-english-3-upper-lessons.json'), 'utf8')) as { id: string; word: string; meaning: string; lesson: string }[];
describe('教材详细讲解内容和分段语音', () => {
    it('125词条均有独立词义、完整用法、250组双语例句与逐句讲解、易错和记忆提示', () => {
        expect(rows).toHaveLength(125); expect(new Set(rows.map(r => r.id)).size).toBe(125);
        for (const row of rows) {
            expect(wordLessonJsonSchema.safeParse(row.lesson).success, row.word).toBe(true);
            const x = readWordLesson(row.lesson)!; expect(x.overview).toContain(row.meaning); expect(x.usage.length).toBeGreaterThan(0); expect(x.pitfalls.length).toBeGreaterThan(0); expect(x.memory.length).toBeGreaterThan(5); expect(x.examples).toHaveLength(2);
            for (const ex of x.examples) { expect(ex.en.length).toBeGreaterThan(6); expect(ex.zh.length).toBeGreaterThan(3); expect(ex.analysis.length).toBeGreaterThan(20); expect(/[<>]/.test(ex.en + ex.analysis)).toBe(false); }
        }
    });
    it('词义保持教材语境，斜杠和省略号句型有完整读法，所有语音段都取持久正文', () => {
        const orange = rows.find(r => r.word === 'orange')!, aux = rows.find(r => r.word === 'do')!;
        expect(readWordLesson(orange.lesson)!.overview).toContain('橙色');
        for (const w of ['eye', 'ear']) expect(readWordLesson(rows.find(r => r.word === w)!.lesson)!.usage.join(' ')).toContain('an ' + w); expect(readWordLesson(aux.lesson)!.overview).toContain('助动词');
        for (const row of rows) {
            const term = { ...row, example: '', translation: '' };
            expect(lessonSpeech(term, 'word', 0)?.text).not.toMatch(/\.\.\.|\//);
            for (const part of ['overview', 'usage', 'pitfalls', 'memory', 'example', 'analysis']) expect(lessonSpeech(term, part, 0)?.text.length).toBeGreaterThan(0);
            expect(lessonSpeech(term, 'example', 2)).toBeUndefined(); expect(lessonSpeech(term, 'anything', 0)).toBeUndefined();
        }
    });
    it('旧备份没有讲解仍能读取，畸形结构和过长语音拒绝保存', () => {
        expect(readWordLesson('')).toBeUndefined(); expect(readWordLesson('{bad')).toBeUndefined(); expect(wordLessonJsonSchema.safeParse('{}').success).toBe(false);
        const x = readWordLesson(rows[0].lesson)!; x.usage = ['x'.repeat(700), 'y']; expect(wordLessonJsonSchema.safeParse(JSON.stringify(x)).success).toBe(false);
    });
});
