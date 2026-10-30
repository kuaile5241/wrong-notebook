import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure } from '@/lib/learning/auth';
import { parseLearning } from '@/lib/learning/session';
import { buildLesson, questionLesson, speechChunks, speechText } from '@/lib/lesson-content';
import type { LessonContent } from '@/lib/lesson-content';
import { checkAudioQuota, LessonAudioError, synthesizeLessonAudio } from '@/lib/lesson-audio';

const schema = z.object({ source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('error'), id: z.string().max(100) }),
    z.object({ kind: z.literal('learning'), id: z.string().max(100), questionId: z.string().max(100) }),
]), fingerprint: z.string().max(20), step: z.number().int().min(0).max(1000), chunk: z.number().int().min(0).max(1000), mode: z.enum(['auto', 'natural', 'compatible']).default('auto') });

export async function POST(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = schema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ code: 'INVALID_AUDIO_REQUEST' }, { status: 400 });
        const { source, fingerprint, step, chunk } = parsed.data;
        let content: LessonContent | undefined;
        if (source.kind === 'error') {
            const item = await prisma.errorItem.findFirst({ where: { id: source.id, userId: user.id }, select: { questionText: true, answerText: true, analysis: true } });
            if (item) content = { question: item.questionText, answer: item.answerText, analysis: item.analysis };
        } else {
            const row = await prisma.learningSession.findFirst({ where: { id: source.id, userId: user.id } });
            // 只允许已提交的题目讲解，不能用朗读接口提前提取下一题答案。
            const h = row && parseLearning(row.state).history.find(h => h.question.id === source.questionId);
            if (h) content = questionLesson(h.question);
        }
        if (!content) return NextResponse.json({ code: 'LESSON_NOT_FOUND' }, { status: 404 });
        const lesson = buildLesson(content);
        if (fingerprint !== lesson.fingerprint) return NextResponse.json({ code: 'LESSON_CHANGED' }, { status: 409 });
        const selected = lesson.steps[step], text = selected && speechChunks(speechText(selected.markdown, lesson.language))[chunk];
        if (!text) return NextResponse.json({ code: 'INVALID_AUDIO_REQUEST' }, { status: 400 });
        checkAudioQuota(user.id);
        const audio = await synthesizeLessonAudio(user.id, text, req.signal, lesson.language, parsed.data.mode);
        return new NextResponse(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) {
        if (error instanceof LessonAudioError) return NextResponse.json({ code: error.code }, { status: error.status });
        return learningFailure(error);
    }
}
