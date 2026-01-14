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

/**
 * HypaV3 Preset 및 Settings
 */
export interface HypaV3Preset {
    name: string;
    settings: HypaV3Settings;
}

export interface HypaV3Settings {
    summarizationModel: string;
    summarizationPrompt: string;
    reSummarizationPrompt: string;
    memoryTokensRatio: number;
    extraSummarizationRatio: number;
    maxChatsPerSummary: number;
    recentMemoryRatio: number;
    similarMemoryRatio: number;
    enableSimilarityCorrection: boolean;
    preserveOrphanedMemory: boolean;
    processRegexScript: boolean;
    doNotSummarizeUserMessage: boolean;
    // Experimental
    useExperimentalImpl: boolean;
    summarizationRequestsPerMinute: number;
    summarizationMaxConcurrent: number;
    embeddingRequestsPerMinute: number;
    embeddingMaxConcurrent: number;
    alwaysToggleOn: boolean;
}

/**
 * HypaV3 Data 타입
 */
export interface HypaV3Data {
    summaries: HypaV3Summary[];
    categories?: { id: string; name: string }[];
    lastSelectedSummaries?: number[];
    metrics?: {
        lastImportantSummaries: number[];
        lastRecentSummaries: number[];
        lastSimilarSummaries: number[];
        lastRandomSummaries: number[];
    };
}

export interface HypaV3Summary {
    text: string;
    chatMemos: Set<string>;
    isImportant: boolean;
    categoryId?: string;
    tags?: string[];
}

export interface SerializableHypaV3Summary extends Omit<HypaV3Summary, 'chatMemos'> {
    chatMemos: string[];
}

export interface SerializableHypaV3Data extends Omit<HypaV3Data, 'summaries'> {
    summaries: SerializableHypaV3Summary[];
}

export interface HypaV3Result {
    currentTokens: number;
    chats: OpenAIChat[];
    error?: string;
    memory?: SerializableHypaV3Data;
}
