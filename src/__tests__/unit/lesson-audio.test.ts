// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkAudioQuota, normalizeWave } from '@/lib/lesson-audio';
describe('兼容音频资源边界', () => {
    it('修正流式WAV长度，拒绝无效音频', () => {
        const wav = Buffer.alloc(100); wav.write('RIFF'); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.write('data', 36); wav.writeUInt32LE(0x7fffffff, 40);
        const result = normalizeWave(wav); expect(result.readUInt32LE(4)).toBe(92); expect(result.readUInt32LE(40)).toBe(56);
        expect(() => normalizeWave(Buffer.from('bad'))).toThrow('AUDIO_FAILED');
    });
    it('按用户限流，窗口过期自动恢复', () => {
        for (let i = 0; i < 60; i++) checkAudioQuota('quota-test', 1000);
        expect(() => checkAudioQuota('quota-test', 1000)).toThrow('AUDIO_BUSY');
        expect(() => checkAudioQuota('different-user', 1000)).not.toThrow();
        expect(() => checkAudioQuota('quota-test', 62000)).not.toThrow();
    });
});
