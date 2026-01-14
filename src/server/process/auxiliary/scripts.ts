/**
 * Script 처리 함수들
 * 원본: src/ts/process/scripts.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import type { character, groupChat, customscript, Database, Chat } from '../../database';
import type { ProcessContext } from '../context';
import type { ScriptMode } from './types';
import { risuChatParser, assetRegex } from '../../parser';
import { getModuleRegexScripts, getModuleAssets } from './modules';
import { runLuaEditTrigger } from '../scripting/lua';
import { HypaProcessor } from '../memory/hypa-processor';
import { createParserContexts } from '../parser-context';

type pScript = {
    script: customscript;
    order: number;
    actions: string[];
};

// 캐시는 사용자별로 관리 (Redis 사용 가능)
const processScriptCache = new Map<string, string>();
const bestMatchCache = new Map<string, string>();

const dreg = /{{data}}/g;

function generateScriptCacheKey(
    scripts: customscript[],
    data: string,
    mode: ScriptMode,
    context: ProcessContext,
    chatID = -1,
    cbsConditions: any = {}
): string {
    let hash = data + '|||' + mode + '|||';
    const parserContexts = createParserContexts(context);
    for (const script of scripts) {
        if (script.type !== mode) {
            continue;
        }
        hash += `${script.flag?.includes('<cbs>') ? risuChatParser(script.in, { chatID: chatID, cbsConditions }, parserContexts) : script.in}|||${script.out}${chatID}|||${script.flag ?? ''}|||${script.ableFlag ? 1 : 0}`;
    }
    return hash;
}

function cacheScript(hash: string, result: string): void {
    processScriptCache.set(hash, result);

    if (processScriptCache.size > 1000) {
        processScriptCache.delete(processScriptCache.keys().next().value);
    }
}

function getScriptCache(hash: string): string | undefined {
    return processScriptCache.get(hash);
}

export function resetScriptCache(): void {
    processScriptCache.clear();
    bestMatchCache.clear();
}

/**
 * Script 처리 (간단 버전)
 */
export async function processScript(
    char: character | groupChat,
    data: string,
    mode: ScriptMode,
    context: ProcessContext,
    cbsConditions: any = {}
): Promise<string> {
    return (await processScriptFull(char, data, mode, context, -1, cbsConditions)).data;
}

/**
 * Script 처리 (전체 버전)
 */
