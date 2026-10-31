import type { TextbookInput } from '@/lib/textbooks/schema';
export interface TermView { id: string; unitId: string; word: string; meaning: string; example: string; translation: string; atlasId: string; useAtlasImage: boolean; position: number; notes: string; verified: boolean; archived: boolean }
export interface UnitView { id: string; code: string; title: string; moduleTitle: string; position: number; pageReference: string; notes: string; courseUrl: string; archived: boolean; terms: TermView[] }
export interface BookView extends TextbookInput { id: string; revision: number; units: UnitView[] }
