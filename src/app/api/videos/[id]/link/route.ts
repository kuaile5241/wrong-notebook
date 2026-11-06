import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure } from '@/lib/learning/auth';
import { videoId } from '@/lib/videos/schema';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        const { id } = await ctx.params;
        const data = z.object({ errorId: z.string().max(100), linked: z.boolean() }).safeParse(await req.json());
        if (!data.success || !videoId.safeParse(id).success) return new Response(null, { status: 400 });
        const item = await prisma.errorItem.findFirst({ where: { id: data.data.errorId, userId: user.id }, select: { id: true } });
        const video = await prisma.videoLesson.findFirst({ where: { id, published: true, archived: false }, select: { id: true } });
        if (!item || !video) return new Response(null, { status: 404 });
        const key = { userId: user.id, errorItemId: item.id, videoId: id };
        if (data.data.linked) await prisma.videoLessonLink.upsert({ where: { userId_errorItemId_videoId: key }, create: key, update: {} });
        else await prisma.videoLessonLink.deleteMany({ where: key });
        return NextResponse.json({ ok: true });
    } catch (error) { return learningFailure(error); }
}
