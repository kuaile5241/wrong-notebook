import { z } from 'zod';
export const videoId = z.string().regex(/^[a-f0-9]{64}$/);
export const videoMetadata = z.object({
    title: z.string().trim().min(1).max(120),
    summary: z.string().max(2000).default(''),
    subject: z.enum(['math', 'english', 'physics', 'chinese', 'science', 'morality', 'history']).default('math'),
    grade: z.number().int().min(1).max(12).default(3),
    topics: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    bookId: z.string().max(100).default(''),
    unitId: z.string().max(100).default(''),
    published: z.boolean().default(false),
    archived: z.boolean().default(false),
});
export type VideoMetadata = z.infer<typeof videoMetadata>;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
