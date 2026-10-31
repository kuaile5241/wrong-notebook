import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { learningAuth, learningFailure } from '@/lib/learning/auth';
import { vocabularyCatalog } from '@/lib/vocabulary/catalog';
import { mediaRange } from '@/lib/vocabulary/media';
type Context = { params: Promise<{ id: string; kind: string }> };
const kinds: Record<string, { directory: string; extension: string; type: string; bit: number }> = {
    image: { directory: 'img', extension: 'webp', type: 'image/webp', bit: 1 },
    thumb: { directory: 'thumb', extension: 'webp', type: 'image/webp', bit: 1 },
    uk: { directory: 'audio/uk', extension: 'mp3', type: 'audio/mpeg', bit: 2 },
    us: { directory: 'audio/us', extension: 'mp3', type: 'audio/mpeg', bit: 4 },
    ex: { directory: 'audio/ex', extension: 'mp3', type: 'audio/mpeg', bit: 8 },
    ex2: { directory: 'audio/ex2', extension: 'mp3', type: 'audio/mpeg', bit: 16 },
};
export async function GET(req: Request, ctx: Context) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const { id, kind } = await ctx.params, media = kinds[kind];
        if (!media || !vocabularyCatalog().byId.has(id) || !/^[a-z0-9-]+$/.test(id) || !((vocabularyCatalog().media.get(id) ?? 0) & media.bit)) return new Response(null, { status: 404 });
        const root = path.resolve(process.env.VOCABULARY_MEDIA_DIR || path.join(process.cwd(), 'resources/vocabulary-media'));
        const file = path.resolve(root, media.directory, `${id}.${media.extension}`);
        if (!file.startsWith(root + path.sep)) return new Response(null, { status: 404 });
        let data: Buffer;
        try { data = await readFile(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response(null, { status: 404 }); throw error; }
        const range = mediaRange(req.headers.get('range'), data.length);
        if (range === false) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${data.length}` } });
        const headers: Record<string, string> = { 'Content-Type': media.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(range ? range.end - range.start + 1 : data.length) };
        if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${data.length}`;
        return new Response(req.method === 'HEAD' ? null : new Uint8Array(range ? data.subarray(range.start, range.end + 1) : data), { status: range ? 206 : 200, headers });
    } catch (error) { return learningFailure(error); }
}
export const HEAD = GET;
