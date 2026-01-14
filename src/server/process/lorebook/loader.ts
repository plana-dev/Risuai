/**
 * Lorebook 로드 로직
 * 원본: src/ts/process/lorebook.svelte.ts의 loadLoreBookV3Prompt 함수
 */

import type { character, groupChat, Chat, Message, loreBook, Database } from '../../database';
import type { LorebookLoadResult, ActiveLorebookItem, RecursivePrompt, MatchLog } from './types';
import { searchMatch } from './matcher';
import { parseLorebookDecorators, type DecoratorParseContext } from './decorator';
import { tokenize } from '../../tokenizer';
import type { TokenizerContext } from '../../tokenizer';
import { pickHashRand } from '../../util';

/**
 * Lorebook 로드 컨텍스트
 */
export interface LorebookLoadContext {
    character: character | groupChat;
    chat: Chat;
    database: Database;
    tokenizerContext: TokenizerContext;
    getChatVar: (key: string) => string;
    setChatVar: (key: string, value: string) => void;
    findCharacterbyId: (id: string) => { name: string } | null;
    getModuleLorebooks?: () => loreBook[];
}

/**
 * Lorebook V3 프롬프트 로드
 */
export async function loadLoreBookV3Prompt(
    context: LorebookLoadContext
): Promise<LorebookLoadResult> {
    const { character, chat, database, tokenizerContext } = context;
    const characterLore = character.globalLore ?? [];
    const chatLore = chat.localLore ?? [];
    const moduleLorebook = context.getModuleLorebooks ? context.getModuleLorebooks() : [];
    const fullLore = JSON.parse(JSON.stringify(characterLore.concat(chatLore).concat(moduleLorebook))); // safeStructuredClone 대체
    const currentChat = chat.message;
    const loreDepth = character.loreSettings?.scanDepth ?? database.loreBookDepth;
    const loreToken = character.loreSettings?.tokenBudget ?? database.loreBookToken;
    const fullWordMatchingSetting = character.loreSettings?.fullWordMatching ?? false;
    const chatLength = currentChat.length + 1; // includes first message
    const recursiveScanning = character.loreSettings?.recursiveScanning ?? true;

    let recursivePrompt: RecursivePrompt[] = [];
    let matchLog: MatchLog[] = [];

    const decoratorContext: DecoratorParseContext = {
        chatLength,
        fmIndex: chat.fmIndex,
        getChatVar: context.getChatVar,
        setChatVar: context.setChatVar,
        pickHashRand,
    };

    let matching = true;
    let actives: ActiveLorebookItem[] = [];
    let activatedIndexes: number[] = [];
    let disabledUIPrompts: string[] = [];
    let matchTimes = 0;
    let keepActivateAfterMatch = false;
    let dontActivateAfterMatch = false;

    while (matching) {
        matching = false;
        for (let i = 0; i < fullLore.length; i++) {
            if (activatedIndexes.includes(i)) {
                continue;
            }
            if (!fullLore[i].alwaysActive && !fullLore[i].key) {
                continue;
            }

            let activated = true;
            let pos = '';
            let inject: {
                operation: 'append' | 'prepend' | 'replace';
                location: string;
                param: string;
                lore: boolean;
            } | null = null;
            let depth = 0;
            let scanDepth = loreDepth;
            let order = fullLore[i].insertorder;
            let priority = fullLore[i].insertorder;
            let forceState: 'none' | 'activate' | 'deactivate' = 'none';
            let role: 'system' | 'user' | 'assistant' = 'system';
            let searchQueries: Array<{
                keys: string[];
                negative: boolean;
                all?: boolean;
            }> = [];
            let fullWordMatching = fullWordMatchingSetting;
            let dontSearchWhenRecursive = false;

            // Child mode 처리
            if (fullLore[i].mode === 'child') {
                activated = false;
                for (let j = 0; j < i; j++) {
                    if (fullLore[j].id === fullLore[i].id) {
                        if (!activatedIndexes.includes(j)) {
                            fullLore[i].comment = fullLore[j].comment;
                            fullLore[i].content = fullLore[j].content;
                            fullLore[i].alwaysActive = true;
                            activated = true;
                        }
                        break;
                    }
                }
            }

            let itemRecursive: 'global' | true | false = 'global';

            // 데코레이터 파싱
            const parseResult = parseLorebookDecorators(fullLore[i], decoratorContext);
            const content = parseResult.content;
            activated = parseResult.activated && activated;
            pos = parseResult.pos || pos;
            depth = parseResult.depth || depth;
            scanDepth = parseResult.scanDepth || scanDepth;
            order = parseResult.order || order;
            priority = parseResult.priority || priority;
            role = parseResult.role || role;
            searchQueries = parseResult.searchQueries || searchQueries;
            fullWordMatching = parseResult.fullWordMatching !== undefined ? parseResult.fullWordMatching : fullWordMatching;
            dontSearchWhenRecursive = parseResult.dontSearchWhenRecursive || dontSearchWhenRecursive;
            itemRecursive = parseResult.itemRecursive || itemRecursive;
            forceState = parseResult.forceState || forceState;
            inject = parseResult.inject || inject;
            disabledUIPrompts.push(...parseResult.disabledUIPrompts);
            keepActivateAfterMatch = parseResult.keepActivateAfterMatch || keepActivateAfterMatch;
            dontActivateAfterMatch = parseResult.dontActivateAfterMatch || dontActivateAfterMatch;

            if (!activated || forceState !== 'none' || fullLore[i].alwaysActive) {
                // if the lore is not activated or force activated, skip the search
            } else {
                searchQueries.push({
                    keys: fullLore[i].key.split(','),
                    negative: false,
                });

                if (fullLore[i].secondkey && fullLore[i].selective) {
                    searchQueries.push({
                        keys: fullLore[i].secondkey.split(','),
                        negative: false,
                    });
                }

                for (const query of searchQueries) {
                    const result = searchMatch(
                        currentChat,
                        {
                            keys: query.keys,
                            searchDepth: scanDepth,
                            regex: fullLore[i].useRegex ?? false,
                            fullWordMatching: fullWordMatching,
                            all: query.all,
                            dontSearchWhenRecursive: dontSearchWhenRecursive,
                        },
                        {
                            username: database.username,
                            findCharacterbyId: context.findCharacterbyId,
                            currentCharName: character.name,
                            recursivePrompt: recursivePrompt,
                        },
                        matchLog
                    );

                    if (query.negative) {
                        if (result) {
                            activated = false;
                            break;
                        }
                    } else {
                        if (!result) {
                            activated = false;
                            break;
                        }
                    }
                }
            }

            if (forceState === 'activate') {
                activated = true;
            } else if (forceState === 'deactivate') {
                activated = false;
            }

            if (activated) {
                const tokens = await tokenize(content, tokenizerContext);
                actives.push({
                    depth: depth,
                    pos: pos,
                    prompt: content,
                    role: role,
                    order: order,
                    tokens: tokens,
                    priority: priority,
                    source: fullLore[i].comment || `lorebook ${i}`,
                    inject: inject ?? null,
                });
                activatedIndexes.push(i);

                const loreId = fullLore[i].id ?? pickHashRand(5555, fullLore[i].content).toString();
                if (keepActivateAfterMatch) {
                    context.setChatVar('__internal_ka_' + loreId, 'true');
                }
                if (dontActivateAfterMatch) {
                    context.setChatVar('__internal_da_' + loreId, 'true');
                }

                let recursive = recursiveScanning;
                if (itemRecursive !== 'global') {
                    recursive = itemRecursive === true;
                }

                if (recursive) {
                    matching = true;
                    recursivePrompt.push({
                        prompt: content,
                        data: content,
                        source: fullLore[i].comment || `lorebook ${i}`,
                    });
                }
            }
        }
    }

    // 우선순위로 정렬
    const activesSorted = actives.sort((a, b) => {
        return b.priority - a.priority;
    });

    // 토큰 예산에 맞게 필터링
    let usedTokens = 0;
    const activesFiltered = activesSorted.filter(act => {
        if (usedTokens + act.tokens <= loreToken) {
            usedTokens += act.tokens;
            return true;
        }
        return false;
    });

    // Order로 재정렬
    let activesResorted = activesFiltered.sort((a, b) => {
        return b.order - a.order;
    });

    // Lore injection 처리
    const loreinjectionLores = activesResorted.filter(act => {
        return act?.inject?.lore;
    });

    activesResorted = activesResorted.filter(act => {
        return !act?.inject?.lore;
    });

    for (const lore of loreinjectionLores) {
        const foundLoreIndex = activesResorted.findIndex(l => {
            return l.source === lore.inject?.location;
        });
        if (foundLoreIndex !== -1) {
            const foundLore = activesResorted[foundLoreIndex];
            switch (lore.inject?.operation) {
                case 'append': {
                    foundLore.prompt += ' ' + lore.prompt;
                    break;
                }
                case 'prepend': {
                    foundLore.prompt = lore.prompt + ' ' + foundLore.prompt;
                    break;
                }
                case 'replace': {
                    foundLore.prompt = foundLore.prompt.replace(lore.inject.param, lore.prompt);
                    break;
                }
            }
        }
    }

    return {
        actives: activesResorted.reverse(),
        matchLog: matchLog,
        disabledUIPrompts: disabledUIPrompts.length > 0 ? disabledUIPrompts : undefined,
    };
}
