import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { textbookAdmin } from '@/lib/textbooks/access';
import { restoreTextbooks } from '@/lib/textbooks/backup';
import { learningFailure, noStore } from '@/lib/learning/auth';
export async function POST() {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const raw: unknown = JSON.parse(await readFile(path.join(process.cwd(), 'resources/textbooks/ljxj-english-3-upper.json'), 'utf8'));
        const result = await prisma.$transaction(tx => restoreTextbooks(tx, raw, true), { timeout: 60000 });
        return NextResponse.json({ ...result, bookId: 'ljxj-en-3-upper-2024' }, noStore);
    } catch (error) { return learningFailure(error); }
}
