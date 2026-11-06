import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { videoMetadata, videoId, MAX_VIDEO_BYTES } from './schema';
import { videoExists } from './storage';
/** 管理员恢复共享课程元数据，媒体目录跟随服务器数据一起备份。 */
export async function restoreVideos(tx: Prisma.TransactionClient, raw: unknown, admin: boolean) {
    if (!admin || raw === undefined) return;
    const records = z.array(videoMetadata.extend({ id: videoId, bytes: z.number().int().min(32).max(MAX_VIDEO_BYTES), revision: z.number().int().nonnegative().default(0) })).max(1000).parse(raw);
    for (const record of records) {
        const { topics, ...fields } = record;
        const present = await videoExists(record.id);
        await tx.videoLesson.upsert({ where: { id: record.id }, update: {}, create: { ...fields, topics: JSON.stringify(topics), published: fields.published && present } });
    }
}
export const videoLinkBackup = z.object({ userId: z.string().max(100), errorItemId: z.string().max(100), videoId });
