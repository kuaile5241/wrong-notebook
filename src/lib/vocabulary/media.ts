/** 支持浏览器/安卓音频的单段 Range 请求，拒绝多段与越界请求。 */
export function mediaRange(header: string | null, length: number): { start: number; end: number } | null | false {
    if (!header) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match || (!match[1] && !match[2])) return false;
    const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(length - 1, Number(match[2])) : length - 1;
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < length ? { start, end } : false;
}
