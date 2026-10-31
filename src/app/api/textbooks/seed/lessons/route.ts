import { NextResponse } from 'next/server';
import { textbookAdmin } from '@/lib/textbooks/access';
import { enrichPreparedLessons } from '@/lib/textbooks/enrich';
import { learningFailure, noStore } from '@/lib/learning/auth';
export async function POST() {
    try { const user = await textbookAdmin(); if (user instanceof NextResponse) return user; return NextResponse.json(await enrichPreparedLessons(), noStore); }
    catch (error) { return learningFailure(error); }
}
