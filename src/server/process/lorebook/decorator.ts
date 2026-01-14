/**
 * Lorebook 데코레이터 파싱
 * 원본: src/ts/process/lorebook.svelte.ts의 CCardLib.decorator.parse 사용 부분
 */

import { CCardLib } from '@risuai/ccardlib';
import type { loreBook } from '../../database';
import type { SearchQuery, ActiveLorebookItem } from './types';

/**
 * 데코레이터 파싱 컨텍스트
 */
export interface DecoratorParseContext {
    chatLength: number;
    fmIndex?: number;
    getChatVar: (key: string) => string;
    setChatVar: (key: string, value: string) => void;
    pickHashRand: (seed: number, text: string) => number;
}

/**
 * 데코레이터 파싱 결과
 */
export interface DecoratorParseResult {
    content: string;
    activated: boolean;
    pos: string;
    depth: number;
    scanDepth: number;
    order: number;
    priority: number;
    role: 'system' | 'user' | 'assistant';
    searchQueries: SearchQuery[];
    fullWordMatching: boolean;
    dontSearchWhenRecursive: boolean;
    itemRecursive: 'global' | true | false;
    forceState: 'none' | 'activate' | 'deactivate';
    inject: {
        operation: 'append' | 'prepend' | 'replace';
        location: string;
        param: string;
        lore: boolean;
    } | null;
    disabledUIPrompts: string[];
    keepActivateAfterMatch: boolean;
    dontActivateAfterMatch: boolean;
}

/**
 * Lorebook 항목의 데코레이터 파싱
 */
