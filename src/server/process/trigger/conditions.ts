/**
 * 트리거 조건 체크 로직
 * 원본: src/ts/process/triggers.ts
 */

import type { triggerCondition } from './types';
import type { character, Chat } from '../../database';
import { risuChatParser } from '../../../ts/parser.svelte';

/**
 * 조건 체크 컨텍스트
 */
export interface ConditionCheckContext {
    char: character;
    chat: Chat;
    getVar: (key: string) => string;
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

        const conditionValue = risuChatParser(condition.value, { chara: char });
        varValue = risuChatParser(varValue, { chara: char });

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
        const conditionValue = risuChatParser(condition.value, { chara: char });
        const val = risuChatParser(conditionValue, { chara: char });
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
