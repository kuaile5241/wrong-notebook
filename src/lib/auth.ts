import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import { createLogger } from "@/lib/logger"
import { accountAccessStatus } from "@/lib/account-access"
import { DEFAULT_ADMIN_PASSWORD, isDefaultAdminPassword } from "@/lib/default-admin"

const logger = createLogger('auth');

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    // @ts-expect-error trustHost is a valid option in newer NextAuth versions but types might be lagging
    trustHost: true,
    pages: {
        signIn: "/login",
    },
    // Force using a single cookie name to avoid HTTP/HTTPS mismatches in proxy environments
    // This allows running without NEXTAUTH_URL behind Cloudflare Tunnel
    cookies: {
        sessionToken: {
            name: "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                // Only use secure cookies if explicitly running on HTTPS (via NEXTAUTH_URL)
                // This enables HTTP local IP access in Docker/Production if NEXTAUTH_URL is unset
                secure: process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https"),
            },
        },
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                logger.debug({ email: credentials?.email }, 'Authorize called');
                if (!credentials?.email || !credentials?.password) {
                    logger.debug('Missing credentials');
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email
                    }
                })

                if (!user) {
                    logger.debug('User not found');
                    return null
                }

                const isPasswordValid = await compare(credentials.password, user.password)

                if (!isPasswordValid) {
                    logger.debug('Invalid password');
                    return null
                }

                const accessStatus = accountAccessStatus(user);
                if (accessStatus !== "active") throw new Error(accessStatus === "expired" ? "ACCOUNT_EXPIRED" : "ACCOUNT_DISABLED");
                logger.info({ email: user.email }, 'Login successful');

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,
                    canUseAi: user.canUseAi,
                    canImportExport: user.canImportExport,
                    accessStatus: "active" as const,
                    mustChangePassword: isDefaultAdminPassword(user.role, credentials.password),
                }
            }
        })
    ],
    // Enable debug messages in the console
    debug: true,
    logger: {
        error(code, metadata) {
            logger.error({ code, metadata }, 'NextAuth error');
        },
        warn(code) {
            logger.warn({ code }, 'NextAuth warning');
        },
        debug(code, metadata) {
            logger.debug({ code, metadata }, 'NextAuth debug');
        }
    },
    callbacks: {
        async session({ session, token }) {
            logger.debug({ userId: token.id }, 'Session callback');
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    role: token.role,
                    accessExpiresAt: token.accessExpiresAt,
                    canUseAi: token.canUseAi,
                    canImportExport: token.canImportExport,
                    accessStatus: token.accessStatus,
                    mustChangePassword: token.mustChangePassword === true,
                }
            }
        },
        async jwt({ token, user, trigger }) {
            if (user) {
                logger.debug({ userId: user.id }, 'JWT callback - Initial signin');
                return {
                    ...token,
                    id: user.id,
                    role: user.role,
                    accessExpiresAt: user.accessExpiresAt,
                    canUseAi: user.canUseAi,
                    canImportExport: user.canImportExport,
                    accessStatus: user.accessStatus,
                    mustChangePassword: user.mustChangePassword === true,
                }
            }
            if (token.id) {
                const dbUser = await prisma.user.findUnique({ where: { id: token.id } });
                token = { ...token, email: dbUser?.email ?? null, name: dbUser?.name ?? null, role: dbUser?.role, accessStatus: accountAccessStatus(dbUser),
                    accessExpiresAt: dbUser?.accessExpiresAt?.toISOString() ?? null,
                    canUseAi: dbUser?.canUseAi, canImportExport: dbUser?.canImportExport };
                // 只信任数据库，管理员变更或续期在下一次会话请求立即生效。
                if (trigger === "update" && token.mustChangePassword && dbUser) {
                    token.mustChangePassword = await compare(DEFAULT_ADMIN_PASSWORD, dbUser.password);
                }
            }
            logger.debug('JWT callback - Subsequent call');
            return token
        }
    }
}

// Log startup check
logger.info({
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    HAS_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST
}, 'AuthConfig loading');
