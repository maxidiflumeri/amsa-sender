import { RedisClientType } from 'redis';
import { Logger } from '@nestjs/common';

const logger = new Logger('RedisLockUtils');

/**
 * Intenta adquirir un lock en Redis.
 * Retorna true si se adquirió, false si ya existía.
 */
export async function acquireLock(redis: RedisClientType, key: string, ttlSeconds: number): Promise<boolean> {
    try {
        // SET key value NX EX ttl
        const result = await redis.set(key, 'LOCKED', {
            NX: true, // Sólo si no existe
            EX: ttlSeconds, // Exigra en N segundos
        });
        return result === 'OK';
    } catch (error) {
        logger.error(`Error acquiring lock for ${key}: ${error.message}`);
        return false;
    }
}

/**
 * Libera un lock en Redis.
 */
export async function releaseLock(redis: RedisClientType, key: string): Promise<void> {
    try {
        await redis.del(key);
    } catch (error) {
        logger.error(`Error releasing lock for ${key}: ${error.message}`);
    }
}

/**
 * Renueva el TTL de un lock existente (heartbeat).
 */
export async function renewLock(redis: RedisClientType, key: string, ttlSeconds: number): Promise<boolean> {
    try {
        // Solo renovamos si existe (XX)
        const result = await redis.expire(key, ttlSeconds);
        return !!result;
    } catch (error) {
        logger.error(`Error renewing lock for ${key}: ${error.message}`);
        return false;
    }
}

/**
 * Espera hasta adquirir locks para TODAS las keys provistas.
 * Bloqueante (polling).
 */
export async function waitForLocks(
    redis: RedisClientType,
    keys: string[],
    ttlSeconds: number,
    checkIntervalMs = 2000
): Promise<void> {
    while (true) {
        const acquiredLength = 0;
        const acquiredKeys: string[] = [];
        let allAcquired = true;

        for (const key of keys) {
            const acquired = await acquireLock(redis, key, ttlSeconds);
            if (acquired) {
                acquiredKeys.push(key);
            } else {
                allAcquired = false;
                break; // Falló uno, abortamos intento
            }
        }

        if (allAcquired) {
            // Éxito: tenemos todos los locks.
            return;
        } else {
            // Completamos el rollback de los que sí adquirimos en este intento fallido
            for (const key of acquiredKeys) {
                await releaseLock(redis, key);
            }
            // Esperamos antes de reintentar
            await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
        }
    }
}
