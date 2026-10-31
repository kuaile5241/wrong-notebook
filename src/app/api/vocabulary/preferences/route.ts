import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { settingsSchema, vocabularyCatalog } from '@/lib/vocabulary/catalog';
export async function POST(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = settingsSchema.safeParse(await req.json());
        if (!parsed.success || (parsed.data.topic && !vocabularyCatalog().topics.some(t => t[0] === parsed.data.topic))) return NextResponse.json({ message: 'Invalid preferences' }, { status: 400 });
        await prisma.user.update({ where: { id: user.id }, data: { vocabularySettings: JSON.stringify(parsed.data) } });
        return NextResponse.json(parsed.data, noStore);
    } catch (error) { return learningFailure(error); }
}
