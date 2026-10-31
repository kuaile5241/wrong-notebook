import { z } from 'zod';
export const learnerSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(40), grade: z.number().int().min(1).max(12).default(3), archived: z.boolean().default(false) });
export const profileSettingsSchema = z.object({ revision: z.number().int().nonnegative().default(0), active: z.string().max(100).default(''), profiles: z.array(learnerSchema).max(100).default([]) });
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export function readProfileSettings(raw: string): ProfileSettings { try { return profileSettingsSchema.parse(JSON.parse(raw)); } catch { return { revision: 0, active: '', profiles: [] }; } }