export function parseLorebookDecorators(
    lore: loreBook,
    context: DecoratorParseContext
): DecoratorParseResult {
    let activated = true;
    let pos = '';
    let depth = 0;
    let scanDepth = context.chatLength; // 기본값은 나중에 설정됨
    let order = lore.insertorder;
    let priority = lore.insertorder;
    let forceState: 'none' | 'activate' | 'deactivate' = 'none';
    let role: 'system' | 'user' | 'assistant' = 'system';
    let searchQueries: SearchQuery[] = [];
    let fullWordMatching = false;
    let dontSearchWhenRecursive = false;
    let itemRecursive: 'global' | true | false = 'global';
    let inject: {
        operation: 'append' | 'prepend' | 'replace';
        location: string;
        param: string;
        lore: boolean;
    } | null = null;
    let disabledUIPrompts: string[] = [];
    let keepActivateAfterMatch = false;
    let dontActivateAfterMatch = false;

    const content = CCardLib.decorator.parse(lore.content, (name, arg) => {
        switch (name) {
            case 'end': {
                pos = 'depth';
                depth = 0;
                return;
            }
            case 'activate_only_after': {
                const int = parseInt(arg[0]);
                if (Number.isNaN(int)) {
                    return false;
                }
                if (context.chatLength < int) {
                    activated = false;
                }
                return;
            }
            case 'activate_only_every': {
                const int = parseInt(arg[0]);
                if (Number.isNaN(int)) {
                    return false;
                }
                if (context.chatLength % int !== 0) {
                    activated = false;
                }
                return;
            }
            case 'keep_activate_after_match': {
                const loreId = lore.id ?? context.pickHashRand(5555, lore.content).toString();
                const vara = context.getChatVar('__internal_ka_' + loreId);
                if (vara === 'true') {
                    forceState = 'activate';
                } else {
                    keepActivateAfterMatch = true;
                }
                return false;
            }
            case 'dont_activate_after_match': {
                const loreId = lore.id ?? context.pickHashRand(5555, lore.content).toString();
                const vara = context.getChatVar('__internal_da_' + loreId);
                if (vara === 'true') {
                    forceState = 'deactivate';
                } else {
                    dontActivateAfterMatch = true;
                }
                return false;
            }
            case 'depth':
            case 'reverse_depth': {
                const int = parseInt(arg[0]);
                if (Number.isNaN(int)) {
                    return false;
                }
                depth = int;
                pos = name === 'depth' ? 'depth' : 'reverse_depth';
                return;
            }
            case 'instruct_depth':
            case 'reverse_instruct_depth':
            case 'instruct_scan_depth': {
                // the instruct mode does not exists in risu
                return false;
            }
            case 'role': {
                if (arg[0] === 'user' || arg[0] === 'assistant' || arg[0] === 'system') {
                    role = arg[0];
                    return;
                }
                return false;
            }
            case 'scan_depth': {
                scanDepth = parseInt(arg[0]);
                return;
            }
            case 'is_greeting': {
                const int = parseInt(arg[0]);
                if (Number.isNaN(int)) {
                    return false;
                }
                if ((context.fmIndex ?? -1) + 1 !== int) {
                    activated = false;
                }
                return;
            }
            case 'position': {
                if (arg[0].startsWith('pt_') || ['after_desc', 'before_desc', 'personality', 'scenario'].includes(arg[0])) {
                    pos = arg[0];
                    return;
                }
                return false;
            }
            case 'inject_lore': {
                inject ??= {
                    operation: 'append',
                    location: '',
                    param: '',
                    lore: true,
                };
                inject.location = arg.join(' ');
                inject.lore = true;
                return;
            }
            case 'inject_at': {
                inject ??= {
                    operation: 'append',
                    location: '',
                    param: '',
                    lore: false,
                };
                inject.location = arg.join(' ');
                inject.lore = false;
                return;
            }
            case 'inject_replace': {
                inject ??= {
                    operation: 'replace',
                    location: '',
                    param: '',
                    lore: false,
                };
                inject.operation = 'replace';
                inject.param = arg.join(' ');
                return;
            }
            case 'inject_prepend': {
                inject ??= {
                    operation: 'prepend',
                    location: '',
                    param: '',
                    lore: false,
                };
                inject.operation = 'prepend';
                inject.param = arg.join(' ');
                return;
            }
            case 'ignore_on_max_context': {
                priority = -1000;
                return;
            }
            case 'additional_keys': {
                searchQueries.push({
                    keys: arg,
                    negative: false,
                });
                return;
            }
            case 'exclude_keys': {
                searchQueries.push({
                    keys: arg,
                    negative: true,
                });
                return;
            }
            case 'exclude_keys_all': {
                searchQueries.push({
                    keys: arg,
                    negative: true,
                    all: true,
                });
                return;
            }
            case 'match_full_word': {
                fullWordMatching = true;
                return;
            }
            case 'match_partial_word': {
                fullWordMatching = false;
                return;
            }
            case 'is_user_icon': {
                // TODO
                return false;
            }
            case 'activate': {
                forceState = 'activate';
                return;
            }
            case 'dont_activate': {
                forceState = 'deactivate';
                return;
            }
            case 'disable_ui_prompt': {
                if (['post_history_instructions', 'system_prompt'].includes(arg[0])) {
                    disabledUIPrompts.push(arg[0]);
                    return;
                }
                return false;
            }
            case 'probability': {
                if (Math.random() * 100 > parseInt(arg[0])) {
                    activated = false;
                }
                return;
            }
            case 'priority': {
                priority = parseInt(arg[0]);
                return;
            }
            case 'unrecursive': {
                itemRecursive = false;
                return;
            }
            case 'recursive': {
                itemRecursive = true;
                return;
            }
            case 'no_recursive_search': {
                dontSearchWhenRecursive = true;
                return;
            }
            default: {
                return false;
            }
        }
    });

    return {
        content,
        activated,
        pos,
        depth,
        scanDepth,
        order,
        priority,
        role,
        searchQueries,
        fullWordMatching,
        dontSearchWhenRecursive,
        itemRecursive,
        forceState,
        inject,
        disabledUIPrompts,
        keepActivateAfterMatch,
        dontActivateAfterMatch,
    };
}
