import { z } from 'zod';
const label = z.string().trim().min(1).max(48).regex(/^[^<>\\\n\r]*$/);
const counter = z.object({ label, count: z.number().int().min(1).max(20), legs: z.union([z.literal(0), z.literal(2), z.literal(4)]).default(0) });
export const visualSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('counters'), groups: z.array(counter).min(1).max(2) }),
    z.object({ kind: z.literal('bars'), groups: z.array(z.object({ label, value: z.number().positive().max(10000) })).min(1).max(3) }),
    z.object({ kind: z.literal('numberLine'), from: z.number().min(-100).max(100), to: z.number().min(-100).max(100) }),
    z.object({ kind: z.literal('fraction'), numerator: z.number().int().min(1).max(20), denominator: z.number().int().min(1).max(20) }),
]);
export const videoPlanSchema = z.discriminatedUnion('supported', [
    z.object({ supported: z.literal(false), reason: z.string().min(1).max(300) }),
    z.object({ supported: z.literal(true), title: label, scenes: z.array(z.object({
        title: label, narration: z.string().trim().min(8).max(320),
        equation: z.string().max(48).regex(/^[^<>\\\n\r]*$/).default(''),
        lines: z.array(label).min(1).max(3), visual: visualSchema,
    })).min(3).max(8) }),
]);
export type VideoPlan = z.infer<typeof videoPlanSchema>;
export type SupportedVideoPlan = Extract<VideoPlan, { supported: true }>;
export function parseVideoPlan(raw: string): VideoPlan {
    try {
        const text = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        const plan = videoPlanSchema.parse(JSON.parse(text));
        if (plan.supported && plan.scenes.some(s => s.visual.kind === 'fraction' && s.visual.numerator > s.visual.denominator)) throw new Error('Improper fraction diagram');
        return plan;
    } catch { throw new Error('AI_RESPONSE_ERROR: invalid video storyboard'); }
}
