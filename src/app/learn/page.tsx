import { TopicBrowser } from '@/components/learning/topic-browser';
export default async function LearningPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
    return <TopicBrowser initialSearch={(await searchParams).search?.slice(0, 100)} />;
}
