"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
/** 到期时立即遮住已有页面；停用/续期通过会话刷新同步，接口端始终实时校验。 */
export function AccountAccessGuard({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const path = usePathname();
    const router = useRouter();
    const [now, setNow] = useState(Date.now);
    const expiry = session?.user.role !== "admin" && session?.user.accessExpiresAt ? new Date(session.user.accessExpiresAt).getTime() : null;
    const status = expiry !== null && expiry <= now ? "expired" : session?.user.accessStatus;
    const blocked = !!status && status !== "active";
    const bare = path === "/login" || path === "/register" || path === "/access-denied";
    useEffect(() => {
        if (blocked && !bare) router.replace(`/access-denied?reason=${status}`);
    }, [blocked, bare, router, status]);
    useEffect(() => {
        const refresh = () => setNow(Date.now());
        window.addEventListener("focus", refresh);
        const timer = expiry !== null && expiry > now ? window.setTimeout(refresh, Math.min(expiry - now + 5, 2147483647)) : undefined;
        return () => { window.removeEventListener("focus", refresh); if (timer !== undefined) window.clearTimeout(timer); };
    }, [expiry, now]);
    if (blocked && !bare) return null;
    return children;
}
