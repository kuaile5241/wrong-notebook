import { TextbookDetail } from '@/components/textbooks/book-detail';
export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ unit?: string }> }) {
    return <TextbookDetail id={(await params).id} initialUnit={(await searchParams).unit} />;
}
