import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';

let running = 0;
const cache = new Map<string, { data: Buffer; expires: number }>();
let cacheBytes = 0;
const usage = new Map<string, { count: number; until: number }>();
export class LessonAudioError extends Error { constructor(public code: string, public status: number) { super(code); } }
export function checkAudioQuota(userId: string, now = Date.now()) {
    for (const [id, entry] of usage) if (entry.until < now) usage.delete(id);
    const entry = usage.get(userId) ?? { count: 0, until: now + 60_000 };
    if (entry.count >= 60) throw new LessonAudioError('AUDIO_BUSY', 429);
    entry.count++; usage.set(userId, entry);
}
/** stdout WAV 长度字段可能是流式占位，修正后浏览器才可正确暂停和定位。 */
export function normalizeWave(input: Buffer) {
    if (input.length < 44 || input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WAVE') throw new LessonAudioError('AUDIO_FAILED', 503);
    const data = Buffer.from(input); data.writeUInt32LE(data.length - 8, 4);
    for (let at = 12; at + 8 <= data.length;) {
        const size = data.readUInt32LE(at + 4);
        if (data.toString('ascii', at, at + 4) === 'data') { data.writeUInt32LE(data.length - at - 8, at + 4); return data; }
        at += 8 + size + (size % 2);
    }
    throw new LessonAudioError('AUDIO_FAILED', 503);
}
export async function synthesizeLessonAudio(userId: string, text: string, signal?: AbortSignal, language?: 'zh' | 'en') {
    const key = createHash('sha256').update(userId + '\0' + language + '\0' + text).digest('hex'), now = Date.now();
    for (const [id, entry] of cache) if (entry.expires < now) { cacheBytes -= entry.data.length; cache.delete(id); }
    const hit = cache.get(key); if (hit) return hit.data;
    if (running >= 2) throw new LessonAudioError('AUDIO_BUSY', 429);
    running++;
    try {
        const voice = (language ? language === 'zh' : /[\u3400-\u9fff]/.test(text)) ? 'cmn' : 'en-us';
        const output = await new Promise<Buffer>((resolve, reject) => {
            // 固定程序、固定参数、正文仅走 stdin，绝不拼接 shell 或写入音频文件。
            const child = execFile('espeak-ng', ['--stdout', '-v', voice, '-s', '145', '--stdin'],
                { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, timeout: 15_000, signal },
                (error, stdout) => error ? reject(new LessonAudioError('AUDIO_UNAVAILABLE', 503)) : resolve(stdout));
            child.stdin?.on('error', () => {}); child.stdin?.end(text, 'utf8');
        });
        const data = normalizeWave(output);
        while (cache.size && (cacheBytes + data.length > 8 * 1024 * 1024 || cache.size >= 32)) {
            const first = cache.keys().next().value!; cacheBytes -= cache.get(first)!.data.length; cache.delete(first);
        }
        if (data.length <= 8 * 1024 * 1024) { cache.set(key, { data, expires: now + 600_000 }); cacheBytes += data.length; }
        return data;
    } finally { running--; }
}
