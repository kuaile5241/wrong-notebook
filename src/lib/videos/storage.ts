import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { videoId, MAX_VIDEO_BYTES } from './schema';

export function videoDirectory() {
    return process.env.VIDEO_LESSON_DIR || path.join(process.cwd(), 'data', 'lesson-videos');
}
export function videoFile(id: string) {
    videoId.parse(id);
    return path.join(videoDirectory(), id + '.mp4');
}
export async function videoExists(id: string) {
    try { return (await stat(videoFile(id))).isFile(); } catch { return false; }
}
/** 流式上传有独立体积上限，临时文件成功落盘后才发布。 */
export async function saveVideo(body: ReadableStream<Uint8Array>) {
    await mkdir(videoDirectory(), { recursive: true });
    const temporary = path.join(videoDirectory(), randomUUID() + '.upload');
    const file = await open(temporary, 'wx');
    const reader = body.getReader();
    const hash = createHash('sha256');
    let bytes = 0;
    let header = Buffer.alloc(0);
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            bytes += value.length;
            if (bytes > MAX_VIDEO_BYTES) throw new Error('VIDEO_TOO_LARGE');
            if (header.length < 32) header = Buffer.concat([header, Buffer.from(value)]).subarray(0, 32);
            hash.update(value);
            await file.writeFile(value);
        }
        if (bytes < 32 || header.toString('ascii', 4, 8) !== 'ftyp') throw new Error('INVALID_MP4');
        await file.sync();
        await file.close();
        const id = hash.digest('hex');
        await rename(temporary, videoFile(id)).catch(async error => {
            if (!await videoExists(id)) throw error;
            await unlink(temporary);
        });
        return { id, bytes };
    } catch (error) {
        await file.close().catch(() => {});
        await reader.cancel().catch(() => {});
        await unlink(temporary).catch(() => {});
        throw error;
    } finally { reader.releaseLock(); }
}
