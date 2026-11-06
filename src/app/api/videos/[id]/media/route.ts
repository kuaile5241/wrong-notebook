import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure } from '@/lib/learning/auth';
import { videoFile } from '@/lib/videos/storage';
import { videoId } from '@/lib/videos/schema';
import { mediaRange } from '@/lib/vocabulary/media';
async function serve(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        const { id } = await ctx.params;
        if (!videoId.safeParse(id).success) return new Response(null, { status: 404 });
        const video = await prisma.videoLesson.findUnique({ where: { id } });
        if (!video || (user.role !== 'admin' && (!video.published || video.archived))) return new Response(null, { status: 404 });
        const path = videoFile(id);
        const file = await stat(path).catch(() => null);
        if (!file) return new Response(null, { status: 404 });
        const range = mediaRange(req.headers.get('range'), file.size);
        if (range === false) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${file.size}` } });
        const start = range ? range.start : 0, end = range ? range.end : file.size - 1;
        const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1),
            'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
            ...(range ? { 'Content-Range': `bytes ${start}-${end}/${file.size}` } : {}),
            ...(new URL(req.url).searchParams.has('download') ? { 'Content-Disposition': 'attachment; filename="lesson.mp4"' } : {}) };
        const stream = req.method === 'HEAD' ? null : Readable.toWeb(createReadStream(path, { start, end }));
        return new Response(stream as ReadableStream<Uint8Array> | null, { status: range ? 206 : 200, headers });
    } catch (error) { return learningFailure(error); }
}
export const GET = serve;
export const HEAD = serve;
