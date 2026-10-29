import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role?: string
            accessExpiresAt?: string | null
            canUseAi?: boolean
            canImportExport?: boolean
            accessStatus?: "active" | "expired" | "disabled" | "missing"
            /** 管理员仍在使用默认密码，必须先修改 */
            mustChangePassword?: boolean
        } & DefaultSession["user"]
    }

    interface User {
        role?: string
            accessExpiresAt?: string | null
            canUseAi?: boolean
            canImportExport?: boolean
            accessStatus?: "active" | "expired" | "disabled" | "missing"
        isActive?: boolean
        mustChangePassword?: boolean
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role?: string
            accessExpiresAt?: string | null
            canUseAi?: boolean
            canImportExport?: boolean
            accessStatus?: "active" | "expired" | "disabled" | "missing"
        mustChangePassword?: boolean
    }
}
