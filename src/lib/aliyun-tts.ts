import { z } from 'zod';
import { getAppConfig } from './config';

export const aliyunTtsSchema = z.object({
    enabled: z.boolean(),
    apiKey: z.string().trim().max(512).refine(v => !/[\r\n]/.test(v)),
    workspaceId: z.string().trim().max(100).regex(/^[a-zA-Z0-9-]*$/),
    voice: z.enum(['longanyang', 'longxiaochun_v3']),
});
export type AliyunTtsConfig = z.infer<typeof aliyunTtsSchema>;
export const ALIYUN_MODEL = 'cosyvoice-v3-flash';
export function getAliyunTtsConfig(): AliyunTtsConfig {
    const stored = getAppConfig().aliyunTts;
    return { enabled: stored?.enabled ?? !!process.env.DASHSCOPE_API_KEY,
        apiKey: stored?.apiKey || process.env.DASHSCOPE_API_KEY || '',
        workspaceId: stored?.workspaceId || process.env.DASHSCOPE_WORKSPACE_ID || '',
        voice: stored?.voice ?? 'longxiaochun_v3' };
}
export function aliyunReady(config = getAliyunTtsConfig()) { return config.enabled && !!config.apiKey && /^[a-zA-Z0-9-]+$/.test(config.workspaceId); }

/** 固定北京业务空间域名；音频仅允许从百炼官方结果桶读取，不传递鉴权头。 */
export async function synthesizeAliyun(text: string, config: AliyunTtsConfig, signal?: AbortSignal): Promise<Buffer> {
    if (!aliyunReady(config)) throw new Error('AUDIO_NOT_CONFIGURED');
    const timeout = AbortSignal.timeout(30_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    // 旧业务空间提供数字 ID，未分配专属 API Host 时使用官方 DashScope 域名。
    const host = /^\d+$/.test(config.workspaceId) ? 'dashscope.aliyuncs.com' : `${config.workspaceId}.cn-beijing.maas.aliyuncs.com`;
    const response = await fetch(`https://${host}/api/v1/services/audio/tts/SpeechSynthesizer`, {
        method: 'POST', redirect: 'error', signal: requestSignal,
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ALIYUN_MODEL, input: { text, voice: config.voice, format: 'wav', sample_rate: 24000, rate: 0.95 } }),
    });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'AUDIO_CREDENTIALS' : response.status === 429 ? 'AUDIO_BUSY' : 'AUDIO_PROVIDER_FAILED');
    const result = z.object({ output: z.object({ audio: z.object({ url: z.string().max(8192) }) }) }).safeParse(await response.json());
    if (!result.success) throw new Error('AUDIO_PROVIDER_FAILED');
    const url = new URL(result.data.output.audio.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'dashscope-result-bj.oss-cn-beijing.aliyuncs.com' || url.username || url.password || url.port) throw new Error('AUDIO_PROVIDER_FAILED');
    url.protocol = 'https:';
    const audio = await fetch(url, { signal: requestSignal, redirect: 'error' });
    if (!audio.ok || !audio.body) throw new Error('AUDIO_PROVIDER_FAILED');
    const reader = audio.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
        while (true) {
            const part = await reader.read(); if (part.done) break;
            size += part.value.byteLength;
            if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error('AUDIO_PROVIDER_FAILED'); }
            chunks.push(part.value);
        }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
}
