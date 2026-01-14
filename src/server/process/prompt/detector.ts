/**
 * 프롬프트 JSON 타입 감지
 * 원본: src/ts/process/prompt.ts
 */

import type { PromptJSONType } from './types';

/**
 * 프롬프트 JSON 타입 감지
 */
export function detectPromptJSONType(text: string): PromptJSONType {
    function notNull<T>(x: T | null): x is T {
        return x !== null && x !== undefined;
    }

    try {
        const parsed = JSON.parse(text);
        if (
            notNull(parsed.chat_completion_source) &&
            Array.isArray(parsed.prompts) &&
            Array.isArray(parsed.prompt_order)
        ) {
            return 'STCHAT';
        } else if (notNull(parsed.temp) && notNull(parsed.rep_pen) && notNull(parsed.min_length)) {
            return 'PARAMETERS';
        } else if (notNull(parsed.story_string) && notNull(parsed.chat_start)) {
            return 'STCONTEXT';
        } else if (notNull(parsed.input_sequence) && notNull(parsed.output_sequence)) {
            return 'STINST';
        }
    } catch (e) {
        // JSON 파싱 실패
    }
    return 'NOTSUPPORTED';
}
