/**
 * ChatML 파서
 * 원본: src/ts/parser/chatML.ts
 */

import { risuChatParser } from './cbs-parser';
import type { OpenAIChat } from '../process/types';
import type { RisuChatParserContext } from './cbs-parser';
import type { MatcherContext } from './cbs-matcher';
import type { BlockMatcherContext } from './cbs-blocks';

/**
 * ChatML 형식 파싱
 * @param data - ChatML 형식 문자열
 * @param contexts - Parser contexts (선택적, 없으면 기본값 사용)
 */
export function parseChatML(
    data: string,
    contexts?: {
        parser: RisuChatParserContext;
        matcher: MatcherContext;
        block: BlockMatcherContext;
    }
): OpenAIChat[] | null {
    const starter = '<|im_start|>';
    const seperator = '<|im_sep|>';
    const ender = '<|im_end|>';

    const trimedData = data.trim();
    if (!trimedData.startsWith(starter)) {
        return null;
    }

    return trimedData
        .split(starter)
        .filter((f) => f !== '')
        .map((v) => {
            let role: 'system' | 'user' | 'assistant' = 'user';
            // default separators
            if (v.startsWith('user' + seperator)) {
                role = 'user';
                v = v.substring(4 + seperator.length);
            } else if (v.startsWith('system' + seperator)) {
                role = 'system';
                v = v.substring(6 + seperator.length);
            } else if (v.startsWith('assistant' + seperator)) {
                role = 'assistant';
                v = v.substring(9 + seperator.length);
            }
            // space/newline separators
            else if (v.startsWith('user ') || v.startsWith('user\n')) {
                role = 'user';
                v = v.substring(5);
            } else if (v.startsWith('system ') || v.startsWith('system\n')) {
                role = 'system';
                v = v.substring(7);
            } else if (v.startsWith('assistant ') || v.startsWith('assistant\n')) {
                role = 'assistant';
                v = v.substring(10);
            }

            v = v.trim();

            if (v.endsWith(ender)) {
                v = v.substring(0, v.length - ender.length);
            }

            let thoughts: string[] = [];
            v = v.replace(/<Thoughts>(.+)<\/Thoughts>/gms, (_, p1) => {
                thoughts.push(p1);
                return '';
            });

            return {
                role: role,
                content: contexts ? risuChatParser(v, {}, contexts) : v, // contexts가 없으면 파싱하지 않음
                thoughts: thoughts,
            } as OpenAIChat;
        });
}
