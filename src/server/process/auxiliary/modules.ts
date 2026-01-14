/**
 * 모듈 관련 유틸리티 함수들
 * 원본: src/ts/process/modules.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import type { Database, character, Chat, loreBook, customscript, triggerscript } from '../../database';

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
    mcp?: {
        url: string;
    };
}

/**
 * 활성화된 모듈 목록 가져오기
 */
export function getModules(
    database: Database,
    character?: character,
    chat?: Chat
): RisuModule[] {
    let ids: string[] = database.enabledModules ?? [];
    if (chat) {
        ids = ids.concat(chat.modules ?? []);
    }
    if (character && character.modules) {
        ids = ids.concat(character.modules);
    }
    if (database.moduleIntergration) {
        const intList = database.moduleIntergration.split(',').map((s) => s.trim());
        ids = ids.concat(intList);
    }

    // 중복 제거
    ids = [...new Set(ids)];

    // 모듈 ID로 모듈 찾기
    const modules: RisuModule[] = [];
    for (const id of ids) {
        const module = database.modules.find((m) => m.id === id);
        if (module) {
            modules.push(module);
        }
    }

    return modules;
}

/**
 * 모듈에서 Lorebook 추출
 */
export function getModuleLorebooks(
    database: Database,
    character?: character,
    chat?: Chat
): loreBook[] {
    const modules = getModules(database, character, chat);
    let lorebooks: loreBook[] = [];
    for (const module of modules) {
        if (!module) {
            continue;
        }
        if (module.lorebook) {
            lorebooks = lorebooks.concat(module.lorebook);
        }
    }
    return lorebooks;
}

/**
 * 모듈에서 Assets 추출
 */
export function getModuleAssets(
    database: Database,
    character?: character,
    chat?: Chat
): [string, string, string][] {
    const modules = getModules(database, character, chat);
    let assets: [string, string, string][] = [];
    for (const module of modules) {
        if (!module) {
            continue;
        }
        if (module.assets) {
            assets = assets.concat(module.assets);
        }
    }
    return assets;
}

/**
 * 모듈에서 Triggers 추출
 */
export function getModuleTriggers(
    database: Database,
    character?: character,
    chat?: Chat
): triggerscript[] {
    const modules = getModules(database, character, chat);
    let triggers: triggerscript[] = [];
    for (const module of modules) {
        if (!module) {
            continue;
        }
        if (module.trigger) {
            triggers = triggers.concat(
                module.trigger.map((t) => {
                    t.lowLevelAccess = module.lowLevelAccess;
                    return t;
                })
            );
        }
    }
    return triggers;
}

/**
 * 모듈에서 Regex Scripts 추출
 */
export function getModuleRegexScripts(
    database: Database,
    character?: character,
    chat?: Chat
): customscript[] {
    const modules = getModules(database, character, chat);
    let customscripts: customscript[] = [];
    for (const module of modules) {
        if (!module) {
            continue;
        }
        if (module.regex) {
            customscripts = customscripts.concat(module.regex);
        }
    }
    return customscripts;
}

/**
 * 모듈에서 Toggles 추출
 */
export function getModuleToggles(
    database: Database,
    character?: character,
    chat?: Chat
): string {
    const modules = getModules(database, character, chat);
    let costomModuleToggles: string = '';
    for (const module of modules) {
        if (!module) {
            continue;
        }
        if (module.customModuleToggle) {
            costomModuleToggles += '\n' + module.customModuleToggle + '\n';
        }
    }
    return costomModuleToggles;
}

/**
 * 모듈에서 MCP URLs 추출
 */
export function getModuleMcps(
    database: Database,
    character?: character,
    chat?: Chat
): string[] {
    const modules = getModules(database, character, chat);
    return modules.map((v) => v.mcp?.url).filter((v) => v) as string[];
}
