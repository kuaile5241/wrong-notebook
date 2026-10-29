import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { accountAccessStatus, requestPermission } from "@/lib/account-access";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const logger = createLogger("middleware");
const PUBLIC_API = /^\/api\/(auth(?:\/|$)|register(?:\/status)?$|health$|version$)/;

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const api = path.startsWith("/api/");
    if (PUBLIC_API.test(path) || path === "/access-denied") return null;
    try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: "next-auth.session-token" });
        const authPage = path === "/login" || path === "/register";
        if (!token) {
            if (authPage || api) return null; // API 继续执行各自认证，兼容集成接口的 API Key 模式。
            return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(path + req.nextUrl.search)}`, req.url));
        }
        const id = token.id || token.sub;
        const user = id ? await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true, isActive: true, accessExpiresAt: true, canUseAi: true, canImportExport: true },
        }) : null;
        const status = accountAccessStatus(user);
        if (status !== "active") {
            if (authPage) return null;
            if (api) return NextResponse.json({ message: status === "expired" ? "账号使用时间已到期，请联系管理员续期。" : "账号已停用或不存在，请联系管理员。", code: `ACCOUNT_${status.toUpperCase()}` }, { status: 403, headers: { "Cache-Control": "no-store" } });
            return NextResponse.redirect(new URL(`/access-denied?reason=${status}`, req.url));
        }
        if (authPage) return NextResponse.redirect(new URL("/", req.url));
        if ((path.startsWith("/api/admin/") || path === "/admin" || path.startsWith("/admin/")) && user?.role !== "admin") {
            return api ? NextResponse.json({ message: "Admin access required", code: "ADMIN_REQUIRED" }, { status: 403 }) : NextResponse.redirect(new URL("/", req.url));
        }
        if (api && user && !requestPermission(user, path, req.method)) {
            return NextResponse.json({ message: "当前账号没有此功能权限，请联系管理员。", code: "ACCOUNT_PERMISSION_DENIED" }, { status: 403 });
        }
        if (!api && token.mustChangePassword && path !== "/setup") return NextResponse.redirect(new URL("/setup", req.url));
    } catch (error) {
        logger.error({ error }, "Account access verification failed");
        return NextResponse.json({ message: "暂时无法验证账号，请稍后重试。", code: "ACCESS_CHECK_UNAVAILABLE" }, { status: 503 });
    }
}
export const config = {
    runtime: "nodejs",
    matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|offline.html).*)"],
};
