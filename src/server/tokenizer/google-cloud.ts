/**
 * Google Cloud Tokenizer 구현
 * 원본: src/ts/tokenizer.ts
 */

import type { Database } from '../database';
import type { LLMModel } from '../model/types';
import { getGoogleCloudCache } from './cache';
import { tokenizeWebTokenizers } from './web-tokenizers';

/**
 * Google Cloud API를 사용한 토큰 카운팅
 */
export async function tokenizeGoogleCloud(
    text: string,
    model: LLMModel,
    database: Database
): Promise<number[] | Uint32Array | Int32Array> {
    const cache = getGoogleCloudCache();
    const cacheKey = text + model.internalID;

    if (cache.has(cacheKey)) {
        const count = cache.get(cacheKey);
        if (count !== undefined) {
            return new Uint32Array(count);
        }
    }

    if (!database.google?.accessToken) {
        // Fallback to gemma tokenizer
        return await tokenizeWebTokenizers(text, 'gemma');
    }

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model.internalID}:countTokens?key=${database.google.accessToken}`,
            {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: text
                        }]
                    }]
                }),
            }
        );

        if (res.status !== 200) {
            return await tokenizeWebTokenizers(text, 'gemma');
        }

        const json = await res.json();
        const count = json.totalTokens as number;
        cache.set(cacheKey, count);

        return new Uint32Array(count);
    } catch (error) {
        console.error('[Google Cloud Tokenizer] Error:', error);
        return await tokenizeWebTokenizers(text, 'gemma');
    }
}

/**
 * Gemini Tokenizer (구버전 API)
 */
export async function geminiTokenizer(
    text: string,
    database: Database
): Promise<number> {
    if (!database.google?.accessToken) {
        // Fallback to tiktoken
        const { tikJS } = await import('./tiktoken');
        const result = await tikJS(text);
        return Array.isArray(result) ? result.length : result.length;
    }

    try {
        const fetchResult = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${database.aiModel}:countTextTokens`,
            {
                headers: {
                    "content-type": "application/json",
                    "authorization": `Bearer ${database.google.accessToken}`
                },
                body: JSON.stringify({
                    "prompt": {
                        text: text
                    }
                }),
                method: "POST"
            }
        );

        if (!fetchResult.ok) {
            // Fallback to tiktoken
            const { tikJS } = await import('./tiktoken');
            const result = await tikJS(text);
            return Array.isArray(result) ? result.length : result.length;
        }

        const result = await fetchResult.json();
        return result.tokenCount ?? 0;
    } catch (error) {
        console.error('[Gemini Tokenizer] Error:', error);
        const { tikJS } = await import('./tiktoken');
        const result = await tikJS(text);
        return Array.isArray(result) ? result.length : result.length;
    }
}
