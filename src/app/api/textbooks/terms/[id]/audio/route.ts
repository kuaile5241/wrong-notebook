import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure } from '@/lib/learning/auth';
import { checkAudioQuota, synthesizeLessonAudio, LessonAudioError } from '@/lib/lesson-audio';
import { mediaRange } from '@/lib/vocabulary/media';
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const term = await prisma.textbookTerm.findFirst({ where: { id: (await ctx.params).id, archived: false, unit: { archived: false, book: { published: true, archived: false } } } });
        if (!term) return new Response(null, { status: 404 });
        // 正文只能取已发布词条；HEAD不触发合成，媒体预加载被客户端明确关闭。
        if (req.method === 'HEAD') return new Response(null, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
        checkAudioQuota(user.id);
        const data = await synthesizeLessonAudio(user.id, term.word, undefined, 'en', 'natural');
        const range = mediaRange(req.headers.get('range'), data.length);
        if (range === false) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${data.length}` } });
        const headers: Record<string, string> = { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes',
            'Content-Length': String(range ? range.end - range.start + 1 : data.length) };
        if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${data.length}`;
        return new Response(new Uint8Array(range ? data.subarray(range.start, range.end + 1) : data), { status: range ? 206 : 200, headers });
    } catch (error) {
        if (error instanceof LessonAudioError) return NextResponse.json({ message: 'Natural speech unavailable', code: error.code }, { status: error.status });
        return learningFailure(error);
    }
}
export const HEAD = GET;
