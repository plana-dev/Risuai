/**
 * CBS (Curly Bracket Syntax) 타입 정의
 * 서버 사이드에서 사용할 수 있도록 타입만 정의
 */

import type { Database, character, loreBook, customscript, triggerscript } from '../database';
import type { LLMModel } from '../model/types';

/**
 * CBS 조건 타입
 * 원본: src/ts/parser.svelte.ts
 */
export type CbsConditions = {
    firstmsg?: boolean;
    chatRole?: string;
}

/**
 * RisuModule 타입
 * 원본: src/ts/process/modules.ts
 */
export interface MCPModule {
    url: string;
}

export interface RisuModule {
    name: string;
    description: string;
    lorebook?: loreBook[];
    regex?: customscript[];
    cjs?: string;
    trigger?: triggerscript[];
    id: string;
    lowLevelAccess?: boolean;
    hideIcon?: boolean;
    backgroundEmbedding?: string;
    assets?: [string, string, string][];
    namespace?: string;
    customModuleToggle?: string;
    mcp?: MCPModule;
}

export type matcherArg = {
    chatID: number,
    db: Database,
    chara: character | string,
    rmVar: boolean,
    var?: { [key: string]: string }
    tokenizeAccurate?: boolean
    consistantChar?: boolean
    displaying?: boolean
    role?: string
    runVar?: boolean
    funcName?: string
    text?: string,
    recursiveCount?: number
    lowLevelAccess?: boolean
    cbsConditions: CbsConditions
    triggerId?: string
    getNested?: () => string[]
    setNestedRoot?: (val:string) => void
}

export type RegisterCallback = (str: string, matcherArg: matcherArg, args:string[], vars: { [key: string]: string } | null) => {
    text: string,
    var: { [key: string]: string }
} | string | null

export type CBSRegisterArg = {
    registerFunction: (arg:{
        name: string,
        callback: RegisterCallback|'doc_only',
        alias: string[]
        description: string
        deprecated?: {
            message: string,
            since?: string,
            replacement?: string
        }
        internalOnly?: boolean
    }) => void | Promise<void>,
    getDatabase: () => Database,
    getUserName: () => string,
    getPersonaPrompt: () => string,
    risuChatParser: (text: string, arg: matcherArg) => string,
    makeArray: (arr: unknown[]) => string,
    safeStructuredClone: <T>(obj: T) => T,
    parseArray: (str: string) => unknown[],
    parseDict: (str: string) => {[key: string]: unknown},
    getChatVar: (key: string) => string,
    setChatVar: (key: string, value: string) => void,
    getGlobalChatVar: (key: string) => string,
    calcString: (str: string) => number,
    dateTimeFormat: (format: string, timestamp?: number) => string,
    getModules: () => RisuModule[],
    getModuleLorebooks: () => loreBook[],
    pickHashRand: (seed: number, hash: string) => number,
    getSelectedCharID: () => number,
    getModelInfo: (model: string) => LLMModel
    callInternalFunction: (args: string[]) => string,
    isTauri: boolean,
    isNodeServer: boolean,
    isMobile: boolean,
    appVer: string,
}

export const defaultCBSRegisterArg: CBSRegisterArg = {
    registerFunction: () => { throw new Error('registerFunction not implemented') },
    getDatabase: () => { throw new Error('getDatabase not implemented') },
    getUserName: () => 'placeholder_user',
    getPersonaPrompt: () => 'placeholder_persona',
    risuChatParser: (text: string) => text,
    makeArray: (arr: string[]) => JSON.stringify(arr),
    safeStructuredClone: <T>(obj: T) => JSON.parse(JSON.stringify(obj)),
    parseArray: (str: string) => {
        try { return JSON.parse(str) } 
        catch { return [] }
    },
    parseDict: (str: string) => {
        try { return JSON.parse(str) } 
        catch { return {} }
    },
    getChatVar: () => '',
    setChatVar: () => {},
    getGlobalChatVar: () => '',
    calcString: () => 0,
    dateTimeFormat: (format: string, timestamp?: number) => {
        const date = timestamp ? new Date(timestamp * 1000) : new Date();
        return date.toISOString();
    },
    getModules: () => [],
    getModuleLorebooks: () => [],
    pickHashRand: () => Math.random(),
    getSelectedCharID: () => 0,
    callInternalFunction: (args: string[]) => {return ''},
    isTauri: false,
    isNodeServer: false,
    isMobile: false,
    appVer: '0.0.0',
    getModelInfo: () => ({
        id: 'placeholder',
        name: 'Placeholder Model',
        shortName: 'Placeholder',
        internalID: 'placeholder',
        format: 0,
        provider: 0,
        tokenizer: 0
    } as LLMModel)
};
