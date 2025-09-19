import { RedisClientType } from 'redis';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

export const acquireGlobalSesSlot = async (
    redis: RedisClientType,
    maxPerSec: number
) => {
    while (true) {
        const nowSec = Math.floor(Date.now() / 1000);
        const key = `ses:rate:${nowSec}`;
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, 2); // TTL 2s
        }
        if (current <= maxPerSec) return;
        await sleep(50);
    }
};