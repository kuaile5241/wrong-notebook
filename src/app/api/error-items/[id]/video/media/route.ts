import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure } from '@/lib/learning/auth';
import { videoFile } from '@/lib/videos/storage';
import { mediaRange } from '@/lib/vocabulary/media';
async function serve(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const p = new URL(req.url).searchParams;
        const job = await prisma.videoGeneration.findFirst({ where: { id: p.get('job') || '', errorItemId: (await ctx.params).id, userId: user.id, status: 'completed' } });
        if (!job) return new Response(null, { status: 404 });
        const file = videoFile(job.resultHash), info = await stat(file).catch(() => null);
        if (!info) return new Response(null, { status: 404 });
        const range = mediaRange(req.headers.get('range'), info.size);
        if (range === false) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
        const start = range ? range.start : 0, end = range ? range.end : info.size - 1;
        const headers = { 'Content-Type': 'video/mp4', 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(end - start + 1),
            ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}), ...(p.has('download') ? { 'Content-Disposition': 'attachment; filename="explanation.mp4"' } : {}) };
        const body = req.method === 'HEAD' ? null : Readable.toWeb(createReadStream(file, { start, end }));
        return new Response(body as ReadableStream<Uint8Array> | null, { status: range ? 206 : 200, headers });
    } catch (error) { return learningFailure(error); }
}
export const GET = serve;
export const HEAD = serve;
