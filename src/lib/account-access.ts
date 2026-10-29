/** 账户访问规则同时供请求入口、登录及管理界面使用。 */
export interface AccountAccess {
    role?: string | null;
    isActive?: boolean;
    accessExpiresAt?: Date | string | null;
    canUseAi?: boolean;
    canImportExport?: boolean;
}
export type AccountAccessStatus = "active" | "disabled" | "expired" | "missing";
export function accountAccessStatus(user: AccountAccess | null | undefined, now = Date.now()): AccountAccessStatus {
    if (!user) return "missing";
    if (user.isActive === false) return "disabled";
    if (user.role !== "admin" && user.accessExpiresAt) {
        const expires = new Date(user.accessExpiresAt).getTime();
        if (!Number.isFinite(expires) || expires <= now) return "expired";
    }
    return "active";
}
export function requestPermission(user: AccountAccess, pathname: string, method: string): boolean {
    if (user.role === "admin") return true;
    if ((pathname === "/api/import" || pathname === "/api/export") && user.canImportExport === false) return false;
    if (method !== "POST") return true;
    const aiPath = /^\/api\/(analyze|reanswer|geogebra-analyze|practice\/(generate|grade)|exams(?:\/[^/]+\/(retry|questions\/[^/]+\/regenerate))?|error-items\/[^/]+\/(reanswer|retag|figure|fix-latex|geogebra|svg-animation)|notebooks\/[^/]+\/retag|openclaw\/batch-upload)$/;
    return !(user.canUseAi === false && aiPath.test(pathname));
}
