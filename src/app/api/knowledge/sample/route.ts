import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { sanitizeFigureSvg } from '@/lib/figure-svg';
export async function GET(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const p = new URL(req.url).searchParams;
        const topics = JSON.parse(readFileSync(join(process.cwd(), 'resources/learning/topics.json'), 'utf8')) as { id: string; diagnostic_question?: { question: string; answer: string }; figure?: string }[];
        const topic = topics.find(t => t.id === p.get('id')); if (!topic?.diagnostic_question) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        return NextResponse.json({ question: topic.diagnostic_question.question, figure: sanitizeFigureSvg(topic.figure), ...(p.get('reveal') === '1' ? { answer: topic.diagnostic_question.answer } : {}) }, noStore);
    } catch (e) { return learningFailure(e); }
}
