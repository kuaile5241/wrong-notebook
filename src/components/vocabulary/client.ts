export class VocabularyRequestError extends Error { constructor(public status: number) { super('VOCABULARY_REQUEST_FAILED'); } }
export async function vocabularyRequest<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, { cache: 'no-store', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    if (!response.ok) throw new VocabularyRequestError(response.status);
    return response.json() as Promise<T>;
}
