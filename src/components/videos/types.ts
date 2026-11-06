import type { VideoMetadata } from '@/lib/videos/schema';
export interface VideoLesson extends VideoMetadata { id: string; bytes: number; revision: number; linked?: boolean }
