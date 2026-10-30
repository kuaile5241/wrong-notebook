import { NextResponse } from 'next/server';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { updateAppConfig } from '@/lib/config';
import { aliyunTtsSchema, getAliyunTtsConfig, aliyunReady } from '@/lib/aliyun-tts';
import { checkAudioQuota, LessonAudioError, synthesizeLessonAudio } from '@/lib/lesson-audio';

async function admin() {
    const user = await learningAuth();
    if (user instanceof NextResponse) return user;
    return user.role === 'admin' ? user : NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
}
export async function GET() {
    const user = await admin(); if (user instanceof NextResponse) return user;
    const config = getAliyunTtsConfig();
    return NextResponse.json({ ...config, apiKey: config.apiKey ? '********' : '', ready: aliyunReady(config) }, noStore);
}
export async function POST(req: Request) {
    const user = await admin(); if (user instanceof NextResponse) return user;
    try {
        const body = await req.json();
        if (body.action === 'test') {
            checkAudioQuota(user.id);
            const data = await synthesizeLessonAudio(user.id, '你好，我是你的学习小伙伴。我们一起把这道题弄明白吧。', req.signal, 'zh', 'natural');
            return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
        }
        const parsed = aliyunTtsSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ code: 'INVALID_VOICE_CONFIG' }, { status: 400 });
        const config = parsed.data;
        if (config.apiKey === '********') config.apiKey = getAliyunTtsConfig().apiKey;
        if (config.enabled && !aliyunReady(config)) return NextResponse.json({ code: 'AUDIO_NOT_CONFIGURED' }, { status: 400 });
        updateAppConfig({ aliyunTts: config });
        return NextResponse.json({ saved: true, ready: aliyunReady(config) }, noStore);
    } catch (error) {
        if (error instanceof LessonAudioError) return NextResponse.json({ code: error.code }, { status: error.status });
        return learningFailure(error);
    }
}
