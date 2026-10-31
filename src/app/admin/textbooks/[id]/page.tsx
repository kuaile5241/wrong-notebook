import { TextbookDetail } from '@/components/textbooks/book-detail';
export default async function TextbookEditorPage({ params }: { params: Promise<{ id: string }> }) { return <TextbookDetail id={(await params).id} manage />; }
