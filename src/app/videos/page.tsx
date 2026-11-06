import { Suspense } from 'react';
import { VideoLibrary } from '@/components/videos/library';
export default function VideosPage() { return <Suspense><VideoLibrary /></Suspense>; }
