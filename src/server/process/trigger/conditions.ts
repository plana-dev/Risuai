/**
 * 트리거 조건 체크 로직
 * 원본: src/ts/process/triggers.ts
 */

import type { triggerCondition } from './types';
import type { character, Chat, Database } from '../../database';
import { risuChatParser } from '../../parser';
import type { RisuChatParserContext } from '../../parser/cbs-parser';
import type { MatcherContext } from '../../parser/cbs-matcher';
import type { BlockMatcherContext } from '../../parser/cbs-blocks';

/**
 * 조건 체크 컨텍스트
 */
export interface ConditionCheckContext {
    char: character;
    chat: Chat;
    getVar: (key: string) => string;
    database?: Database; // Parser contexts 생성을 위해 추가
    parserContexts?: {
        parser: RisuChatParserContext;
        matcher: MatcherContext;
        block: BlockMatcherContext;
    };
}

/**
 * 트리거 조건 체크
 */
export function checkTriggerCondition(
    condition: triggerCondition,
    context: ConditionCheckContext
): boolean {
    const { char, chat, getVar } = context;

    if (condition.type === 'var' || condition.type === 'chatindex' || condition.type === 'value') {
        let varValue: string | null =
            condition.type === 'var'
                ? getVar(condition.var) ?? 'null'
                : condition.type === 'chatindex'
                  ? chat.message.length.toString()
                  : condition.type === 'value'
                    ? condition.var
                    : null;

        if (varValue === undefined || varValue === null) {
            return false;
        }

        const parserContexts = context.parserContexts;
        const conditionValue = parserContexts 
            ? risuChatParser(condition.value, { chara: char }, parserContexts)
            : risuChatParser(condition.value, { chara: char }); // Fallback: contexts 없으면 기본 파싱
        varValue = parserContexts
            ? risuChatParser(varValue, { chara: char }, parserContexts)
            : risuChatParser(varValue, { chara: char }); // Fallback

        switch (condition.operator) {
            case 'true': {
                if (varValue !== 'true' && varValue !== '1') {
                    return false;
                }
                break;
            }
            case '=':
                if (varValue !== conditionValue) {
                    return false;
                }
                break;
            case '!=':
                if (varValue === conditionValue) {
                    return false;
                }
                break;
            case '>':
                if (Number(varValue) <= Number(conditionValue)) {
                    return false;
                }
                break;
            case '<':
                if (Number(varValue) >= Number(conditionValue)) {
                    return false;
                }
                break;
            case '>=':
                if (Number(varValue) < Number(conditionValue)) {
                    return false;
                }
                break;
            case '<=':
                if (Number(varValue) > Number(conditionValue)) {
                    return false;
                }
                break;
            case 'null':
                if (varValue !== 'null') {
                    return false;
                }
                break;
        }
        return true;
    } else if (condition.type === 'exists') {
        const parserContexts = context.parserContexts;
        const conditionValue = parserContexts
            ? risuChatParser(condition.value, { chara: char }, parserContexts)
            : risuChatParser(condition.value, { chara: char }); // Fallback
        const val = parserContexts
            ? risuChatParser(conditionValue, { chara: char }, parserContexts)
            : risuChatParser(conditionValue, { chara: char }); // Fallback
        let da = chat.message.slice(0 - condition.depth).map(v => v.data).join(' ');

        if (condition.type2 === 'strict') {
            return da.split(' ').includes(val);
        } else if (condition.type2 === 'loose') {
            return da.toLowerCase().includes(val.toLowerCase());
        } else if (condition.type2 === 'regex') {
            try {
                return new RegExp(val).test(da);
            } catch (error) {
                return false;
            }
        }
    }

    return false;
}

/**
 * 모든 조건 체크
 */
export function checkAllConditions(
    conditions: triggerCondition[],
    context: ConditionCheckContext
): boolean {
    for (const condition of conditions) {
        if (!checkTriggerCondition(condition, context)) {
            return false;
        }
    }
    return true;
}
