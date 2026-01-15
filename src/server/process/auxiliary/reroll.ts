/**
 * Reroll 처리 함수
 * 원본: src/ts/process/prereroll.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 * 
 * Redis를 사용하여 사용자별로 reroll 데이터 관리
 */

import { getRedisService } from '../../redis-service';

/**
 * Reroll 데이터 가져오기
 */
export function Prereroll(genId: string, userId: string): Promise<string | null> {
    return (async () => {
        const redis = getRedisService();
        const rerolls = await redis.getRerolls(userId, genId);
        const rerollIndex = await redis.getRerollIndex(userId, genId);

        if (rerolls && rerolls.length > 0) {
            const index = (rerollIndex ?? 0) + 1;
            await redis.setRerollIndex(userId, genId, index);
            return rerolls[index] ?? null;
        }
        return null;
    })();
}

/**
 * Unreroll (이전 reroll로 돌아가기)
 */
export function PreUnreroll(genId: string, userId: string): Promise<string | null> {
    return (async () => {
        const redis = getRedisService();
        const rerolls = await redis.getRerolls(userId, genId);
        const rerollIndex = await redis.getRerollIndex(userId, genId);

        if (rerolls && rerolls.length > 0) {
            let index = (rerollIndex ?? 0) - 1;
            if (index < 0) {
                return null;
            }
            await redis.setRerollIndex(userId, genId, index);
            return rerolls[index] ?? null;
        }
        return null;
    })();
}

/**
 * Reroll 데이터 추가
 */
export async function addRerolls(genId: string, values: string[], userId: string): Promise<void> {
    const redis = getRedisService();
    await redis.setRerolls(userId, genId, values);
    await redis.setRerollIndex(userId, genId, 0);
}
