/**
 * Chat 처리 관련 타입 정의
 * 원본: src/ts/process/index.svelte.ts
 */

import type { OpenAIChat, MultiModal } from '../types';
import type { character, Chat, MessageGenerationInfo, MessagePresetInfo } from '../../database';

/**
 * sendChat 함수 인자
 */
export interface SendChatArg {
    chatAdditonalTokens?: number;
    signal?: AbortSignal;
    continue?: boolean;
    usedContinueTokens?: number;
    preview?: boolean;
    previewPrompt?: boolean;
}

/**
 * sendChat 함수 결과
 */
export interface SendChatResult {
    success: boolean;
    error?: string;
    generationInfo?: MessageGenerationInfo;
    previewFormated?: OpenAIChat[];
    previewBody?: string;
    resendChat?: boolean;
    emoChanged?: boolean;
}

/**
 * 프롬프트 구성 요소
 */
export interface UnformatedPrompts {
    main: OpenAIChat[];
    jailbreak: OpenAIChat[];
    chats: OpenAIChat[];
    lorebook: OpenAIChat[];
    globalNote: OpenAIChat[];
    authorNote: OpenAIChat[];
    lastChat: OpenAIChat[];
    description: OpenAIChat[];
    postEverything: OpenAIChat[];
    personaPrompt: OpenAIChat[];
}

/**
 * 스테이지 타이밍
 */
export interface StageTimings {
    stage1Start: number;
    stage2Start: number;
    stage3Start: number;
    stage4Start: number;
    stage1Duration: number;
    stage2Duration: number;
    stage3Duration: number;
    stage4Duration: number;
}
