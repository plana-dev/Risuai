/**
 * Tokenizer 캐싱 로직
 * 원본: src/ts/tokenizer.ts
 * 
 * 서버 사이드에서는 Redis를 사용하여 캐싱합니다.
 */

import { LRUMap } from 'mnemonist';
import type { TokenizerResult, TokenizerCache } from './types';
import { getRedisService } from '../redis-service';

const MAX_CACHE_SIZE = 1500;

// 메모리 캐시 (빠른 접근용)
const encodeCache = new LRUMap<string, TokenizerResult>(MAX_CACHE_SIZE);

// Google Cloud Tokenizer 캐시
const googleCloudTokenizedCache = new Map<string, number>();

/**
 * 캐시 키 생성
 */
export function getHash(
    data: string,
    aiModel: string,
    customTokenizer: string,
    currentPluginProvider: string,
    googleClaudeTokenizing: boolean,
    modelInfo: { tokenizer: any },
    pluginTokenizer: string
): string {
    const combined = `${data}::${aiModel}::${customTokenizer}::${currentPluginProvider}::${googleClaudeTokenizing ? '1' : '0'}::${modelInfo.tokenizer}::${pluginTokenizer}`;
    return combined;
}

/**
 * 메모리 캐시 기반 TokenizerCache 구현
 */
export class MemoryTokenizerCache implements TokenizerCache {
    get(key: string): TokenizerResult | undefined {
        return encodeCache.get(key);
    }

    set(key: string, value: TokenizerResult): void {
        encodeCache.set(key, value);
    }
}

/**
 * Redis 기반 TokenizerCache 구현
 */
export class RedisTokenizerCache implements TokenizerCache {
    private redis = getRedisService();

    async get(key: string): Promise<TokenizerResult | undefined> {
        try {
            const cached = await this.redis.get(`tokenizer:${key}`);
            if (cached) {
                return JSON.parse(cached) as TokenizerResult;
            }
        } catch (error) {
            console.error('[Tokenizer Cache] Failed to get from Redis:', error);
        }
        return undefined;
    }

    async set(key: string, value: TokenizerResult): Promise<void> {
        try {
            await this.redis.set(`tokenizer:${key}`, JSON.stringify(value), 3600); // 1시간 TTL
        } catch (error) {
            console.error('[Tokenizer Cache] Failed to set to Redis:', error);
        }
    }
}

/**
 * Google Cloud Tokenizer 캐시 관리
 */
export function getGoogleCloudCache(): Map<string, number> {
    return googleCloudTokenizedCache;
}
