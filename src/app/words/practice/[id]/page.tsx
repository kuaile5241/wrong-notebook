import { VocabularyPractice } from '@/components/vocabulary/practice-runner';
export default async function VocabularyPracticePage({ params }: { params: Promise<{ id: string }> }) {
    return <VocabularyPractice id={(await params).id} />;
}
