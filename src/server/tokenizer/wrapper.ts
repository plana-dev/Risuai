/**
 * 간단한 wrapper 함수들
 * 기존 클라이언트 코드와의 호환성을 위한 wrapper
 */

import type { Database } from '../database';
import type { LLMModel } from '../model/types';
import type { TokenizerContext } from './types';
import { encode, encodeWithTokenizer } from './encode';
import { tokenize, tokenizeAccurate, tokenizeNum, tokenizerChar, getCharToken, getChatToken, strongBan } from './utils';
import { getModelInfo } from '../model/modellist';
import { getDatabase } from '../database';

/**
 * 간단한 tokenize 함수 (기존 API와 호환)
 * @deprecated 서버 사이드에서는 context를 명시적으로 전달하는 버전을 사용하세요
 */
export async function tokenizeSimple(data: string, userId?: string): Promise<number> {
    if (!userId) {
        throw new Error('userId is required for server-side tokenization');
    }
    
    const database = await getDatabase(userId);
    const modelInfo = getModelInfo(database.aiModel, userId);
    
    const context: TokenizerContext = {
        userId,
        database,
        modelInfo,
        customTokenizer: database.customTokenizer,
        currentPluginProvider: database.currentPluginProvider,
        googleClaudeTokenizing: database.googleClaudeTokenizing,
        useTokenizerCaching: database.useTokenizerCaching,
    };
    
    return await tokenize(data, context);
}

/**
 * 간단한 encode 함수 (기존 API와 호환)
 * @deprecated 서버 사이드에서는 context를 명시적으로 전달하는 버전을 사용하세요
 */
export async function encodeSimple(
    data: string,
    userId?: string
): Promise<number[] | Uint32Array | Int32Array> {
    if (!userId) {
        throw new Error('userId is required for server-side tokenization');
    }
    
    const database = await getDatabase(userId);
    const modelInfo = getModelInfo(database.aiModel, userId);
    
    const context: TokenizerContext = {
        userId,
        database,
        modelInfo,
        customTokenizer: database.customTokenizer,
        currentPluginProvider: database.currentPluginProvider,
        googleClaudeTokenizing: database.googleClaudeTokenizing,
        useTokenizerCaching: database.useTokenizerCaching,
    };
    
    return await encode(data, context);
}

// 기존 함수들 재export (호환성)
export {
    encode,
    encodeWithTokenizer,
    tokenize,
    tokenizeAccurate,
    tokenizeNum,
    tokenizerChar,
    getCharToken,
    getChatToken,
    strongBan,
};
