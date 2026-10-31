import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { readProfileSettings } from '@/lib/learning/profiles';
const inputSchema = z.object({ action: z.enum(['create', 'edit', 'select']), revision: z.number().int().nonnegative(), id: z.string().max(100).optional(), name: z.string().trim().min(1).max(40).optional(), grade: z.number().int().min(1).max(12).optional(), archived: z.boolean().optional() });
export async function GET() {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { learningSettings: true } });
        const sessions = await prisma.learningSession.findMany({ where: { userId: user.id }, select: { id: true, title: true, mode: true, profileId: true, status: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } });
        return NextResponse.json({ ...readProfileSettings(account.learningSettings), sessions }, noStore);
    } catch (e) { return learningFailure(e); }
}
export async function POST(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const result = inputSchema.safeParse(await req.json()); if (!result.success) return NextResponse.json({ message: 'Invalid profile' }, { status: 400 });
        const body = result.data, account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { learningSettings: true } }), data = readProfileSettings(account.learningSettings);
        if (body.revision !== data.revision) return NextResponse.json({ message: 'Profile changed' }, { status: 409 });
        if (body.action === 'create') {
            if (!body.name || data.profiles.length >= 20) return NextResponse.json({ message: 'Invalid profile' }, { status: 400 });
            const profile = { id: randomUUID(), name: body.name, grade: body.grade ?? 3, archived: false }; data.profiles.push(profile); data.active = profile.id;
        } else {
            const profile = data.profiles.find(p => p.id === body.id);
            if (body.id && !profile) return NextResponse.json({ message: 'Not found' }, { status: 404 });
            if (body.action === 'select') { if (profile?.archived) return NextResponse.json({ message: 'Archived' }, { status: 400 }); data.active = body.id || ''; }
            else { if (!profile) return NextResponse.json({ message: 'Not found' }, { status: 404 }); if (body.name) profile.name = body.name; if (body.grade) profile.grade = body.grade; if (body.archived !== undefined) profile.archived = body.archived; if (profile.archived && data.active === profile.id) data.active = ''; }
        }
        data.revision++;
        const changed = await prisma.user.updateMany({ where: { id: user.id, learningSettings: account.learningSettings }, data: { learningSettings: JSON.stringify(data) } });
        return NextResponse.json(changed.count ? data : { message: 'Profile changed' }, { status: changed.count ? 200 : 409, ...noStore });
    } catch (e) { return learningFailure(e); }
}
