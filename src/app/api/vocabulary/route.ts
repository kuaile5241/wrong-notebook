import { NextResponse } from 'next/server';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { vocabularyView } from '@/lib/vocabulary/service';
export async function GET(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        return NextResponse.json(await vocabularyView(user.id, new URL(req.url).searchParams), noStore);
    } catch (error) { return learningFailure(error); }
}
