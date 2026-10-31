import { NextResponse } from 'next/server';
import { learningAuth } from '@/lib/learning/auth';
export async function textbookAdmin() {
    const user = await learningAuth(); if (user instanceof NextResponse) return user;
    return user.role === 'admin' ? user : NextResponse.json({ message: 'Admin required' }, { status: 403 });
}
export function visibleBooks(admin: boolean) { return admin ? {} : { published: true, archived: false }; }
