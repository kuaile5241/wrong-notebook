import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { videoMetadata } from '@/lib/videos/schema';
import { saveVideo } from '@/lib/videos/storage';

export async function GET(req: Request) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        const p = new URL(req.url).searchParams;
        const manage = p.get('manage') === 'true' && user.role === 'admin';
        const errorId = p.get('errorId');
        if (errorId && !await prisma.errorItem.findFirst({ where: { id: errorId, userId: user.id }, select: { id: true } })) return new NextResponse(null, { status: 404 });
        const videos = await prisma.videoLesson.findMany({
            where: { ...(manage ? {} : { published: true, archived: false }),
                ...(p.get('bookId') ? { bookId: p.get('bookId')! } : {}) },
            orderBy: { createdAt: 'desc' },
        });
        const links = errorId ? await prisma.videoLessonLink.findMany({ where: { userId: user.id, errorItemId: errorId } }) : [];
        return NextResponse.json({ videos: videos.map(v => ({ ...v, topics: JSON.parse(v.topics), linked: links.some(l => l.videoId === v.id) })), canManage: user.role === 'admin' }, noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request) {
    try {
        const user = await learningAuth();
        if (user instanceof NextResponse) return user;
        if (user.role !== 'admin') return new NextResponse(null, { status: 403 });
        const raw = req.headers.get('x-video-metadata');
        const parsed = videoMetadata.safeParse(raw ? JSON.parse(decodeURIComponent(raw)) : null);
        if (!parsed.success || !req.body) return NextResponse.json({ message: 'Invalid video metadata' }, { status: 400 });
        const file = await saveVideo(req.body);
        const existing = await prisma.videoLesson.findUnique({ where: { id: file.id } });
        if (existing) return NextResponse.json(existing, noStore);
        const video = await prisma.videoLesson.upsert({ where: { id: file.id }, update: {}, create: { ...parsed.data, topics: JSON.stringify(parsed.data.topics), ...file } });
        return NextResponse.json(video, { status: 201, ...noStore });
    } catch (error) {
        if (error instanceof Error && ['VIDEO_TOO_LARGE', 'INVALID_MP4'].includes(error.message)) return NextResponse.json({ message: error.message }, { status: error.message === 'VIDEO_TOO_LARGE' ? 413 : 400 });
        if (error instanceof URIError || error instanceof SyntaxError) return new NextResponse(null, { status: 400 });
        return learningFailure(error);
    }
}
