/**
 * Prompt 관련 타입 정의
 * 원본: src/ts/process/prompt.ts
 */

/**
 * 프롬프트 아이템 타입
 */
export type PromptItem =
    | PromptItemPlain
    | PromptItemTyped
    | PromptItemChat
    | PromptItemAuthorNote
    | PromptItemChatML
    | PromptItemCache;

export type PromptType = PromptItem['type'];

/**
 * 프롬프트 설정
 */
export interface PromptSettings {
    assistantPrefill: string;
    postEndInnerFormat: string;
    sendChatAsSystem: boolean;
    sendName: boolean;
    utilOverride: boolean;
    customChainOfThought?: boolean;
    maxThoughtTagDepth?: number;
    trimStartNewChat?: boolean;
}

/**
 * 일반 프롬프트 아이템
 */
export interface PromptItemPlain {
    type: 'plain' | 'jailbreak' | 'cot';
    type2: 'normal' | 'globalNote' | 'main';
    text: string;
    role: 'user' | 'bot' | 'system';
    name?: string;
}

/**
 * ChatML 프롬프트 아이템
 */
export interface PromptItemChatML {
    type: 'chatML';
    text: string;
    name?: string;
}

/**
 * 타입화된 프롬프트 아이템
 */
export interface PromptItemTyped {
    type: 'persona' | 'description' | 'lorebook' | 'postEverything' | 'memory';
    innerFormat?: string;
    name?: string;
}

/**
 * Author Note 프롬프트 아이템
 */
export interface PromptItemAuthorNote {
    type: 'authornote';
    innerFormat?: string;
    defaultText?: string;
    name?: string;
}

/**
 * 채팅 프롬프트 아이템
 */
export interface PromptItemChat {
    type: 'chat';
    rangeStart: number;
    rangeEnd: number | 'end';
    chatAsOriginalOnSystem?: boolean;
    name?: string;
}

/**
 * 캐시 프롬프트 아이템
 */
export interface PromptItemCache {
    type: 'cache';
    name: string;
    depth: number;
    role: 'user' | 'assistant' | 'system' | 'all';
}

/**
 * Ooba 파라미터 목록
 */
export const OobaParams = [
    'tokenizer',
    'min_p',
    'top_k',
    'repetition_penalty',
    'repetition_penalty_range',
    'typical_p',
    'tfs',
    'top_a',
    'epsilon_cutoff',
    'eta_cutoff',
    'guidance_scale',
    'negative_prompt',
    'penalty_alpha',
    'mirostat_mode',
    'mirostat_tau',
    'mirostat_eta',
    'temperature_last',
    'do_sample',
    'seed',
    'encoder_repetition_penalty',
    'no_repeat_ngram_size',
    'min_length',
    'num_beams',
    'length_penalty',
    'early_stopping',
    'truncation_length',
    'max_tokens_second',
    'custom_token_bans',
    'auto_max_new_tokens',
    'ban_eos_token',
    'add_bos_token',
    'skip_special_tokens',
    'grammar_string',
] as const;

/**
 * JSON 타입 우선순위
 */
export const typePriority = ['STINST', 'PARAMETERS', 'STCONTEXT', 'STCHAT'] as const;

/**
 * JSON 타입
 */
export type PromptJSONType = 'STINST' | 'PARAMETERS' | 'STCONTEXT' | 'STCHAT' | 'NOTSUPPORTED';

/**
 * Inst 데이터 타입
 */
export interface InstData {
    system_prompt: string;
    input_sequence: string;
    output_sequence: string;
    last_output_sequence: string;
    system_sequence: string;
    stop_sequence: string;
    system_sequence_prefix: string;
    system_sequence_suffix: string;
    first_output_sequence: string;
    output_suffix: string;
    input_suffix: string;
    system_suffix: string;
    user_alignment_message: string;
    system_same_as_user: boolean;
    last_system_sequence: string;
    first_input_sequence: string;
    last_input_sequence: string;
    name: string;
}
