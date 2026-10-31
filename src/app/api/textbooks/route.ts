import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { textbookAdmin, visibleBooks } from '@/lib/textbooks/access';
import { bookSchema } from '@/lib/textbooks/schema';
export async function GET(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const manage = new URL(req.url).searchParams.get('manage') === 'true' && user.role === 'admin';
        const books = await prisma.textbookBook.findMany({ where: visibleBooks(manage), include: { _count: { select: { units: true } } }, orderBy: [{ stage: 'asc' }, { grade: 'asc' }, { title: 'asc' }] });
        return NextResponse.json({ books, canManage: user.role === 'admin' }, noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request) {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const parsed = bookSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ message: 'Invalid book' }, { status: 400 });
        const book = await prisma.textbookBook.create({ data: { ...parsed.data, published: false, archived: false } });
        return NextResponse.json(book, { status: 201, ...noStore });
    } catch (error) { return learningFailure(error); }
}
