import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { generationId, VOICES, pumpVideoJobs, reconcileVideoJobs, videoJobView } from '@/lib/video-generation/jobs';
const logger = createLogger('video-generation-route');
const schema = z.object({ voice: z.enum(VOICES).default(VOICES[0]), retry: z.boolean().default(false) });
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        const item = await prisma.errorItem.findFirst({ where: { id: (await ctx.params).id, userId: user.id } });
        if (!item) return new Response(null, { status: 404 });
        await reconcileVideoJobs();
        const voice = new URL(req.url).searchParams.get('voice') || VOICES[0];
        if (!VOICES.includes(voice as typeof VOICES[number])) return new Response(null, { status: 400 });
        const source = JSON.stringify({ question: item.questionText || '', answer: item.answerText || '', analysis: item.analysis || '' });
        const job = await prisma.videoGeneration.findUnique({ where: { id: generationId(user.id, item.id, source, voice) } });
        return NextResponse.json({ job: job ? await videoJobView(job) : null }, noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        const parsed = schema.safeParse(await req.json());
        if (!parsed.success) return new Response(null, { status: 400 });
        const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        if (!account.canUseAi && user.role !== 'admin') return new Response(null, { status: 403 });
        const item = await prisma.errorItem.findFirst({ where: { id: (await ctx.params).id, userId: user.id } });
        if (!item) return new Response(null, { status: 404 });
        if (!item.questionText?.trim() || !item.answerText?.trim() || !item.analysis?.trim()) return NextResponse.json({ message: 'COMPLETE_ANSWER_REQUIRED' }, { status: 400 });
        const source = JSON.stringify({ question: item.questionText, answer: item.answerText, analysis: item.analysis });
        const id = generationId(user.id, item.id, source, parsed.data.voice);
        let job = await prisma.videoGeneration.findUnique({ where: { id } });
        if (!job) {
            const count = await prisma.videoGeneration.count({ where: { userId: user.id, status: { in: ['queued','planning','rendering'] } } });
            if (count >= 2) return new Response(null, { status: 429 });
            job = await prisma.videoGeneration.upsert({ where: { id }, update: {}, create: { id, userId: user.id, errorItemId: item.id, source, voice: parsed.data.voice } });
        } else if (job.status === 'failed' && parsed.data.retry) {
            await prisma.videoGeneration.updateMany({ where: { id, status: 'failed' }, data: { status: 'queued', error: '' } });
            job = await prisma.videoGeneration.findUniqueOrThrow({ where: { id } });
        }
        void pumpVideoJobs().catch(error => logger.error({ error }, 'Video queue failed'));
        return NextResponse.json({ job: await videoJobView(job) }, { status: 202, ...noStore });
    } catch (error) { return learningFailure(error); }
}
