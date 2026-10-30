import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class AudioCacheError extends Error {}
const pending = new Map<string, Promise<Buffer>>();
const failedWrites = new Set<string>();
const MAX_BYTES = 8 * 1024 * 1024;
function directory() { return process.env.LESSON_AUDIO_CACHE_DIR || path.join(process.env.CONFIG_DIR ? path.dirname(process.env.CONFIG_DIR) : process.cwd(), 'data', 'lesson-audio'); }
function validWave(data: Buffer) { return data.length >= 44 && data.length <= MAX_BYTES && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE' && data.readUInt32LE(4) === data.length - 8; }
async function read(file: string): Promise<Buffer | null> {
    try {
        const stat = await fs.stat(file); if (stat.size > MAX_BYTES) throw new AudioCacheError('AUDIO_CACHE_CORRUPT');
        const data = await fs.readFile(file); if (!validWave(data)) throw new AudioCacheError('AUDIO_CACHE_CORRUPT'); return data;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
/** 缓存不设 TTL，不因播放动作或密钥轮换失效；进程内 Promise 与磁盘锁共同去重。 */
export async function persistentLessonAudio(key: string, generate: () => Promise<Buffer>): Promise<Buffer> {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new AudioCacheError('AUDIO_CACHE_FAILED');
    const root = directory(), file = path.join(root, key + '.wav');
    const hit = await read(file); if (hit) return hit;
    if (failedWrites.has(file)) throw new AudioCacheError('AUDIO_CACHE_WRITE_FAILED');
    const existing = pending.get(file); if (existing) return existing;
    const job = generateLocked(root, file, generate); pending.set(file, job);
    void job.finally(() => { if (pending.get(file) === job) pending.delete(file); }).catch(() => {});
    return job;
}
async function generateLocked(root: string, file: string, generate: () => Promise<Buffer>) {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const lockFile = file + '.lock', until = Date.now() + 60_000;
    let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
    while (!lock) {
        const hit = await read(file); if (hit) return hit;
        try { lock = await fs.open(lockFile, 'wx', 0o600); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new AudioCacheError('AUDIO_CACHE_FAILED');
            try { if (Date.now() - (await fs.stat(lockFile)).mtimeMs > 120_000) await fs.unlink(lockFile); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new AudioCacheError('AUDIO_CACHE_FAILED'); }
            if (Date.now() > until) throw new AudioCacheError('AUDIO_BUSY');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    try {
        const hit = await read(file); if (hit) return hit;
        const data = await generate();
        if (!validWave(data)) throw new AudioCacheError('AUDIO_FAILED');
        const temporary = file + '.' + randomUUID() + '.tmp';
        try { await fs.writeFile(temporary, data, { mode: 0o600, flag: 'wx' }); await fs.rename(temporary, file); }
        catch { failedWrites.add(file); await fs.unlink(temporary).catch(() => {}); throw new AudioCacheError('AUDIO_CACHE_WRITE_FAILED'); }
        return data;
    } finally { await lock.close(); await fs.unlink(lockFile).catch(() => {}); }
}
