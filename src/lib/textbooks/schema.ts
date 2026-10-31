import { createHash } from 'node:crypto';
import { z } from 'zod';

export const sourceUrlSchema = z.string().max(2000).refine(value => {
    if (!value) return true;
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}, 'Only HTTP(S) links are allowed');
export const bookSchema = z.object({
    title: z.string().trim().min(1).max(150), subject: z.enum(['english', 'math', 'chinese', 'science', 'morality', 'physics', 'history', 'chemistry', 'biology']).default('english'),
    stage: z.enum(['primary', 'junior_high', 'senior_high']), grade: z.number().int().min(1).max(12), volume: z.string().trim().min(1).max(50),
    publisher: z.string().trim().min(1).max(100), edition: z.string().trim().min(1).max(150), isbn: z.string().max(40).default(''),
    sourceTitle: z.string().max(200).default(''), sourceUrl: sourceUrlSchema.default(''), verificationNote: z.string().max(2000).default(''),
    published: z.boolean().default(false), archived: z.boolean().default(false),
}).refine(b => b.stage === 'primary' ? b.grade <= 6 : b.stage === 'junior_high' ? b.grade >= 7 && b.grade <= 9 : b.grade >= 10, { message: 'Grade does not match stage' });
export const unitSchema = z.object({ id: z.string().max(100).optional(), code: z.string().trim().min(1).max(50), title: z.string().trim().min(1).max(150),
    moduleTitle: z.string().max(150).default(''), position: z.number().int().min(0).max(10000).default(0), pageReference: z.string().max(80).default(''),
    notes: z.string().max(2000).default(''), courseUrl: sourceUrlSchema.default(''), archived: z.boolean().default(false) });
export const termSchema = z.object({ id: z.string().max(100).optional(), unitId: z.string().max(100), word: z.string().trim().min(1).max(120), meaning: z.string().trim().min(1).max(300),
    example: z.string().max(1000).default(''), translation: z.string().max(1000).default(''), atlasId: z.string().max(100).default(''),
    useAtlasImage: z.boolean().default(false), position: z.number().int().min(0).max(10000).default(0), notes: z.string().max(1000).default(''), verified: z.boolean().default(false), archived: z.boolean().default(false) });
export const importRowSchema = z.object({
    unitCode: z.string().trim().min(1).max(50), unitTitle: z.string().trim().min(1).max(150), moduleTitle: z.string().max(150).default(''),
    pageReference: z.string().max(80).default(''), word: z.string().trim().min(1).max(120), meaning: z.string().trim().min(1).max(300),
    example: z.string().max(1000).default(''), translation: z.string().max(1000).default(''), atlasId: z.string().max(100).default(''),
    useAtlasImage: z.boolean().default(false), notes: z.string().max(1000).default(''), verified: z.boolean().default(false),
});
export type TextbookInput = z.infer<typeof bookSchema>;
export type ImportRow = z.infer<typeof importRowSchema>;
export function termKey(word: string) { return createHash('sha256').update(word.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()).digest('hex'); }
