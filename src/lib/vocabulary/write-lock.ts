const writes = new Map<string, Promise<void>>();
/** 同一账号的提交在进程内排队；数据库版本条件仍是跨进程的最终保护。 */
export async function vocabularyWrite<T>(userId: string, action: () => Promise<T>): Promise<T> {
    const previous = writes.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    writes.set(userId, current);
    await previous;
    try { return await action(); }
    finally { release(); if (writes.get(userId) === current) writes.delete(userId); }
}
