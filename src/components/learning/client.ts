/** 客户端只处理题面和提交，不计算或保存标准答案。 */
export async function learningRequest<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Request failed');
    return data as T;
}
export function submissionId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
