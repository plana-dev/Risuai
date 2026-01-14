/**
 * Process 관련 타입 정의
 * 원본: src/ts/process/index.svelte.ts
 */

import type { Database, character, groupChat, Chat, Message, MessageGenerationInfo, MessagePresetInfo } from '../database';
import type { DatabaseAdapter } from '../database-adapter';
import type { AssetService } from '../asset-service';
import type { RedisService } from '../redis-service';
import type { LLMModel } from '../model/types';

/**
 * OpenAI 호환 채팅 메시지
 */
export interface OpenAIChat {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    memo?: string;
    name?: string;
    removable?: boolean;
    attr?: string[];
    multimodals?: MultiModal[];
    thoughts?: string[];
    cachePoint?: boolean;
}

/**
 * 멀티모달 데이터
 */
export interface MultiModal {
    type: 'image' | 'video' | 'audio';
    base64: string;
    height?: number;
    width?: number;
}

/**
 * OpenAI 호환 채팅 메시지 (전체 버전)
 */
export interface OpenAIChatFull extends OpenAIChat {
    function_call?: {
        name: string;
        arguments: string;
    };
    tool_calls?: {
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: 'function';
    }[];
}

/**
 * 요청 토큰 부분
 */
export interface RequestTokenPart {
    name: string;
    tokens: number;
}

/**
 * 스트림 응답 청크
 */
export interface StreamResponseChunk {
    [key: string]: string;
}

/**
 * 요청 데이터 인자
 */
export interface RequestDataArgument {
    formated: OpenAIChat[];
    bias: { [key: number]: number };
    biasString?: [string, number][];
    currentChar?: character;
    temperature?: number;
    maxTokens?: number;
    PresensePenalty?: number;
    frequencyPenalty?: number;
    useStreaming?: boolean;
    isGroupChat?: boolean;
    useEmotion?: boolean;
    continue?: boolean;
    chatId?: string;
    noMultiGen?: boolean;
    schema?: string;
    extractJson?: string;
    imageResponse?: boolean;
    previewBody?: boolean;
    staticModel?: string;
    escape?: boolean;
    tools?: any[]; // MCPTool 타입은 나중에 정의
    rememberToolUsage?: boolean;
}

/**
 * 확장된 요청 데이터 인자
 */
export interface RequestDataArgumentExtended extends RequestDataArgument {
    aiModel?: string;
    multiGen?: boolean;
    abortSignal?: AbortSignal;
    modelInfo?: LLMModel;
    customURL?: string;
    mode?: ModelModeExtended;
    key?: string;
    additionalOutput?: string;
}

/**
 * 요청 데이터 응답
 */
export type RequestDataResponse =
    | {
          type: 'success' | 'fail';
          result: string;
          noRetry?: boolean;
          special?: {
              emotion?: string;
          };
          failByServerError?: boolean;
          model?: string;
      }
    | {
          type: 'streaming';
          result: ReadableStream<StreamResponseChunk>;
          special?: {
              emotion?: string;
          };
          model?: string;
      }
    | {
          type: 'multiline';
          result: ['user' | 'char', string][];
          special?: {
              emotion?: string;
          };
          model?: string;
      };

/**
 * 모델 모드 확장
 */
export type ModelModeExtended = 'model' | 'submodel' | 'memory' | 'emotion' | 'otherAx' | 'translate';

/**
 * 파라미터 타입
 */
export type Parameter =
    | 'temperature'
    | 'top_k'
    | 'repetition_penalty'
    | 'min_p'
    | 'top_a'
    | 'top_p'
    | 'frequency_penalty'
    | 'presence_penalty'
    | 'reasoning_effort'
    | 'thinking_tokens'
    | 'verbosity';

/**
 * Process 컨텍스트
 * 서버 사이드에서 채팅 처리에 필요한 모든 컨텍스트 정보
 */
export interface ProcessContext {
    // 사용자 및 세션 정보
    userId: string;
    characterId: string;
    chatId: string;

    // 데이터베이스 및 서비스
    database: Database;
    databaseAdapter: DatabaseAdapter;
    assetService: AssetService;
    redisService: RedisService;

    // 현재 상태
    character: character | groupChat;
    chat: Chat;
    selectedCharIndex?: number;
    selectedChatIndex?: number;

    // 모델 정보
    modelInfo: LLMModel;

    // 추가 옵션
    options?: {
        chatAdditionalTokens?: number;
        continue?: boolean;
        usedContinueTokens?: number;
        preview?: boolean;
        previewPrompt?: boolean;
        signal?: AbortSignal;
    };
}

/**
 * 채팅 처리 단계
 */
export enum ChatProcessStage {
    Idle = 0,
    Preparing = 1,
    BuildingPrompt = 2,
    Requesting = 3,
    ProcessingResponse = 4,
    Completed = 5,
    Error = -1,
}

/**
 * 채팅 처리 결과
 */
export interface ChatProcessResult {
    success: boolean;
    message?: Message;
    error?: string;
    stageTiming?: {
        stage1: number;
        stage2: number;
        stage3: number;
        stage4: number;
    };
    generationInfo?: MessageGenerationInfo;
}

/**
 * 프롬프트 빌드 컨텍스트
 */
export interface PromptBuildContext {
    character: character | groupChat;
    chat: Chat;
    database: Database;
    modelInfo: LLMModel;
    tokenizer: any; // ChatTokenizer 타입
    selectedCharIndex?: number;
    selectedChatIndex?: number;
}
