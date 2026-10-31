import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export interface WordEntry {
    id: string; w: string; uk: string; us: string; cefr: string; topic: string; note?: string;
    senses: { pos: string; zh: string; en: string }[]; ex: { en: string; zh: string }[];
    col: string[]; fam: string[]; syn: string[]; ant: string[]; tip: string;
}
export const settingsSchema = z.object({
    stage: z.enum(['primary', 'junior', 'senior', 'all']).default('primary'),
    level: z.enum(['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).default('all'),
    topic: z.string().max(30).default(''), accent: z.enum(['uk', 'us']).default('uk'),
    dailyGoal: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
});
export type VocabularySettings = z.infer<typeof settingsSchema>;
export function readSettings(raw: string): VocabularySettings {
    try { return settingsSchema.parse(JSON.parse(raw)); } catch { return settingsSchema.parse({}); }
}
// 小学推荐为基础词清单，不宣称某个教材版本的逐课词表。
const PRIMARY = new Set(`hello hi goodbye please thank thanks yes no morning afternoon evening night name boy girl man woman baby child children friend family mother father sister brother grandmother grandfather parent home house room bedroom bathroom kitchen living-room garden door window wall floor table desk chair bed clock light school classroom teacher student pupil class lesson book notebook pen pencil ruler eraser rubber bag schoolbag paper picture story read write draw paint sing song dance listen speak say ask answer learn study play game toy ball doll kite bike bicycle car bus train plane boat ship walk run jump swim fly ride sit stand open close look see watch hear eat drink sleep wash clean help like love want have do go come make take give get put let can be am is are this that these those it he she we they you i my your his her our their who what where when how why one three four five six seven eight nine ten first second number zero red blue green yellow black white pink purple orange brown grey gray color colour big small long short tall old new young happy sad good bad nice beautiful hungry thirsty hot cold warm cool sunny rainy windy snowy weather spring summer autumn winter monday tuesday wednesday thursday friday saturday sunday today tomorrow yesterday week month year day time hour minute water milk juice tea coffee bread rice noodle noodles egg meat fish chicken beef cake ice-cream apple banana pear peach grape strawberry potato tomato carrot fruit vegetable breakfast lunch dinner food head face hair eye ear nose mouth tooth teeth hand arm finger leg foot feet body dog cat bird duck hen cow pig horse sheep goat rabbit panda bear tiger lion monkey elephant giraffe zebra snake frog turtle butterfly bee ant mouse farm animal zoo park shop supermarket library hospital street road city town village country beach river lake sea mountain tree flower grass sun moon star sky rain snow cloud earth schoolwork homework english chinese maths math science music art sport football basketball tennis clothes shirt t-shirt coat jacket sweater dress skirt trousers pants shorts sock socks shoe shoes hat cap umbrella birthday party gift present holiday travel visit toy computer phone doctor nurse farmer worker driver cook job strong fast slow left right up down front back near under on in out between above below with and or but not some many much all every again together really very also too now here there happy buy sell money shop shopping`.split(/\s+/));
let cached: { words: WordEntry[]; byId: Map<string, WordEntry>; topics: [string, string][]; media: Map<string, number> } | undefined;
export function vocabularyCatalog() {
    if (!cached) {
        const words = JSON.parse(readFileSync(join(process.cwd(), 'resources/vocabulary/words.json'), 'utf8')) as WordEntry[];
        const index = JSON.parse(readFileSync(join(process.cwd(), 'resources/vocabulary/index.json'), 'utf8')) as { topics: [string, string][]; words: [string, string, string, string, number, number, number][] };
        cached = { words, byId: new Map(words.map(w => [w.id, w])), topics: index.topics, media: new Map(index.words.map(w => [w[0], w[6]])) };
    }
    return cached;
}
export function matchesSettings(w: WordEntry, settings: VocabularySettings): boolean {
    const levels = settings.stage === 'primary' ? ['A1', 'A2'] : settings.stage === 'junior' ? ['A1', 'A2', 'B1'] : settings.stage === 'senior' ? ['A2', 'B1', 'B2'] : ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return levels.includes(w.cefr) && (settings.stage !== 'primary' || PRIMARY.has(w.w.toLowerCase()))
        && (settings.level === 'all' || settings.level === w.cefr) && (!settings.topic || settings.topic === w.topic);
}
export function wordSummary(w: WordEntry) { return { id: w.id, word: w.w, zh: w.senses.map(s => `${s.pos} ${s.zh}`).join('；'), cefr: w.cefr, topic: w.topic, ipa: w.uk }; }
export function mediaUrl(id: string, kind: string) { return `/api/vocabulary/media/${kind}/${encodeURIComponent(id)}`; }
export function wordDetails(w: WordEntry) { return { ...w, media: vocabularyCatalog().media.get(w.id) ?? 0 }; }
