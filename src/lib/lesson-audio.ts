import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getAliyunTtsConfig, synthesizeAliyun, ALIYUN_MODEL } from './aliyun-tts';
import { AudioCacheError, persistentLessonAudio } from './lesson-audio-cache';
import { createLogger } from './logger';

let running = 0;
const logger = createLogger('lesson-audio');
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
export async function synthesizeLessonAudio(userId: string, text: string, signal?: AbortSignal, language?: 'zh' | 'en', mode: 'auto' | 'natural' | 'compatible' = 'auto') {
    // 权限在路由校验。用户离开后仍完成同一生成任务并保存，后续请求复用，不再次付费。
    void [userId, signal];
    const config = getAliyunTtsConfig();
    const natural = mode === 'natural' || (mode === 'auto' && config.enabled);
    if (natural && !config.enabled) throw new LessonAudioError('AUDIO_NOT_CONFIGURED', 503);
    const deviceVoice = (language ? language === 'zh' : /[\u3400-\u9fff]/.test(text)) ? 'cmn' : 'en-us';
    const identity = natural ? [ALIYUN_MODEL, config.voice, 0.95, 24000, 'wav'] : ['espeak-ng', deviceVoice, 145, 'wav'];
    const key = createHash('sha256').update(JSON.stringify([identity, text])).digest('hex');
    return persistentLessonAudio(key, async () => {
        if (running >= 2) throw new LessonAudioError('AUDIO_BUSY', 429);
        if (natural && (!config.apiKey || !config.workspaceId)) throw new LessonAudioError('AUDIO_NOT_CONFIGURED', 503);
        running++;
        try {
            logger.info({ audioKey: key, provider: natural ? 'aliyun' : 'espeak', model: natural ? ALIYUN_MODEL : 'espeak-ng', voice: natural ? config.voice : deviceVoice }, 'Generating new lesson audio');
            const output = natural ? await synthesizeAliyun(text, config).catch((error: unknown) => {
                const code = error instanceof Error && ['AUDIO_NOT_CONFIGURED', 'AUDIO_CREDENTIALS', 'AUDIO_BUSY'].includes(error.message) ? error.message : 'AUDIO_PROVIDER_FAILED';
                throw new LessonAudioError(code, code === 'AUDIO_BUSY' ? 429 : 503);
            }) : await new Promise<Buffer>((resolve, reject) => {
                // 固定程序、固定参数、正文仅走 stdin，不拼接 shell；完成后统一原子保存。
                const child = execFile('espeak-ng', ['--stdout', '-v', deviceVoice, '-s', '145', '--stdin'],
                    { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, timeout: 15_000 },
                    (error, stdout) => error ? reject(new LessonAudioError('AUDIO_UNAVAILABLE', 503)) : resolve(stdout));
                child.stdin?.on('error', () => {}); child.stdin?.end(text, 'utf8');
            });
            return normalizeWave(output);
        } finally { running--; }
    }).catch((error: unknown) => { if (error instanceof AudioCacheError) throw new LessonAudioError(error.message, error.message === 'AUDIO_BUSY' ? 429 : 503); throw error; });
}
