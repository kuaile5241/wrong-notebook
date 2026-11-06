import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { getAIService } from '@/lib/ai';
import { getAppConfig, getActiveOpenAIConfig } from '@/lib/config';
import { consumeAiQuota } from '@/lib/ai-quota';
import { accountAccessStatus } from '@/lib/account-access';
import { speechText } from '@/lib/lesson-content';
import { createLogger } from '@/lib/logger';
import { videoFile, videoDirectory, videoExists } from '@/lib/videos/storage';
import { parseVideoPlan } from './plan';

const logger = createLogger('video-generation');
const active = globalThis as typeof globalThis & { videoPlanning?: boolean; videoTimer?: ReturnType<typeof setInterval> };
export const VOICES = ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'] as const;
export function jobDirectory(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('INVALID_JOB');
    return path.join(process.env.VIDEO_JOB_DIR || path.join(process.cwd(), 'data', 'video-jobs'), id);
}
export function generationId(userId: string, itemId: string, source: string, voice: string) {
    const config = getAppConfig();
    const provider = config.aiProvider;
    const selected = provider === 'openai' ? getActiveOpenAIConfig() : provider === 'minimax-code' ? config.minimaxCode : config[provider];
    const identity = Object.entries(selected || {}).filter(([key]) => ['model', 'baseUrl', 'deploymentName'].includes(key));
    return createHash('sha256').update(JSON.stringify(['papermorph-v1-edge7.3.1-rate-10', provider, identity, userId, itemId, source, voice])).digest('hex');
}
async function publishInput(id: string, voice: string, planText: string, attempt: string) {
    const plan = parseVideoPlan(planText);
    if (!plan.supported) return;
    const directory = jobDirectory(id);
    await mkdir(directory, { recursive: true });
    await unlink(path.join(directory, 'state.json')).catch(() => {});
    const temporary = path.join(directory, randomUUID() + '.tmp');
    const input = { ...plan, voice, attempt, scenes: plan.scenes.map(scene => ({ ...scene, spoken: speechText(scene.narration, 'zh') })) };
    await writeFile(temporary, JSON.stringify(input), { mode: 0o600 });
    await rename(temporary, path.join(directory, 'input.json'));
}
export async function reconcileVideoJobs() {
    const rows = await prisma.videoGeneration.findMany({ where: { status: 'rendering' }, take: 50 });
    for (const row of rows) {
        let state;
        try { state = JSON.parse(await readFile(path.join(jobDirectory(row.id), 'state.json'), 'utf8')); } catch { continue; }
        if (state.attempt !== row.attempt) continue;
        if (state.status === 'failed') {
            await prisma.videoGeneration.updateMany({ where: { id: row.id, status: 'rendering', attempt: row.attempt }, data: { status: 'failed', error: String(state.error || 'RENDER_FAILED').slice(0, 100) } });
        } else if (state.status === 'completed' && /^[a-f0-9]{64}$/.test(state.sha256)) {
            const output = path.join(jobDirectory(row.id), 'output.mp4');
            await mkdir(videoDirectory(), { recursive: true });
            if (!await videoExists(state.sha256)) {
                const file = await stat(output).catch(() => null);
                if (!file || file.size < 100 || file.size > 100 * 1024 * 1024) continue;
                const hash = createHash('sha256').update(await readFile(output)).digest('hex');
                if (hash !== state.sha256) continue;
                await rename(output, videoFile(hash));
            }
            const bytes = (await stat(videoFile(state.sha256))).size;
            await writeFile(path.join(jobDirectory(row.id), 'owner.json'), JSON.stringify({ userId: row.userId, source: row.source, hash: state.sha256 }), { mode: 0o600 });
            await prisma.videoGeneration.updateMany({ where: { id: row.id, status: 'rendering', attempt: row.attempt }, data: { status: 'completed', resultHash: state.sha256, bytes, error: '' } });
        }
    }
}
export async function pumpVideoJobs() {
    if (active.videoPlanning) return;
    active.videoPlanning = true;
    try {
        await reconcileVideoJobs();
        // 模型请求中断后只标记失败，重试由用户发起，已保存分镜和音频继续复用。
        await prisma.videoGeneration.updateMany({ where: { status: 'planning', updatedAt: { lt: new Date(Date.now() - 15 * 60_000) } }, data: { status: 'failed', error: 'TASK_INTERRUPTED' } });
        const job = await prisma.videoGeneration.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' } });
        if (!job) return;
        const attempt = randomUUID();
        const claim = await prisma.videoGeneration.updateMany({ where: { id: job.id, status: 'queued' }, data: { status: 'planning', attempt } });
        if (!claim.count) return;
        try {
            const user = await prisma.user.findUniqueOrThrow({ where: { id: job.userId } });
            if (accountAccessStatus(user) !== 'active' || (!user.canUseAi && user.role !== 'admin')) throw new Error('ACCOUNT_UNAVAILABLE');
            let planText = job.plan;
            if (!planText) {
                const quota = await consumeAiQuota(user, 'animation');
                if (quota) throw new Error('AI_DAILY_LIMIT_EXCEEDED');
                const source = JSON.parse(job.source);
                const plan = await getAIService().generateVideoPlan(source.question, source.answer, source.analysis);
                planText = JSON.stringify(plan);
                const stored = await prisma.videoGeneration.updateMany({ where: { id: job.id, attempt }, data: { plan: planText } });
                if (!stored.count) return;
            }
            const plan = parseVideoPlan(planText);
            if (!plan.supported) {
                await prisma.videoGeneration.updateMany({ where: { id: job.id, attempt }, data: { status: 'unsupported', error: plan.reason } });
                return;
            }
            // 分镜已持久化。输入原子发布后进入渲染状态，渲染器用文件锁串行处理。
            await publishInput(job.id, job.voice, planText, attempt);
            await prisma.videoGeneration.updateMany({ where: { id: job.id, status: 'planning', attempt }, data: { status: 'rendering', error: '' } });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'GENERATION_FAILED';
            const code = message.startsWith('AI_') ? message.split(':')[0] : ['ACCOUNT_UNAVAILABLE','TASK_INTERRUPTED'].includes(message) ? message : 'GENERATION_FAILED';
            logger.warn({ jobId: job.id, code }, 'Video generation failed');
            await prisma.videoGeneration.updateMany({ where: { id: job.id, attempt }, data: { status: 'failed', error: code } });
        }
    } finally { active.videoPlanning = false; }
}
export function startVideoScheduler() {
    if (active.videoTimer) return;
    active.videoTimer = setInterval(() => { void pumpVideoJobs().catch(error => logger.error({ error }, 'Video queue error')); }, 5000);
    active.videoTimer.unref?.();
}
export async function videoJobView(job: { id: string; status: string; error: string; bytes: number }) {
    let progress = 0;
    try { const state = JSON.parse(await readFile(path.join(jobDirectory(job.id), 'state.json'), 'utf8')); progress = Math.max(0, Math.min(100, Number(state.progress) || 0)); } catch { /* 尚未开始渲染。 */ }
    return { id: job.id, status: job.status, error: job.error, bytes: job.bytes, progress };
}
