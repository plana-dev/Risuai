/**
 * ProcessContext에서 Parser Contexts 생성
 * risuChatParser를 사용하기 위한 contexts 생성
 */

import type { ProcessContext } from './types';
import type { RisuChatParserContext } from '../../parser/cbs-parser';
import type { MatcherContext as CBSMatcherContext } from '../../parser/cbs-matcher';
import type { BlockMatcherContext as CBSBlockMatcherContext } from '../../parser/cbs-blocks';
import { calcString } from '../../util/string';
import { getMatcherMap, initMatcher, registerCBS, type CBSRegisterArg } from '../../cbs';
import { getPersonaPrompt, getUserName } from '../../util/database';
import { risuChatParser } from '../../parser';
import { getModelInfo } from '../../model/modellist-server';
import type { Database } from '../../database';

// CBS 초기화 상태 추적 (프로세스별로 한 번만 초기화)
const cbsInitialized = new Set<string>();

/**
 * ProcessContext에서 Parser Contexts 생성
 */
export function createParserContexts(context: ProcessContext): {
    parser: RisuChatParserContext;
    matcher: CBSMatcherContext;
    block: CBSBlockMatcherContext;
} {
    // Parser Context
    const parserContext: RisuChatParserContext = {
        getDatabase: () => context.database,
        getSelectedCharID: () => context.selectedCharIndex ?? 0,
        findCharacterbyId: (id: string) => context.findCharacterbyId(id),
    };

    // CBS Register Arg 생성
    const cbsRegisterArg: CBSRegisterArg = {
        registerFunction: () => {
            // registerCBS에서 처리됨
        },
        getDatabase: () => context.database,
        getUserName: () => context.getUserName(),
        getPersonaPrompt: () => context.getPersonaPrompt(),
        risuChatParser: (text: string, arg: any) => {
            return risuChatParser(text, arg, {
                parser: parserContext,
                matcher: matcherContext,
                block: blockContext,
            });
        },
        makeArray: (arr: unknown[]) => JSON.stringify(arr),
        safeStructuredClone: <T>(obj: T) => JSON.parse(JSON.stringify(obj)),
        parseArray: (str: string) => {
            try {
                return JSON.parse(str);
            } catch {
                return [];
            }
        },
        parseDict: (str: string) => {
            try {
                return JSON.parse(str);
            } catch {
                return {};
            }
        },
        getChatVar: (key: string) => {
            const chat = context.chat;
            if (chat && chat.scriptstate && chat.scriptstate['$' + key]) {
                return chat.scriptstate['$' + key];
            }
            return '';
        },
        setChatVar: (key: string, value: string) => {
            const chat = context.chat;
            if (chat) {
                chat.scriptstate = chat.scriptstate ?? {};
                chat.scriptstate['$' + key] = value;
            }
        },
        getGlobalChatVar: (key: string) => {
            const database = context.database;
            if (database.globalVars && database.globalVars[key]) {
                return database.globalVars[key];
            }
            return '';
        },
        calcString: (str: string) => {
            return calcString(
                str,
                (key: string) => {
                    const chat = context.chat;
                    if (chat && chat.scriptstate && chat.scriptstate['$' + key]) {
                        return chat.scriptstate['$' + key];
                    }
                    return '0';
                },
                (key: string) => {
                    const database = context.database;
                    if (database.globalVars && database.globalVars[key]) {
                        return database.globalVars[key];
                    }
                    return '0';
                }
            );
        },
        dateTimeFormat: (format: string, timestamp?: number) => {
            const date = timestamp ? new Date(timestamp * 1000) : new Date();
            // 간단한 포맷팅 (원본과 동일하게 구현 필요)
            return date.toISOString();
        },
        getModules: () => {
            return context.database.modules ?? [];
        },
        getModuleLorebooks: () => {
            // TODO: 모듈 로어북 가져오기
            return [];
        },
        pickHashRand: (seed: number, hash: string) => {
            // 간단한 해시 기반 랜덤
            let hashValue = 0;
            for (let i = 0; i < hash.length; i++) {
                hashValue = ((hashValue << 5) - hashValue) + hash.charCodeAt(i);
                hashValue = hashValue & hashValue;
            }
            return ((hashValue + seed) % 100) / 100;
        },
        getSelectedCharID: () => context.selectedCharIndex ?? 0,
        getModelInfo: async (model: string) => {
            return await getModelInfo(model, context.userId);
        },
        callInternalFunction: (args: string[]) => {
            return '';
        },
        isTauri: false,
        isNodeServer: true,
        isMobile: false,
        appVer: '1.0.0', // TODO: 실제 버전 가져오기
    };

    // Matcher Context
    const matcherContext: CBSMatcherContext = {
        calcString: (str: string) => {
            return cbsRegisterArg.calcString(str);
        },
        getMatcherMap: () => {
            // CBS 초기화 (한 번만)
            const initKey = `${context.userId}-${context.characterId}`;
            if (!cbsInitialized.has(initKey)) {
                initMatcher(cbsRegisterArg);
                cbsInitialized.add(initKey);
            }
            return getMatcherMap();
        },
        initMatcher: () => {
            const initKey = `${context.userId}-${context.characterId}`;
            if (!cbsInitialized.has(initKey)) {
                initMatcher(cbsRegisterArg);
                cbsInitialized.add(initKey);
            }
        },
    };

    // Block Matcher Context
    const blockContext: CBSBlockMatcherContext = {
        getChatVar: (key: string) => {
            return cbsRegisterArg.getChatVar(key);
        },
        getGlobalChatVar: (key: string) => {
            return cbsRegisterArg.getGlobalChatVar(key);
        },
    };

    return {
        parser: parserContext,
        matcher: matcherContext,
        block: blockContext,
    };
}
