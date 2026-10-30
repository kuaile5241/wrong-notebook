import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { accountAccessStatus } from '@/lib/account-access';
import { createLogger } from '@/lib/logger';

const logger = createLogger('learning');
/** 新模块独立检查实时账号状态，规则练习不消耗 AI 权限和额度。 */
export async function learningAuth() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, isActive: true, accessExpiresAt: true } });
    const status = accountAccessStatus(user);
    if (!user || status !== 'active') return NextResponse.json({ message: 'Account unavailable', code: `ACCOUNT_${status.toUpperCase()}` }, { status: 403 });
    return user;
}
export function learningFailure(error: unknown) {
    logger.error({ error }, 'Learning request failed');
    return NextResponse.json({ message: 'Learning service unavailable' }, { status: 500 });
}
export const noStore = { headers: { 'Cache-Control': 'no-store' } };
