/**
 * 트리거 실행 로직
 * 원본: src/ts/process/triggers.ts의 runTrigger 함수
 * 
 * TODO: 전체 구현 필요 - 현재는 기본 구조만 제공
 * 파일이 매우 크므로 (2796 lines) 단계적으로 구현 필요
 */

import type { character, Chat, Database } from '../../database';
import type { triggerMode, triggerscript, additonalSysPrompt, TriggerRunResult } from './types';
import { checkAllConditions, type ConditionCheckContext } from './conditions';
import { risuChatParser } from '../../../ts/parser.svelte';
import { parseKeyValue } from '../../../ts/util';
import { runScripted } from '../scripting';
import type { TokenizerContext } from '../../tokenizer';
// TODO: 아래 함수들을 서버 사이드로 마이그레이션 필요
import { getModuleTriggers } from '../../../ts/process/modules';
import { processMultiCommand } from '../../../ts/process/command';
import { requestChatData } from '../request';
import { HypaProcessor } from '../memory/hypa-processor';
import { generateAIImage } from '../../../ts/process/stableDiff';
import { writeInlayImage } from '../../../ts/process/files/inlays';
import { parseChatML } from '../../../ts/parser/chatML';
import type { OpenAIChat } from '../types';

/**
 * 트리거 실행 인자
 */
export interface TriggerRunArg {
    chat: Chat;
    recursiveCount?: number;
    additonalSysPrompt?: additonalSysPrompt;
    stopSending?: boolean;
    manualName?: string;
    triggerId?: string;
    displayMode?: boolean;
    displayData?: string;
    tempVars?: Record<string, string>;
    database?: Database;
    tokenizerContext?: TokenizerContext;
    userId?: string;
    characterId?: string;
    chatId?: string;
}

/**
 * 트리거 실행
 */
