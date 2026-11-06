import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { videoId, videoMetadata } from '@/lib/videos/schema';
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        if (user.role !== 'admin') return new NextResponse(null, { status: 403 });
        const { id } = await ctx.params;
        if (!videoId.safeParse(id).success) return new NextResponse(null, { status: 404 });
        const data = videoMetadata.extend({ revision: z.number().int().nonnegative() }).safeParse(await req.json());
        if (!data.success) return new NextResponse(null, { status: 400 });
        const { revision, topics, ...fields } = data.data;
        const changed = await prisma.videoLesson.updateMany({ where: { id, revision }, data: { ...fields, topics: JSON.stringify(topics), revision: { increment: 1 } } });
        return changed.count ? NextResponse.json({ ok: true }, noStore) : new NextResponse(null, { status: 409 });
    } catch (error) { return learningFailure(error); }
}
