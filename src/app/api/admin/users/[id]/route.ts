import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { forbidden, badRequest, internalError, notFound } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
const logger = createLogger("api:admin:users:id");
const schema = z.object({
    isActive: z.boolean().optional(),
    role: z.enum(["admin", "user"]).optional(),
    accessExpiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
    canUseAi: z.boolean().optional(),
    canImportExport: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);
const select = { id: true, name: true, email: true, role: true, isActive: true, accessExpiresAt: true, canUseAi: true, canImportExport: true, createdAt: true } as const;
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) return forbidden("Admin access required");
    try {
        const parsed = schema.safeParse(await req.json());
        if (!parsed.success) return badRequest("Invalid account permissions or expiry time");
        if (id === session?.user.id) return badRequest("Cannot change your own account access");
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) return notFound("User not found");
        if (target.email === "admin@localhost") return badRequest("Cannot change super admin access");
        const role = parsed.data.role ?? target.role;
        const user = await prisma.$transaction(async tx => {
            if (target.role === "admin" && (role !== "admin" || parsed.data.isActive === false)) {
                const others = await tx.user.count({ where: { role: "admin", isActive: true, id: { not: id } } });
                if (others === 0) throw new Error("LAST_ADMIN");
            }
            return tx.user.update({ where: { id }, data: {
                ...parsed.data,
                accessExpiresAt: role === "admin" ? null : parsed.data.accessExpiresAt === undefined ? undefined : parsed.data.accessExpiresAt === null ? null : new Date(parsed.data.accessExpiresAt),
            }, select });
        });
        return NextResponse.json(user);
    } catch (error) {
        if (error instanceof SyntaxError) return badRequest("Invalid JSON");
        if (error instanceof Error && error.message === "LAST_ADMIN") return badRequest("Cannot remove the last active administrator");
        logger.error({ error }, "Error updating user");
        return internalError("Failed to update user");
    }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) return forbidden("Admin access required");
    if (id === session?.user.id) return badRequest("Cannot delete your own account");
    try {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) return notFound("User not found");
        if (target.email === "admin@localhost") return badRequest("Cannot delete super admin");
        const user = await prisma.$transaction(async tx => {
            if (target.role === "admin" && await tx.user.count({ where: { role: "admin", isActive: true, id: { not: id } } }) === 0) throw new Error("LAST_ADMIN");
            return tx.user.delete({ where: { id }, select: { id: true } });
        });
        return NextResponse.json(user);
    } catch (error) {
        if (error instanceof Error && error.message === "LAST_ADMIN") return badRequest("Cannot delete the last active administrator");
        logger.error({ error }, "Error deleting user");
        return internalError("Failed to delete user");
    }
}
