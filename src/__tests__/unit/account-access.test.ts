import { describe, it, expect } from 'vitest';
import { accountAccessStatus, requestPermission } from '@/lib/account-access';
const now = Date.parse('2026-10-29T12:00:00Z');
describe('账户到期规则', () => {
    it('旧账号不限时，截止时刻立即失效，管理员不受普通期限影响', () => {
        expect(accountAccessStatus({ role: 'user', isActive: true }, now)).toBe('active');
        expect(accountAccessStatus({ role: 'user', accessExpiresAt: new Date(now) }, now)).toBe('expired');
        expect(accountAccessStatus({ role: 'user', accessExpiresAt: new Date(now + 1) }, now)).toBe('active');
        expect(accountAccessStatus({ role: 'admin', accessExpiresAt: new Date(0) }, now)).toBe('active');
    });
    it('失效日期、停用及不存在账号均不可访问', () => {
        expect(accountAccessStatus({ accessExpiresAt: 'bad' }, now)).toBe('expired');
        expect(accountAccessStatus({ isActive: false, role: 'admin' }, now)).toBe('disabled');
        expect(accountAccessStatus(null, now)).toBe('missing');
    });
    it('不同时区的日期按同一绝对时刻判定', () => { expect(accountAccessStatus({ accessExpiresAt: '2026-10-29T20:00:00+08:00' }, now)).toBe('expired'); });
});
describe('功能权限覆盖', () => {
    it.each(['/api/analyze','/api/reanswer','/api/geogebra-analyze','/api/practice/generate','/api/practice/grade','/api/exams','/api/exams/p/retry','/api/exams/p/questions/q/regenerate','/api/error-items/i/reanswer','/api/error-items/i/retag','/api/error-items/i/figure','/api/error-items/i/fix-latex','/api/error-items/i/geogebra','/api/error-items/i/svg-animation','/api/notebooks/n/retag','/api/openclaw/batch-upload'])('禁止AI时覆盖%s', path => { expect(requestPermission({ canUseAi: false },path,'POST')).toBe(false); });
    it('只读学习与手工录题不受AI开关影响', () => { expect(requestPermission({ canUseAi: false },'/api/notebooks','GET')).toBe(true); expect(requestPermission({ canUseAi: false },'/api/error-items','POST')).toBe(true); });
    it('管理员拥有完整功能权限', () => { expect(requestPermission({ role: 'admin', canUseAi: false, canImportExport: false },'/api/analyze','POST')).toBe(true); });
});
