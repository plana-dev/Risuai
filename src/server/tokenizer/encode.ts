/**
 * 메인 encode 함수
 * 원본: src/ts/tokenizer.ts
 */

import type { TokenizerContext, TokenizerResult } from './types';
import type { LLMModel, LLMTokenizer } from '../model/types';
import { getHash, MemoryTokenizerCache } from './cache';
import { tikJS } from './tiktoken';
import { tokenizeWebTokenizers } from './web-tokenizers';
import { gemmaTokenize } from './gemma';
import { tokenizeGoogleCloud } from './google-cloud';
/**
 * GGUF 모델 토크나이징
 * 원본: src/ts/process/models/local.ts의 tokenizeGGUFModel
 * 서버 사이드에서는 로컬 모델 서버 API를 호출
 */
async function tokenizeGGUFModel(prompt: string, modelPath?: string, maxContext?: number, authKey?: string): Promise<number[]> {
    // 서버 사이드에서는 로컬 모델 서버가 실행 중이어야 함
    // 기본적으로 localhost:10026에서 실행되는 로컬 서버를 호출
    try {
        const key = authKey || 'default'; // TODO: 실제 인증 키 가져오기
        const response = await fetch("http://localhost:10026/llamacpp/tokenize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-risu-auth": key
            },
            body: JSON.stringify({
                prompt: prompt,
                n_ctx: maxContext || 4096,
                model_path: modelPath || ''
            })
        });

        if (!response.ok) {
            throw new Error(`Local model server error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        // Fallback: tiktoken 사용
        console.warn('[Tokenizer] tokenizeGGUFModel failed, using fallback tokenizer:', error);
        const { tikJS } = await import('./tiktoken');
        return await tikJS(prompt, 'cl100k_base');
    }
}

/**
 * 특정 tokenizer 타입으로 인코딩
 */
export async function encodeWithTokenizer(
    data: string,
    tokenizerType: string
): Promise<TokenizerResult> {
    switch (tokenizerType) {
        case 'tik':
            return await tikJS(data, 'cl100k_base');
        case 'mistral':
            return await tokenizeWebTokenizers(data, 'mistral');
        case 'novelai':
            return await tokenizeWebTokenizers(data, 'novelai');
        case 'claude':
            return await tokenizeWebTokenizers(data, 'claude');
        case 'llama':
            return await tokenizeWebTokenizers(data, 'llama');
        case 'llama3':
            return await tokenizeWebTokenizers(data, 'llama3');
        case 'novellist':
            return await tokenizeWebTokenizers(data, 'novellist');
        case 'gemma':
            return await gemmaTokenize(data);
        case 'cohere':
            return await tokenizeWebTokenizers(data, 'cohere');
        case 'deepseek':
            return await tokenizeWebTokenizers(data, 'DeepSeek');
        default:
            return await tikJS(data, 'cl100k_base');
    }
}

/**
 * 데이터베이스 설정에 따라 자동으로 적절한 tokenizer를 선택하여 인코딩
 */
export async function encode(
    data: string,
    context: TokenizerContext,
    cache?: { get: (key: string) => TokenizerResult | undefined | Promise<TokenizerResult | undefined>; set: (key: string, value: TokenizerResult) => void | Promise<void> }
): Promise<TokenizerResult> {
    const { database, modelInfo, customTokenizer, currentPluginProvider, googleClaudeTokenizing, useTokenizerCaching } = context;
    const tokenCache = cache || new MemoryTokenizerCache();

    let cacheKey = '';
    if (useTokenizerCaching) {
        cacheKey = getHash(
            data,
            database.aiModel,
            customTokenizer || '',
            currentPluginProvider || '',
            googleClaudeTokenizing || false,
            modelInfo,
            'none' // pluginTokenizer 제거됨
        );
        const cachedResult = await (typeof tokenCache.get === 'function' && tokenCache.get.constructor.name === 'AsyncFunction' 
            ? tokenCache.get(cacheKey) 
            : Promise.resolve(tokenCache.get(cacheKey)));
        if (cachedResult !== undefined) {
            return cachedResult;
        }
    }

    let result: TokenizerResult | undefined;

    if (database.aiModel === 'openrouter' || database.aiModel === 'reverse_proxy') {
        switch (customTokenizer) {
            case 'mistral':
                result = await tokenizeWebTokenizers(data, 'mistral'); break;
            case 'llama':
                result = await tokenizeWebTokenizers(data, 'llama'); break;
            case 'novelai':
                result = await tokenizeWebTokenizers(data, 'novelai'); break;
            case 'claude':
                result = await tokenizeWebTokenizers(data, 'claude'); break;
            case 'novellist':
                result = await tokenizeWebTokenizers(data, 'novellist'); break;
            case 'llama3':
                result = await tokenizeWebTokenizers(data, 'llama'); break;
            case 'gemma':
                result = await gemmaTokenize(data); break;
            case 'cohere':
                result = await tokenizeWebTokenizers(data, 'cohere'); break;
            case 'deepseek':
                result = await tokenizeWebTokenizers(data, 'DeepSeek'); break;
            default:
                result = await tikJS(data, 'o200k_base'); break;
        }
    // pluginTokenizer 제거됨 - custom 모델은 customTokenizer 사용

    // Fallback
    if (result === undefined) {
        if (modelInfo.tokenizer === LLMTokenizer.NovelList) {
            result = await tokenizeWebTokenizers(data, 'novellist');
        } else if (modelInfo.tokenizer === LLMTokenizer.Claude) {
            result = await tokenizeWebTokenizers(data, 'claude');
        } else if (modelInfo.tokenizer === LLMTokenizer.NovelAI) {
            result = await tokenizeWebTokenizers(data, 'novelai');
        } else if (modelInfo.tokenizer === LLMTokenizer.Mistral) {
            result = await tokenizeWebTokenizers(data, 'mistral');
        } else if (modelInfo.tokenizer === LLMTokenizer.Llama) {
            result = await tokenizeWebTokenizers(data, 'llama');
        } else if (modelInfo.tokenizer === LLMTokenizer.Local) {
            // Local 모델 토크나이징 (로컬 서버 필요)
            result = await tokenizeGGUFModel(data, undefined, database.maxContext);
        } else if (modelInfo.tokenizer === LLMTokenizer.tiktokenO200Base) {
            result = await tikJS(data, 'o200k_base');
        } else if (modelInfo.tokenizer === LLMTokenizer.GoogleCloud && googleClaudeTokenizing) {
            result = await tokenizeGoogleCloud(data, modelInfo, database);
        } else if (modelInfo.tokenizer === LLMTokenizer.Gemma || modelInfo.tokenizer === LLMTokenizer.GoogleCloud) {
            result = await gemmaTokenize(data);
        } else if (modelInfo.tokenizer === LLMTokenizer.DeepSeek) {
            result = await tokenizeWebTokenizers(data, 'DeepSeek');
        } else if (modelInfo.tokenizer === LLMTokenizer.Cohere) {
            result = await tokenizeWebTokenizers(data, 'cohere');
        } else {
            result = await tikJS(data);
        }
    }

    if (useTokenizerCaching && cacheKey) {
        await (typeof tokenCache.set === 'function' && tokenCache.set.constructor.name === 'AsyncFunction'
            ? tokenCache.set(cacheKey, result)
            : Promise.resolve(tokenCache.set(cacheKey, result)));
    }

    return result;
}
