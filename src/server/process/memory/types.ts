/**
 * Memory 관련 타입 정의
 * 원본: src/ts/process/memory/
 */

import type { OpenAIChat } from '../types';
import type { Chat, character, groupChat } from '../../database';
import type { ChatTokenizer } from '../../tokenizer';

/**
 * SupaMemory 결과
 */
export interface SupaMemoryResult {
    currentTokens: number;
    chats: OpenAIChat[];
    error?: string;
    memory?: string;
    lastId?: string;
}

/**
 * HypaMemory 모델 타입
 */
export type HypaModel =
    | 'custom'
    | 'ada'
    | 'openai3small'
    | 'openai3large'
    | 'MiniLM'
    | 'MiniLMGPU'
    | 'nomic'
    | 'nomicGPU'
    | 'bgeSmallEn'
    | 'bgeSmallEnGPU'
    | 'bgem3'
    | 'bgem3GPU'
    | 'multiMiniLM'
    | 'multiMiniLMGPU';

/**
 * 메모리 벡터
 */
export interface MemoryVector {
    text: string;
    vector: number[];
}

/**
 * 벡터 배열 타입
 */
export type VectorArray = number[] | Float32Array;

/**
 * HypaData 타입
 */
export interface HypaData {
    id: string;
    supa: string;
    hypa: string[];
}

/**
 * SupaMemory 인자
 */
export interface SupaMemoryArg {
    asHyper?: boolean;
}

/**
 * 메모리 처리 컨텍스트
 */
export interface MemoryContext {
    chats: OpenAIChat[];
    currentTokens: number;
    maxContextTokens: number;
    room: Chat;
    char: character | groupChat;
    tokenizer: ChatTokenizer;
}
