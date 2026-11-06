import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { generationId, jobDirectory, VOICES } from './jobs';
import { parseVideoPlan } from './plan';
import { videoExists } from '@/lib/videos/storage';
const recordSchema = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), userId: z.string(), errorItemId: z.string(), source: z.string().max(100000), voice: z.enum(VOICES), plan: z.string().max(50000).default(''), resultHash: z.string().regex(/^$|^[a-f0-9]{64}$/).default('') });
export async function restoreGenerations(tx: Prisma.TransactionClient, raw: unknown, options: { userId: string; sourceUserId: string; all: boolean; admin: boolean; itemMap: Map<string, string> }) {
    if (raw === undefined) return;
    for (const entry of z.array(z.unknown()).max(1000).parse(raw)) {
        const record = recordSchema.parse(entry);
        if (!options.all && record.userId !== options.sourceUserId) continue;
        const owner = options.all ? record.userId : options.userId;
        const itemId = options.itemMap.get(record.errorItemId);
        if (!itemId) continue;
        const item = await tx.errorItem.findFirst({ where: { id: itemId, userId: owner } });
        if (!item) continue;
        const source = JSON.stringify({ question: item.questionText || '', answer: item.answerText || '', analysis: item.analysis || '' });
        if (source !== record.source) continue;
        if (record.plan) parseVideoPlan(record.plan);
        let allowed = options.admin;
        try {
            const proof = JSON.parse(await readFile(path.join(jobDirectory(record.id), 'owner.json'), 'utf8'));
            allowed ||= proof.userId === owner && proof.source === source && proof.hash === record.resultHash;
        } catch { /* 没有归属凭据时，需要重新渲染。 */ }
        const completed = !!record.resultHash && allowed && await videoExists(record.resultHash);
        const id = generationId(owner, itemId, source, record.voice);
        await tx.videoGeneration.upsert({ where: { id }, update: {}, create: { id, userId: owner, errorItemId: itemId, source, voice: record.voice, plan: record.plan,
            status: completed ? 'completed' : 'failed', resultHash: completed ? record.resultHash : '', error: completed ? '' : 'TASK_INTERRUPTED' } });
    }
}
