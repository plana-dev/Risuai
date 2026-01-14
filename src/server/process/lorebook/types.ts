/**
 * Lorebook 관련 타입 정의
 * 원본: src/ts/process/lorebook.svelte.ts
 */

import type { loreBook, Message } from '../../database';

/**
 * 활성화된 Lorebook 항목
 */
export interface ActiveLorebookItem {
    depth: number;
    pos: string;
    prompt: string;
    role: 'system' | 'user' | 'assistant';
    order: number;
    tokens: number;
    priority: number;
    source: string;
    inject: {
        operation: 'append' | 'prepend' | 'replace';
        location: string;
        param: string;
        lore: boolean;
    } | null;
}

/**
 * 매칭 로그
 */
export interface MatchLog {
    prompt: string;
    source: string;
    activated: string;
}

/**
 * Lorebook 로드 결과
 */
export interface LorebookLoadResult {
    actives: ActiveLorebookItem[];
    matchLog: MatchLog[];
    disabledUIPrompts?: string[];
}

/**
 * 검색 매칭 인자
 */
export interface SearchMatchArg {
    keys: string[];
    searchDepth: number;
    regex: boolean;
    fullWordMatching: boolean;
    all?: boolean;
    dontSearchWhenRecursive: boolean;
}

/**
 * 외부 Lorebook 형식 (Character Card Library)
 */
export interface CCLorebook {
    key?: string[];
    comment?: string;
    content?: string;
    order?: number;
    constant?: boolean;
    name?: string;
    keywords?: string[];
    priority?: number;
    entry?: string;
    secondary_keys?: string[];
    selective?: boolean;
    forceActivation?: boolean;
    keys?: string[];
    displayName?: string;
    text?: string;
    contextConfig?: {
        budgetPriority: number;
        prefix: string;
        suffix: string;
    };
}

/**
 * 재귀 프롬프트
 */
export interface RecursivePrompt {
    prompt: string;
    source: string;
    data: string;
}

/**
 * 검색 쿼리
 */
export interface SearchQuery {
    keys: string[];
    negative: boolean;
    all?: boolean;
}