export async function processScriptFull(
    char: character | groupChat,
    data: string,
    mode: ScriptMode,
    context: ProcessContext,
    chatID = -1,
    cbsConditions: any = {}
): Promise<{ data: string; emoChanged: boolean }> {
    const database = context.database;
    let emoChanged = false;

    // Lua edit trigger 실행
    data = await runLuaEditTrigger(
        context.userId,
        context.characterId,
        context.chatId,
        char,
        mode,
        data,
        { index: chatID },
        database,
        undefined // tokenizerContext는 필요시 전달
    );

    // editdisplay 모드는 서버에서는 처리하지 않음 (UI 전용)
    // if (mode === 'editdisplay') { ... }

    // Plugin 처리 (TODO: 서버 사이드 플러그인 시스템 구현)
    // if (pluginV2[mode].size > 0) { ... }

    // CBS 파싱
    const parserContexts = createParserContexts(context);
    data = risuChatParser(data, { chatID: chatID, cbsConditions }, parserContexts);

    // Scripts 수집
    const scripts = (database.presetRegex ?? [])
        .concat(char.customscript)
        .concat(getModuleRegexScripts(database, char, context.chat));

    const hash = generateScriptCacheKey(scripts, data, mode, context, chatID, cbsConditions);
    const cached = getScriptCache(hash);
    if (cached) {
        return { data: cached, emoChanged: false };
    }

    if (scripts.length === 0) {
        cacheScript(hash, data);
        return { data, emoChanged };
    }

    function executeScript(pscript: pScript): void {
        const script = pscript.script;

        if (script.in === '') {
            return;
        }

        if (script.type === mode) {
            let outScript2 = script.out.replaceAll('$n', '\n');
            let outScript = outScript2.replace(dreg, '$&');
            let flag = 'g';
            if (script.ableFlag) {
                flag = script.flag || 'g';
            }
            if (
                outScript.startsWith('@@move_top') ||
                outScript.startsWith('@@move_bottom') ||
                pscript.actions.includes('move_top') ||
                pscript.actions.includes('move_bottom')
            ) {
                flag = flag.replace('g', ''); // temporary fix
            }
            if (outScript.endsWith('>') && !pscript.actions.includes('no_end_nl')) {
                outScript += '\n';
            }
            // remove unsupported flag
            flag = flag.trim().replace(/[^dgimsuvy]/g, '');

            // remove repeated flags
            flag = flag
                .split('')
                .filter((v, i, a) => a.indexOf(v) === i)
                .join('');

            if (flag.length === 0) {
                flag = 'u';
            }

            let input = script.in;
            if (pscript.actions.includes('cbs')) {
                const parserContexts = createParserContexts(context);
                input = risuChatParser(input, { chatID: chatID, cbsConditions }, parserContexts);
            }

            const reg = new RegExp(input, flag);
            if (outScript.startsWith('@@') || pscript.actions.length > 0) {
                if (reg.test(data)) {
                    // @@emo 처리 (서버에서는 emoChanged만 설정)
                    if (outScript.startsWith('@@emo ')) {
                        emoChanged = true;
                    } else if (
                        (outScript.startsWith('@@inject') || pscript.actions.includes('inject')) &&
                        chatID !== -1
                    ) {
                        // 서버에서는 채팅 메시지 직접 수정
                        const chat = context.chat;
                        if (chat && chat.message[chatID]) {
                            chat.message[chatID].data = data;
                            data = data.replace(reg, '');
                        }
                    } else if (
                        outScript.startsWith('@@move_top') ||
                        outScript.startsWith('@@move_bottom') ||
                        pscript.actions.includes('move_top') ||
                        pscript.actions.includes('move_bottom')
                    ) {
                        const isGlobal = flag.includes('g');
                        const matchAll = isGlobal ? data.matchAll(reg) : [data.match(reg)];
                        data = data.replace(reg, '');
                        for (const matched of matchAll) {
                            if (matched) {
                                const inData = matched[0];
                                let out = outScript
                                    .replace('@@move_top ', '')
                                    .replace('@@move_bottom ', '')
                                    .replace(/(?<!\$)\$[0-9]+/g, (v) => {
                                        const index = parseInt(v.substring(1));
                                        if (index < matched.length) {
                                            return matched[index];
                                        }
                                        return v;
                                    })
                                    .replace(/\$\&/g, inData)
                                    .replace(/(?<!\$)\$<([^>]+)>/g, (v) => {
                                        const groupName = parseInt(v.substring(2, v.length - 1));
                                        if (matched.groups && matched.groups[groupName]) {
                                            return matched.groups[groupName];
                                        }
                                        return v;
                                    });
                                if (
                                    outScript.startsWith('@@move_top') ||
                                    pscript.actions.includes('move_top')
                                ) {
                                    data = out + '\n' + data;
                                } else {
                                    data = data + '\n' + out;
                                }
                            }
                        }
                    } else {
                        const parserContexts = createParserContexts(context);
                        data = risuChatParser(data.replace(reg, outScript), {
                            chatID: chatID,
                            cbsConditions,
                        }, parserContexts);
                    }
                } else {
                    // @@repeat_back 처리
                    if (
                        (outScript.startsWith('@@repeat_back') ||
                            pscript.actions.includes('repeat_back')) &&
                        chatID !== -1
                    ) {
                        const v = outScript.split(' ', 2)[1];
                        const chat = context.chat;
                        if (chat) {
                            let lastChat =
                                chat.fmIndex === -1
                                    ? char.firstMessage
                                    : (char as any).alternateGreetings?.[chat.fmIndex] || '';
                            let pointer = chatID - 1;
                            while (pointer >= 0) {
                                if (chat.message[pointer].role === chat.message[chatID].role) {
                                    lastChat = chat.message[pointer].data;
                                    break;
                                }
                                pointer--;
                            }

                            const r = lastChat.match(reg);
                            if (!v) {
                                data = data + (r?.[0] || '');
                            } else if (r?.[0]) {
                                switch (v) {
                                    case 'end':
                                        data = data + r[0];
                                        break;
                                    case 'start':
                                        data = r[0] + data;
                                        break;
                                    case 'end_nl':
                                        data = data + '\n' + r[0];
                                        break;
                                    case 'start_nl':
                                        data = r[0] + '\n' + data;
                                        break;
                                }
                            }
                        }
                    }
                }
            } else {
                const parserContexts = createParserContexts(context);
                data = risuChatParser(data.replace(reg, outScript), {
                    chatID: chatID,
                    cbsConditions,
                }, parserContexts);
            }
        }
    }

    // Scripts 파싱 및 정렬
    let parsedScripts: pScript[] = [];
    let orderChanged = false;
    for (const script of scripts) {
        if (script.ableFlag && script.flag?.includes('<')) {
            const rregex = /<(.+?)>/g;
            const scriptData = JSON.parse(JSON.stringify(script)); // safeStructuredClone 대체
            let order = 0;
            const actions: string[] = [];
            scriptData.flag = scriptData.flag?.replace(rregex, (v: string, p1: string) => {
                const meta = p1.split(',').map((v) => v.trim());
                for (const m of meta) {
                    if (m.startsWith('order ')) {
                        order = parseInt(m.substring(6));
                        orderChanged = true;
                    } else {
                        actions.push(m);
                    }
                }
                return '';
            });
            parsedScripts.push({
                script: scriptData,
                order,
                actions,
            });
            continue;
        }
        parsedScripts.push({
            script,
            order: 0,
            actions: [],
        });
    }

    if (orderChanged) {
        parsedScripts.sort((a, b) => b.order - a.order); // sort by order
    }

    // Scripts 실행
    for (const script of parsedScripts) {
        try {
            executeScript(script);
        } catch (error) {
            console.error('[Script Processing] Error executing script:', error);
        }
    }

    // Dynamic Assets 처리
    if (
        database.dynamicAssets &&
        (char.type === 'simple' || char.type === 'character') &&
        (char as any).additionalAssets &&
        (char as any).additionalAssets.length > 0
    ) {
        if (
            (!database.dynamicAssetsEditDisplay && mode === 'editdisplay') ||
            mode === 'editinput' ||
            mode === 'editprocess'
        ) {
            cacheScript(hash, data);
            return { data, emoChanged };
        }
        const assetNames = (char as any).additionalAssets.map((v: any) => v[0]);

        const moduleAssets = getModuleAssets(database, char, context.chat);
        if (moduleAssets.length > 0) {
            for (const asset of moduleAssets) {
                assetNames.push(asset[0]);
            }
        }

        const processer = new HypaProcessor('auto', undefined, context.userId, context.chatId, database);
        await processer.addText(assetNames);
        const matches = data.matchAll(assetRegex);

        for (const match of matches) {
            const type = match[1];
            const assetName = match[2];
            const cacheKey = char.chaId + '::' + assetName;
            if (type !== 'emotion' && type !== 'source') {
                if (bestMatchCache.has(cacheKey)) {
                    data = data.replaceAll(match[0], `{{${type}::${bestMatchCache.get(cacheKey)}}}`);
                } else if (!assetNames.includes(assetName)) {
                    const searched = await processer.similaritySearch(assetName);
                    const bestMatch = searched[0];
                    if (bestMatch) {
                        data = data.replaceAll(match[0], `{{${type}::${bestMatch}}}`);
                        bestMatchCache.set(cacheKey, bestMatch);
                    }
                }
            }
        }
    }

    cacheScript(hash, data);

    return { data, emoChanged };
}
