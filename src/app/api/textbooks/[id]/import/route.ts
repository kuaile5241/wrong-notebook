import { NextResponse } from 'next/server';
import { z } from 'zod';
import { textbookAdmin } from '@/lib/textbooks/access';
import { applyImport, inspectImport, BookConflict } from '@/lib/textbooks/manage';
import { learningFailure, noStore } from '@/lib/learning/auth';
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
    try {
        const user = await textbookAdmin(); if (user instanceof NextResponse) return user;
        const parsed = z.object({ action: z.enum(['preview', 'commit']), revision: z.number().int().nonnegative().optional(), rows: z.array(z.unknown()).min(1).max(1000), mode: z.enum(['skip', 'update']).default('skip') }).safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ message: 'Invalid import' }, { status: 400 });
        const { action, rows, mode, revision } = parsed.data, id = (await ctx.params).id;
        if (action === 'preview') {
            const result = await inspectImport(id, rows, mode);
            return NextResponse.json({ revision: result.book.revision, rows: result.rows, issues: result.issues, totalIssues: result.totalIssues, summary: result.summary }, noStore);
        }
        if (revision === undefined) return NextResponse.json({ message: 'Preview first' }, { status: 400 });
        return NextResponse.json({ summary: await applyImport(id, revision, rows, mode) }, noStore);
    } catch (error) {
        if (error instanceof BookConflict) return NextResponse.json({ message: 'Book changed. Preview again.' }, { status: 409 });
        if (error instanceof Error && error.message === 'INVALID_IMPORT') return NextResponse.json({ message: 'Fix import rows first' }, { status: 400 });
        return learningFailure(error);
    }
}
