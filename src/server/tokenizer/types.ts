/**
 * Tokenizer 타입 정의
 * 원본: src/ts/tokenizer.ts
 */

import type { Tiktoken } from "@dqbd/tiktoken";
import type { Tokenizer } from "@mlc-ai/web-tokenizers";
import type { GemmaTokenizer } from "@huggingface/transformers";
import type { Database, character, groupChat, Chat } from '../database';
import type { LLMModel } from '../model/types';

export type TokenizerType = 'novellist' | 'claude' | 'novelai' | 'llama' | 'mistral' | 'llama3' | 'gemma' | 'cohere' | 'googleCloud' | 'DeepSeek';

export type TokenizerResult = number[] | Uint32Array | Int32Array;

export interface TokenizerContext {
    userId: string;
    database: Database;
    modelInfo: LLMModel;
    customTokenizer?: string;
    currentPluginProvider?: string;
    googleClaudeTokenizing?: boolean;
    pluginTokenizer?: string;
    useTokenizerCaching?: boolean;
}

export interface TokenizerCache {
    get(key: string): TokenizerResult | undefined;
    set(key: string, value: TokenizerResult): void;
}

export interface TokenizerFileLoader {
    loadTokenFile(path: string): Promise<ArrayBuffer>;
}

export const tokenizerList = [
    ['tik', 'Tiktoken (OpenAI)'],
    ['mistral', 'Mistral'],
    ['novelai', 'NovelAI'],
    ['claude', 'Claude'],
    ['llama', 'Llama'],
    ['llama3', 'Llama3'],
    ['novellist', 'Novellist'],
    ['gemma', 'Gemma'],
    ['cohere', 'Cohere'],
    ['deepseek', 'DeepSeek'],
] as const;

// 전역 tokenizer 인스턴스 (서버 사이드에서는 싱글톤으로 관리)
export let tikParser: Tiktoken | null = null;
export let tokenizersTokenizer: Tokenizer | null = null;
export let tokenizersType: TokenizerType | null = null;
export let lastTikModel = 'cl100k_base';
export let gemmaTokenizer: GemmaTokenizer | null = null;
