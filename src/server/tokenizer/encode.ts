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
import { tokenizeGGUFModel } from '../../ts/process/models/local';

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
    const { database, modelInfo, customTokenizer, currentPluginProvider, googleClaudeTokenizing, pluginTokenizer, useTokenizerCaching } = context;
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
            pluginTokenizer || 'none'
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
    } else if (database.aiModel === 'custom' && pluginTokenizer) {
        switch (pluginTokenizer) {
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
            case 'o200k_base':
                result = await tikJS(data, 'o200k_base'); break;
            case 'cl100k_base':
                result = await tikJS(data, 'cl100k_base'); break;
            case 'custom':
                // TODO: 플러그인 tokenizer 함수 호출
                result = [0]; break;
            default:
                result = await tikJS(data, 'o200k_base'); break;
        }
    }

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
            result = await tokenizeGGUFModel(data);
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
