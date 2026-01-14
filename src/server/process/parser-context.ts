/**
 * ProcessContext에서 Parser Contexts 생성
 * risuChatParser를 사용하기 위한 contexts 생성
 */

import type { ProcessContext } from './types';
import type { RisuChatParserContext } from '../../parser/cbs-parser';
import type { MatcherContext as CBSMatcherContext } from '../../parser/cbs-matcher';
import type { BlockMatcherContext as CBSBlockMatcherContext } from '../../parser/cbs-blocks';
import { calcString } from '../../ts/process/infunctions'; // TODO: 서버 사이드로 마이그레이션
import { getMatcherMap, initMatcher } from '../../ts/cbs'; // TODO: 서버 사이드로 마이그레이션

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

    // Matcher Context
    const matcherContext: CBSMatcherContext = {
        calcString: (str: string) => {
            // TODO: 서버 사이드 calcString 구현
            return calcString(str);
        },
        getMatcherMap: () => {
            // TODO: 서버 사이드 getMatcherMap 구현
            return getMatcherMap();
        },
        initMatcher: () => {
            // TODO: 서버 사이드 initMatcher 구현
            initMatcher();
        },
    };

    // Block Matcher Context
    const blockContext: CBSBlockMatcherContext = {
        getChatVar: (key: string) => {
            // 채팅 변수 가져오기
            const chat = context.chat;
            if (chat && chat.localVars && chat.localVars[key]) {
                return chat.localVars[key];
            }
            return '';
        },
        getGlobalChatVar: (key: string) => {
            // 전역 채팅 변수 가져오기
            const database = context.database;
            if (database.globalVars && database.globalVars[key]) {
                return database.globalVars[key];
            }
            return '';
        },
    };

    return {
        parser: parserContext,
        matcher: matcherContext,
        block: blockContext,
    };
}
