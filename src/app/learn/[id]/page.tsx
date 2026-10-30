import { LearningRunner } from '@/components/learning/learning-runner';
export default async function LearningSessionPage({ params }: { params: Promise<{ id: string }> }) {
    return <LearningRunner id={(await params).id} />;
}
