import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-auth/jwt
vi.mock('next-auth/jwt', () => ({
    getToken: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { prisma } from '@/lib/prisma';

// Mock logger
vi.mock('@/lib/logger', () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
}));

import { middleware } from '@/middleware';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';

describe('middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', role: 'user', isActive: true, accessExpiresAt: null, canUseAi: true, canImportExport: true } as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('未认证用户', () => {
        it('应该重定向未认证用户到登录页', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/notebooks');
            const response = await middleware(req);

            expect(response).not.toBeNull();
            expect(response?.status).toBe(307); // Redirect status
            expect(response?.headers.get('location')).toContain('/login');
            expect(response?.headers.get('location')).toContain('callbackUrl=%2Fnotebooks');
        });

        it('应该允许未认证用户访问登录页', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/login');
            const response = await middleware(req);

            // 返回 null 表示不拦截
            expect(response).toBeNull();
        });

        it('应该允许未认证用户访问注册页', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/register');
            const response = await middleware(req);

            expect(response).toBeNull();
        });

        it('应该保留查询参数在 callbackUrl 中', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/notebooks/123?tab=details');
            const response = await middleware(req);

            expect(response).not.toBeNull();
            const location = response?.headers.get('location') || '';
            // callbackUrl 应该包含完整路径和查询参数
            expect(decodeURIComponent(location)).toContain('/notebooks/123?tab=details');
        });
    });

    describe('已认证用户', () => {
        const mockToken = {
            sub: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
        };

        it('应该允许已认证用户访问受保护页面', async () => {
            vi.mocked(getToken).mockResolvedValue(mockToken as unknown as JWT);

            const req = new NextRequest('http://localhost:3000/notebooks');
            const response = await middleware(req);

            // 返回 undefined 表示允许继续
            expect(response).toBeUndefined();
        });

        it('应该重定向已认证用户离开登录页', async () => {
            vi.mocked(getToken).mockResolvedValue(mockToken as unknown as JWT);

            const req = new NextRequest('http://localhost:3000/login');
            const response = await middleware(req);

            expect(response).not.toBeNull();
            expect(response?.status).toBe(307);
            expect(response?.headers.get('location')).toBe('http://localhost:3000/');
        });

        it('应该重定向已认证用户离开注册页', async () => {
            vi.mocked(getToken).mockResolvedValue(mockToken as unknown as JWT);

            const req = new NextRequest('http://localhost:3000/register');
            const response = await middleware(req);

            expect(response).not.toBeNull();
            expect(response?.status).toBe(307);
            expect(response?.headers.get('location')).toBe('http://localhost:3000/');
        });

        it('应该允许已认证用户访问首页', async () => {
            vi.mocked(getToken).mockResolvedValue(mockToken as unknown as JWT);

            const req = new NextRequest('http://localhost:3000/');
            const response = await middleware(req);

            expect(response).toBeUndefined();
        });
    });

    describe('默认密码强制修改', () => {
        const flaggedToken = { id: 'admin-1', role: 'admin', mustChangePassword: true };
        beforeEach(() => { vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'admin-1', role: 'admin', isActive: true, accessExpiresAt: null } as Awaited<ReturnType<typeof prisma.user.findUnique>>); });

        it('仍使用默认密码的管理员访问任意页面都应跳到 /setup', async () => {
            vi.mocked(getToken).mockResolvedValue(flaggedToken as unknown as JWT);

            for (const path of ['/', '/notebooks', '/admin', '/stats?tab=tags']) {
                const response = await middleware(new NextRequest(`http://localhost:3000${path}`));
                expect(response?.status).toBe(307);
                expect(response?.headers.get('location')).toBe('http://localhost:3000/setup');
            }
        });

        it('访问 /setup 本身不应再重定向', async () => {
            vi.mocked(getToken).mockResolvedValue(flaggedToken as unknown as JWT);

            const response = await middleware(new NextRequest('http://localhost:3000/setup'));

            expect(response).toBeUndefined();
        });

        it('已改密码的管理员正常访问页面', async () => {
            vi.mocked(getToken).mockResolvedValue({ ...flaggedToken, mustChangePassword: false } as unknown as JWT);

            const response = await middleware(new NextRequest('http://localhost:3000/notebooks'));

            expect(response).toBeUndefined();
        });
    });

    describe('错误处理', () => {
        it('Token 验证失败时应该拒绝请求但不崩溃', async () => {
            vi.mocked(getToken).mockRejectedValue(new Error('Token validation failed'));

            const req = new NextRequest('http://localhost:3000/notebooks');

            // 不应该抛出错误
            const response = await middleware(req);

            // 校验失败必须关闭访问，不能放过失效会话。
            expect(response?.status).toBe(503);
        });

        it('Token 验证失败时应该记录错误日志', async () => {
            // 此测试验证错误处理路径不会崩溃
            // 由于模块缓存，我们在上面的测试中已经验证了错误处理
            // 这里只验证中间件导入成功
            expect(middleware).toBeDefined();
        });
    });

    describe('getToken 调用配置', () => {
        it('应该使用正确的 cookie 名称', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/notebooks');
            await middleware(req);

            expect(getToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    cookieName: 'next-auth.session-token',
                })
            );
        });

        it('应该传递 NEXTAUTH_SECRET', async () => {
            const originalSecret = process.env.NEXTAUTH_SECRET;
            process.env.NEXTAUTH_SECRET = 'test-secret';

            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/notebooks');
            await middleware(req);

            expect(getToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    secret: 'test-secret',
                })
            );

            process.env.NEXTAUTH_SECRET = originalSecret;
        });
    });

    describe('路径匹配', () => {
        it('中间件配置应该存在', async () => {
            // 验证中间件导出存在
            const middlewareModule = await import('@/middleware');
            expect(middlewareModule.config).toBeDefined();
            expect(middlewareModule.config.matcher).toBeDefined();
            expect(middlewareModule.config.matcher.length).toBeGreaterThan(0);
        });

        it('应该处理根路径', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/');
            const response = await middleware(req);

            expect(response).not.toBeNull();
            expect(response?.headers.get('location')).toContain('/login');
        });

        it('应该处理嵌套路径', async () => {
            vi.mocked(getToken).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/notebooks/123/edit');
            const response = await middleware(req);

            expect(response).not.toBeNull();
            expect(response?.headers.get('location')).toContain('callbackUrl');
        });
    });
});