export async function runTrigger(
    char: character,
    mode: triggerMode,
    arg: TriggerRunArg
): Promise<TriggerRunResult | null> {
    arg.recursiveCount ??= 0;
    char = arg.displayMode ? char : JSON.parse(JSON.stringify(char)); // safeStructuredClone 대체
    let varChanged = false;
    let stopSending = arg.stopSending ?? false;
    const CharacterlowLevelAccess = char.lowLevelAccess ?? false;
    let sendAIprompt = false;
    const chat = arg.displayMode ? arg.chat : JSON.parse(JSON.stringify(arg.chat)); // safeStructuredClone 대체

    let additonalSysPrompt: additonalSysPrompt = arg.additonalSysPrompt ?? {
        start: '',
        historyend: '',
        promptend: '',
    };

    const triggers = char.triggerscript
        .map(v => {
            v.lowLevelAccess = CharacterlowLevelAccess;
            return v;
        })
        .concat(getModuleTriggers() || []);

    const db = arg.database;
    if (!db) {
        throw new Error('Database is required');
    }

    const defaultVariables = parseKeyValue(char.defaultVariables || '').concat(
        parseKeyValue(db.templateDefaultVariables || '')
    );

    if (!triggers || triggers.length === 0) {
        return null;
    }

    let tempVars: Record<string, string> = arg.tempVars ?? {};

    // 로컬 변수 스코프 관리
    let localVarScopes: Record<number, Record<string, string>>[] = [{}];
    let currentIndent = 0;

    function getLocalVar(key: string): string | null {
        if (!localVarScopes || localVarScopes.length === 0) {
            return null;
        }
        const currentScope = localVarScopes[localVarScopes.length - 1];
        if (!currentScope) {
            return null;
        }
        for (let indent = currentIndent; indent >= 0; indent--) {
            if (currentScope[indent] && currentScope[indent][key] !== undefined) {
                const value = currentScope[indent][key];
                return value;
            }
        }
        return null;
    }

    function setLocalVar(key: string, value: string, indent: number) {
        if (!localVarScopes || localVarScopes.length === 0) {
            localVarScopes = [{}];
        }
        const currentScope = localVarScopes[localVarScopes.length - 1];
        if (!currentScope) {
            return;
        }

        const finalValue = value === null || value === undefined ? 'null' : value;

        let foundIndent = -1;
        for (let i = indent; i >= 0; i--) {
            if (currentScope[i] && currentScope[i][key] !== undefined) {
                foundIndent = i;
                break;
            }
        }

        const targetIndent = foundIndent !== -1 ? foundIndent : indent;

        if (!currentScope[targetIndent]) {
            currentScope[targetIndent] = {};
        }

        currentScope[targetIndent][key] = finalValue;
    }

    function declareLocalVar(key: string, value: string, indent: number) {
        setLocalVar(key, value, indent);
    }

    function clearLocalVarsAtIndent(indent: number) {
        if (!localVarScopes || localVarScopes.length === 0) {
            return;
        }
        const currentScope = localVarScopes[localVarScopes.length - 1];
        if (!currentScope) {
            return;
        }
        const indentsToDelete: string[] = [];
        for (const scopeIndent in currentScope) {
            if (Number(scopeIndent) >= indent) {
                indentsToDelete.push(scopeIndent);
            }
        }
        indentsToDelete.forEach(indentKey => {
            delete currentScope[indentKey];
        });
    }

    function getVar(key: string): string {
        const localVar = getLocalVar(key);
        if (localVar !== null) {
            return localVar;
        }

        const state = chat.scriptstate?.['$' + key];
        if (state === undefined || state === null) {
            const findResult = defaultVariables.find(f => {
                return f[0] === key;
            });
            if (findResult) {
                return findResult[1];
            }
            if (arg.displayMode) {
                return tempVars[key] ?? 'null';
            }
            return 'null';
        }
        return state.toString();
    }

    function setVar(key: string, value: string) {
        if (arg.displayMode) {
            tempVars[key] = value;
            return;
        }

        const localVar = getLocalVar(key);
        if (localVar !== null) {
            setLocalVar(key, value, currentIndent);
            return;
        }

        varChanged = true;
        chat.scriptstate ??= {};
        chat.scriptstate['$' + key] = value;
        // TODO: 데이터베이스에 저장
    }

    // 트리거 실행 루프
    for (const trigger of triggers) {
        // 트리거 코드/Lua는 별도 처리
        if (trigger.effect[0]?.type === 'triggercode' || trigger.effect[0]?.type === 'triggerlua') {
            // TODO: 코드 실행 처리
        } else if (arg.manualName) {
            if (trigger.comment !== arg.manualName) {
                continue;
            }
        } else if (mode !== trigger.type) {
            continue;
        }

        // 조건 체크
        const conditionContext: ConditionCheckContext = {
            char,
            chat,
            getVar,
        };

        if (!checkAllConditions(trigger.conditions, conditionContext)) {
            continue;
        }

        // 이펙트 실행
        for (let index = 0; index < trigger.effect.length; index++) {
            const effect = trigger.effect[index];

            // Display/Request 모드에서는 허용된 이펙트만 실행
            // TODO: displayAllowList, requestAllowList 체크

            if (effect && 'indent' in effect && typeof effect.indent === 'number' && effect.indent >= 0) {
                currentIndent = effect.indent;
            } else if (!effect || !('indent' in effect)) {
                currentIndent = 0;
            }

            // 이펙트 처리
            switch (effect.type) {
                case 'setvar': {
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    const varKey = risuChatParser(effect.var, { chara: char });
                    let originalVar = Number(getVar(varKey));
                    if (Number.isNaN(originalVar)) {
                        originalVar = 0;
                    }
                    let resultValue = '';
                    switch (effect.operator) {
                        case '=': {
                            resultValue = effectValue;
                            break;
                        }
                        case '+=': {
                            resultValue = (originalVar + Number(effectValue)).toString();
                            break;
                        }
                        case '-=': {
                            resultValue = (originalVar - Number(effectValue)).toString();
                            break;
                        }
                        case '*=': {
                            resultValue = (originalVar * Number(effectValue)).toString();
                            break;
                        }
                        case '/=': {
                            resultValue = (originalVar / Number(effectValue)).toString();
                            break;
                        }
                    }
                    setVar(varKey, resultValue);
                    break;
                }
                case 'systemprompt': {
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    additonalSysPrompt[effect.location] += effectValue + '\n\n';
                    break;
                }
                case 'impersonate': {
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    if (effect.role === 'user') {
                        chat.message.push({ role: 'user', data: effectValue });
                    } else if (effect.role === 'char') {
                        chat.message.push({ role: 'char', data: effectValue });
                    }
                    break;
                }
                case 'command': {
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    await processMultiCommand(effectValue);
                    break;
                }
                case 'stop':
                case 'v2StopPromptSending': {
                    stopSending = true;
                    break;
                }
                case 'runtrigger': {
                    if (arg.recursiveCount! < 10 || trigger.lowLevelAccess) {
                        arg.recursiveCount!++;
                        const r = await runTrigger(
                            char,
                            'manual',
                            {
                                ...arg,
                                recursiveCount: arg.recursiveCount,
                                additonalSysPrompt,
                                stopSending,
                                manualName: effect.value,
                            }
                        );
                        if (r) {
                            additonalSysPrompt = r.additonalSysPrompt || additonalSysPrompt;
                            Object.assign(chat, r.chat || chat);
                            stopSending = r.stopSending || stopSending;
                        }
                    }
                    break;
                }
                case 'cutchat': {
                    const start = Number(risuChatParser(effect.start, { chara: char }));
                    const end = Number(risuChatParser(effect.end, { chara: char }));
                    chat.message = chat.message.slice(start, end);
                    break;
                }
                case 'modifychat': {
                    const index = Number(risuChatParser(effect.index, { chara: char }));
                    const value = risuChatParser(effect.value, { chara: char });
                    if (chat.message[index]) {
                        chat.message[index].data = value;
                    }
                    break;
                }
                case 'showAlert': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    if (arg.displayMode) {
                        break;
                    }
                    // 서버에서는 로깅으로 대체
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    console.log('[Trigger Alert]', effect.alertType, effectValue);
                    break;
                }
                case 'sendAIprompt': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    sendAIprompt = true;
                    break;
                }
                case 'runLLM': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    const varName = effect.inputVar;
                    let promptbody: OpenAIChat[] = parseChatML(effectValue) || [];
                    if (!promptbody || promptbody.length === 0) {
                        promptbody = [{ role: 'user', content: effectValue }];
                    }
                    const result = await requestChatData(
                        {
                            formated: promptbody,
                            bias: {},
                            useStreaming: false,
                            noMultiGen: true,
                        },
                        'model',
                        db,
                        null
                    );

                    if (result.type === 'fail' || result.type === 'streaming' || result.type === 'multiline') {
                        setVar(varName, 'Error: ' + result.result);
                    } else {
                        setVar(varName, result.result);
                    }
                    break;
                }
                case 'checkSimilarity': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    if (!arg.tokenizerContext) {
                        throw new Error('TokenizerContext is required');
                    }
                    const processer = new HypaProcessor('auto', undefined, arg.userId, arg.chatId, db);
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    const source = risuChatParser(effect.source, { chara: char });
                    await processer.addText(effectValue.split('§'), db);
                    const val = await processer.similaritySearch(source);
                    setVar(effect.inputVar, val.join('§'));
                    break;
                }
                case 'extractRegex': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    const regex = new RegExp(effect.regex, effect.flags);
                    const regexResult = regex.exec(effectValue);
                    if (!regexResult) {
                        setVar(effect.inputVar, '');
                        break;
                    }
                    const result = effect.result
                        .replace(/\$[0-9]+/g, match => {
                            const index = Number(match.slice(1));
                            return regexResult[index] || '';
                        })
                        .replace(/\$&/g, regexResult[0])
                        .replace(/\$\$/g, '$');
                    setVar(effect.inputVar, result);
                    break;
                }
                case 'runImgGen': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue = risuChatParser(effect.value, { chara: char });
                    const negValue = risuChatParser(effect.negValue, { chara: char });
                    const gen = await generateAIImage(effectValue, char, negValue, 'inlay');
                    if (!gen) {
                        setVar(effect.inputVar, 'Error: Image generation failed');
                        break;
                    }
                    const imgHTML = new Image();
                    imgHTML.src = gen;
                    const inlay = await writeInlayImage(imgHTML);
                    const res = `{{inlay::${inlay}}}`;
                    setVar(effect.inputVar, res);
                    break;
                }
                case 'triggerlua': {
                    if (!arg.userId || !arg.characterId || !arg.chatId) {
                        throw new Error('userId, characterId, chatId are required');
                    }
                    const triggerCodeResult = await runScripted(effect.code, {
                        userId: arg.userId,
                        characterId: arg.characterId,
                        chatId: arg.chatId,
                        lowLevelAccess: trigger.lowLevelAccess,
                        mode: mode === 'manual' ? arg.manualName || 'manual' : mode,
                        setVar: setVar,
                        getVar: getVar,
                        char: char,
                        chat: chat,
                        database: db,
                        tokenizerContext: arg.tokenizerContext,
                    });

                    if (triggerCodeResult.stopSending) {
                        stopSending = true;
                    }
                    if (triggerCodeResult.chat) {
                        Object.assign(chat, triggerCodeResult.chat);
                    }
                    break;
                }
                // V2 이펙트들 (일부만 구현)
                case 'v2Header': {
                    // Header for V2 triggers
                    break;
                }
                case 'v2SetVar': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    const varKey = risuChatParser(effect.var, { chara: char });
                    let originalVar = Number(getVar(varKey));
                    if (Number.isNaN(originalVar)) {
                        originalVar = 0;
                    }
                    let resultValue = '';
                    switch (effect.operator) {
                        case '=': {
                            resultValue = effectValue;
                            break;
                        }
                        case '+=': {
                            resultValue = (originalVar + Number(effectValue)).toString();
                            break;
                        }
                        case '-=': {
                            resultValue = (originalVar - Number(effectValue)).toString();
                            break;
                        }
                        case '*=': {
                            resultValue = (originalVar * Number(effectValue)).toString();
                            break;
                        }
                        case '/=': {
                            resultValue = (originalVar / Number(effectValue)).toString();
                            break;
                        }
                        case '%=': {
                            resultValue = (originalVar % Number(effectValue)).toString();
                            break;
                        }
                    }
                    setVar(varKey, resultValue);
                    break;
                }
                case 'v2DeclareLocalVar': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    const varKey = risuChatParser(effect.var, { chara: char });
                    const finalValue = effectValue === null || effectValue === undefined ? 'null' : effectValue;
                    declareLocalVar(varKey, finalValue, effect.indent);
                    break;
                }
                case 'v2If':
                case 'v2IfAdvanced': {
                    const sourceValue =
                        effect.type === 'v2If' || effect.sourceType === 'var'
                            ? getVar(risuChatParser(effect.source, { chara: char }))
                            : risuChatParser(effect.source, { chara: char });
                    const targetValue =
                        effect.targetType === 'value'
                            ? risuChatParser(effect.target, { chara: char })
                            : getVar(risuChatParser(effect.target, { chara: char }));
                    let pass = false;

                    switch (effect.condition) {
                        case '=': {
                            if (!isNaN(Number(sourceValue)) && !isNaN(Number(targetValue))) {
                                pass = Number(sourceValue) === Number(targetValue);
                            } else {
                                pass = sourceValue === targetValue;
                            }
                            break;
                        }
                        case '!=': {
                            if (!isNaN(Number(sourceValue)) && !isNaN(Number(targetValue))) {
                                pass = Number(sourceValue) !== Number(targetValue);
                            } else {
                                pass = sourceValue !== targetValue;
                            }
                            break;
                        }
                        case '>': {
                            pass = Number(sourceValue) > Number(targetValue);
                            break;
                        }
                        case '<': {
                            pass = Number(sourceValue) < Number(targetValue);
                            break;
                        }
                        case '>=': {
                            pass = Number(sourceValue) >= Number(targetValue);
                            break;
                        }
                        case '<=': {
                            pass = Number(sourceValue) <= Number(targetValue);
                            break;
                        }
                        case '∈': {
                            try {
                                pass = JSON.parse(targetValue).includes(sourceValue);
                            } catch (error) {
                                pass = false;
                            }
                            break;
                        }
                        case '∋': {
                            try {
                                pass = JSON.parse(sourceValue).includes(targetValue);
                            } catch (error) {
                                pass = false;
                            }
                            break;
                        }
                        case '∉': {
                            try {
                                pass = !JSON.parse(targetValue).includes(sourceValue);
                            } catch (error) {
                                pass = true;
                            }
                            break;
                        }
                        case '∌': {
                            try {
                                pass = !JSON.parse(sourceValue).includes(targetValue);
                            } catch (error) {
                                pass = true;
                            }
                            break;
                        }
                        case '≒': {
                            const num1 = Number(sourceValue);
                            const num2 = Number(targetValue);
                            if (Number.isNaN(num1) || Number.isNaN(num2)) {
                                pass =
                                    sourceValue.toLocaleLowerCase().replace(/ /g, '') ===
                                    targetValue.toLocaleLowerCase().replace(/ /g, '');
                            } else {
                                pass = Math.abs(num1 - num2) < 0.0001;
                            }
                            break;
                        }
                        case '≡': {
                            if (targetValue === 'true') {
                                pass = sourceValue === 'true' || sourceValue === '1';
                            } else if (targetValue === 'false') {
                                pass = !(sourceValue === 'true' || sourceValue === '1');
                            } else {
                                pass = sourceValue === targetValue;
                            }
                            break;
                        }
                    }

                    if (!pass) {
                        // Else 블록 찾기
                        let indent = effect.indent + 1;
                        for (; index < trigger.effect.length; index++) {
                            const ef = trigger.effect[index] as any;
                            if (ef.type === 'v2EndIndent' && indent === ef.indent) {
                                const nextEf = trigger.effect[index + 1] as any;
                                indent--;
                                if (nextEf?.type === 'v2Else' && nextEf?.indent === indent) {
                                    index++;
                                }
                                break;
                            }
                        }
                    }
                    break;
                }
                case 'v2Else': {
                    // Else 블록은 If에서 처리됨
                    let indent = effect.indent;
                    for (; index < trigger.effect.length; index++) {
                        const ef = trigger.effect[index] as any;
                        if (ef.type === 'v2EndIndent' && indent === ef.indent) {
                            break;
                        }
                    }
                    break;
                }
                case 'v2EndIndent': {
                    // Indent 종료
                    break;
                }
                case 'v2Loop': {
                    // TODO: Loop 처리
                    break;
                }
                case 'v2BreakLoop': {
                    // TODO: Loop break 처리
                    break;
                }
                case 'v2RunTrigger': {
                    if (arg.recursiveCount! < 10 || trigger.lowLevelAccess) {
                        arg.recursiveCount!++;
                        const r = await runTrigger(
                            char,
                            'manual',
                            {
                                ...arg,
                                recursiveCount: arg.recursiveCount,
                                additonalSysPrompt,
                                stopSending,
                                manualName: effect.target,
                            }
                        );
                        if (r) {
                            additonalSysPrompt = r.additonalSysPrompt || additonalSysPrompt;
                            Object.assign(chat, r.chat || chat);
                            stopSending = r.stopSending || stopSending;
                        }
                    }
                    break;
                }
                case 'v2ConsoleLog': {
                    const sourceValue =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char })
                            : getVar(risuChatParser(effect.source, { chara: char }));
                    console.log('[Trigger]', sourceValue);
                    break;
                }
                case 'v2StopTrigger': {
                    // 현재 트리거만 중단
                    return {
                        chat,
                        additonalSysPrompt,
                        stopSending,
                        sendAIprompt,
                    };
                }
                case 'v2CutChat': {
                    const start =
                        effect.startType === 'value'
                            ? Number(risuChatParser(effect.start, { chara: char }))
                            : Number(getVar(risuChatParser(effect.start, { chara: char })));
                    const end =
                        effect.endType === 'value'
                            ? Number(risuChatParser(effect.end, { chara: char }))
                            : Number(getVar(risuChatParser(effect.end, { chara: char })));
                    chat.message = chat.message.slice(start, end);
                    break;
                }
                case 'v2ModifyChat': {
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }))
                            : Number(getVar(risuChatParser(effect.index, { chara: char })));
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    if (chat.message[index]) {
                        chat.message[index].data = value;
                    }
                    break;
                }
                case 'v2SystemPrompt': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    additonalSysPrompt[effect.location] += effectValue + '\n\n';
                    break;
                }
                case 'v2Impersonate': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    if (effect.role === 'user') {
                        chat.message.push({ role: 'user', data: effectValue });
                    } else if (effect.role === 'char') {
                        chat.message.push({ role: 'char', data: effectValue });
                    }
                    break;
                }
                case 'v2Command': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    await processMultiCommand(effectValue);
                    break;
                }
                case 'v2SendAIprompt': {
                    sendAIprompt = true;
                    break;
                }
                case 'v2ImgGen': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    const negValue =
                        effect.negValueType === 'value'
                            ? risuChatParser(effect.negValue, { chara: char })
                            : getVar(risuChatParser(effect.negValue, { chara: char }));
                    const gen = await generateAIImage(effectValue, char, negValue, 'inlay');
                    if (!gen) {
                        setVar(effect.outputVar, 'Error: Image generation failed');
                        break;
                    }
                    const imgHTML = new Image();
                    imgHTML.src = gen;
                    const inlay = await writeInlayImage(imgHTML);
                    const res = `{{inlay::${inlay}}}`;
                    setVar(effect.outputVar, res);
                    break;
                }
                case 'v2CheckSimilarity': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    if (!arg.tokenizerContext) {
                        throw new Error('TokenizerContext is required');
                    }
                    const processer = new HypaProcessor('auto', undefined, arg.userId, arg.chatId, db);
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    const source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char })
                            : getVar(risuChatParser(effect.source, { chara: char }));
                    await processer.addText(effectValue.split('§'), db);
                    const val = await processer.similaritySearch(source);
                    setVar(effect.outputVar, val.join('§'));
                    break;
                }
                case 'v2RunLLM': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    let promptbody: OpenAIChat[] = parseChatML(effectValue) || [];
                    if (!promptbody || promptbody.length === 0) {
                        promptbody = [{ role: 'user', content: effectValue }];
                    }
                    const result = await requestChatData(
                        {
                            formated: promptbody,
                            bias: {},
                            useStreaming: false,
                            noMultiGen: true,
                        },
                        effect.model,
                        db,
                        null
                    );

                    if (result.type === 'fail' || result.type === 'streaming' || result.type === 'multiline') {
                        setVar(effect.outputVar, 'Error: ' + result.result);
                    } else {
                        setVar(effect.outputVar, result.result);
                    }
                    break;
                }
                case 'v2ShowAlert': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    console.log('[Trigger Alert]', effectValue);
                    break;
                }
                case 'v2ExtractRegex': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char })
                            : getVar(risuChatParser(effect.value, { chara: char }));
                    const regexStr =
                        effect.regexType === 'value'
                            ? risuChatParser(effect.regex, { chara: char })
                            : getVar(risuChatParser(effect.regex, { chara: char }));
                    const flags =
                        effect.flagsType === 'value'
                            ? risuChatParser(effect.flags, { chara: char })
                            : getVar(risuChatParser(effect.flags, { chara: char }));
                    const regex = new RegExp(regexStr, flags);
                    const regexResult = regex.exec(effectValue);
                    if (!regexResult) {
                        setVar(effect.outputVar, '');
                        break;
                    }
                    const result =
                        effect.resultType === 'value'
                            ? risuChatParser(effect.result, { chara: char })
                            : getVar(risuChatParser(effect.result, { chara: char }));
                    const finalResult = result
                        .replace(/\$[0-9]+/g, match => {
                            const index = Number(match.slice(1));
                            return regexResult[index] || '';
                        })
                        .replace(/\$&/g, regexResult[0])
                        .replace(/\$\$/g, '$');
                    setVar(effect.outputVar, finalResult);
                    break;
                }
                case 'v2GetLastMessage': {
                    const lastMessage = chat.message[chat.message.length - 1];
                    setVar(effect.outputVar, lastMessage?.data || '');
                    break;
                }
                case 'v2GetMessageAtIndex': {
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }))
                            : Number(getVar(risuChatParser(effect.index, { chara: char })));
                    const message = chat.message[index];
                    setVar(effect.outputVar, message?.data || '');
                    break;
                }
                case 'v2GetMessageCount': {
                    setVar(effect.outputVar, chat.message.length.toString());
                    break;
                }
                case 'v2Wait': {
                    const waitTime =
                        effect.valueType === 'value'
                            ? Number(risuChatParser(effect.value, { chara: char }))
                            : Number(getVar(risuChatParser(effect.value, { chara: char })));
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    break;
                }
                // TODO: 나머지 V2 이펙트들 구현 필요
                default: {
                    // 알 수 없는 이펙트 타입
                    console.warn('[Trigger] Unknown effect type:', (effect as any).type);
                    break;
                }
            }
        }
    }

    return {
        chat,
        additonalSysPrompt,
        stopSending,
        sendAIprompt,
    };
}
