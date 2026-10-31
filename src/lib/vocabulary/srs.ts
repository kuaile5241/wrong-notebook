import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';
import { z } from 'zod';

export const serializedCardSchema = z.object({
    due: z.string().datetime(), stability: z.number().finite().min(0).max(100000), difficulty: z.number().finite().min(0).max(10),
    elapsed_days: z.number().finite().nonnegative().max(100000), scheduled_days: z.number().finite().nonnegative().max(100000),
    learning_steps: z.number().int().min(0).max(100), reps: z.number().int().min(0).max(1000000), lapses: z.number().int().min(0).max(1000000),
    state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), last_review: z.string().datetime().optional(),
});
const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false, enable_short_term: true, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
export function scheduleWord(raw: string, grade: number, now = new Date()) {
    if (![1, 2, 3, 4].includes(grade)) throw new Error('INVALID_GRADE');
    const data = raw ? serializedCardSchema.parse(JSON.parse(raw)) : null;
    const card: Card = data ? { ...data, due: new Date(data.due), last_review: data.last_review ? new Date(data.last_review) : undefined } : createEmptyCard(now);
    const next = scheduler.next(card, now, grade as Grade).card;
    return { state: JSON.stringify(next), dueAt: next.due };
}
export { Rating };