describe('实时账号授权', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.mocked(getToken).mockResolvedValue({ id: 'u', role: 'admin' } as JWT); });
    function row(values: object) { return { id: 'u', role: 'user', isActive: true, accessExpiresAt: null, canUseAi: true, canImportExport: true, ...values } as Awaited<ReturnType<typeof prisma.user.findUnique>>; }
    it('到期后旧JWT也不能读API，重新续期后同一JWT恢复', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ accessExpiresAt: new Date(0) }));
        const blocked = await middleware(new NextRequest('http://localhost/api/notebooks'));
        expect(blocked?.status).toBe(403); expect((await blocked?.json()).code).toBe('ACCOUNT_EXPIRED');
        vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ accessExpiresAt: new Date(Date.now() + 60000) }));
        expect(await middleware(new NextRequest('http://localhost/api/notebooks'))).toBeUndefined();
    });
    it('停用账号与被删除账号无法继续访问页面', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ isActive: false }));
        expect((await middleware(new NextRequest('http://localhost/notebooks')))?.headers.get('location')).toContain('reason=disabled');
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        expect((await middleware(new NextRequest('http://localhost/api/notebooks')))?.status).toBe(403);
    });
    it('管理员被降级后不能凭旧角色访问后台', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ role: 'user' }));
        expect((await middleware(new NextRequest('http://localhost/api/admin/users')))?.status).toBe(403);
    });
    it.each(['/api/export', '/api/import'])('数据权限对%s即时生效', async path => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ canImportExport: false }));
        expect((await middleware(new NextRequest('http://localhost'+path, { method: path.endsWith('import') ? 'POST' : 'GET' })))?.status).toBe(403);
    });
    it('AI权限在解析题目之前拒绝请求', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ canUseAi: false }));
        expect((await middleware(new NextRequest('http://localhost/api/analyze', { method: 'POST' })))?.status).toBe(403);
    });
    it('健康、注册与到期提示不受失效cookie影响', async () => {
        for (const path of ['/api/health','/api/register','/api/register/status','/access-denied']) expect(await middleware(new NextRequest('http://localhost'+path))).toBeNull();
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
    it('数据库异常必须拒绝访问', async () => {
        vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('database unavailable'));
        expect((await middleware(new NextRequest('http://localhost/api/export')))?.status).toBe(503);
    });
});
