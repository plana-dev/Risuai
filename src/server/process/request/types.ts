/**
 * Request 관련 타입 정의
 * 원본: src/ts/process/request/request.ts
 */

import type { OpenAIChat, MultiModal, ModelModeExtended } from '../types';

export type { ModelModeExtended };
import type { character } from '../../database';
import type { LLMModel } from '../../model/types';

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
 * 파라미터 맵
 */
export type ParameterMap = {
    [key in Parameter]?: string;
};

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
 * 스트림 응답 청크
 */
export interface StreamResponseChunk {
    [key: string]: string;
}

/**
 * OpenAI 추가 컨텐츠 타입
 */
export type OpenAIContents =
    | string
    | Array<{
          type: 'text';
          text: string;
      } | {
          type: 'image_url';
          image_url: {
              url: string;
              detail?: 'low' | 'high' | 'auto';
          };
      }>;

/**
 * OpenAI 추가 채팅 타입
 */
export interface OpenAIChatExtra {
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
    content?: OpenAIContents;
    name?: string;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}

/**
 * OpenAI 툴 콜
 */
export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
