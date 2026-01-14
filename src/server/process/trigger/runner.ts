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
import { risuChatParser } from '../../parser';
import { createParserContexts } from '../parser-context';
import { parseKeyValue } from '../../../ts/util';
import { runScripted } from '../scripting';
import type { TokenizerContext } from '../../tokenizer';
// TODO: 아래 함수들을 서버 사이드로 마이그레이션 필요
import { getModuleTriggers } from '../auxiliary/modules';
import { processMultiCommand } from '../../../ts/process/command';
import { requestChatData } from '../request';
import { HypaProcessor } from '../memory/hypa-processor';
import { generateAIImage } from '../../../ts/process/stableDiff';
import { writeInlayImage } from '../auxiliary/file-processing';
import { parseChatML } from '../../parser';
import type { OpenAIChat } from '../types';
import { getDatabaseAdapter } from '../../database-adapter';
import { setCharacter } from '../../database/access';
import { tokenize } from '../../tokenizer';
import { calcString } from '../../../ts/process/infunctions';

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
    databaseAdapter?: ReturnType<typeof getDatabaseAdapter>;
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
        .concat(getModuleTriggers(db, char, chat) || []);

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
        // 데이터베이스에 저장
        if (arg.userId && arg.characterId && arg.chatId && !arg.displayMode) {
            const adapter = arg.databaseAdapter || getDatabaseAdapter();
            // 채팅의 scriptstate를 저장
            await adapter.saveChat(arg.userId, chat);
        }
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
            database: db,
            parserContexts,
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
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
                    const varKey = risuChatParser(effect.var, { chara: char }, parserContexts);
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
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
                    additonalSysPrompt[effect.location] += effectValue + '\n\n';
                    break;
                }
                case 'impersonate': {
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
                    if (effect.role === 'user') {
                        chat.message.push({ role: 'user', data: effectValue });
                    } else if (effect.role === 'char') {
                        chat.message.push({ role: 'char', data: effectValue });
                    }
                    break;
                }
                case 'command': {
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
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
                    const start = Number(risuChatParser(effect.start, { chara: char }, parserContexts));
                    const end = Number(risuChatParser(effect.end, { chara: char }, parserContexts));
                    chat.message = chat.message.slice(start, end);
                    break;
                }
                case 'modifychat': {
                    const index = Number(risuChatParser(effect.index, { chara: char }, parserContexts));
                    const value = risuChatParser(effect.value, { chara: char }, parserContexts);
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
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
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
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
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
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
                    const source = risuChatParser(effect.source, { chara: char }, parserContexts);
                    await processer.addText(effectValue.split('§'), db);
                    const val = await processer.similaritySearch(source);
                    setVar(effect.inputVar, val.join('§'));
                    break;
                }
                case 'extractRegex': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
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
                    if (!arg.userId) {
                        throw new Error('userId is required for image generation');
                    }
                    const effectValue = risuChatParser(effect.value, { chara: char }, parserContexts);
                    const negValue = risuChatParser(effect.negValue, { chara: char }, parserContexts);
                    const gen = await generateAIImage(effectValue, char, negValue, 'inlay');
                    if (!gen) {
                        const inputVar = risuChatParser(effect.inputVar, { chara: char }, parserContexts);
                        setVar(inputVar, 'Error: Image generation failed');
                        break;
                    }
                    // gen은 base64 데이터 URL이거나 URL일 수 있음
                    let imageBuffer: Buffer;
                    if (gen.startsWith('data:')) {
                        const base64 = gen.split(',')[1];
                        imageBuffer = Buffer.from(base64, 'base64');
                    } else {
                        // URL인 경우 fetch로 가져오기
                        const response = await fetch(gen);
                        const arrayBuffer = await response.arrayBuffer();
                        imageBuffer = Buffer.from(arrayBuffer);
                    }
                    const inlay = await writeInlayImage(imageBuffer, { name: 'generated', ext: 'png' }, arg.userId);
                    const res = `{{inlay::${inlay}}}`;
                    const inputVar = risuChatParser(effect.inputVar, { chara: char }, parserContexts);
                    setVar(inputVar, res);
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
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const varKey = risuChatParser(effect.var, { chara: char }, parserContexts);
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
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const varKey = risuChatParser(effect.var, { chara: char }, parserContexts);
                    const finalValue = effectValue === null || effectValue === undefined ? 'null' : effectValue;
                    declareLocalVar(varKey, finalValue, effect.indent);
                    break;
                }
                case 'v2If':
                case 'v2IfAdvanced': {
                    const sourceValue =
                        effect.type === 'v2If' || effect.sourceType === 'var'
                            ? getVar(risuChatParser(effect.source, { chara: char }, parserContexts))
                            : risuChatParser(effect.source, { chara: char }, parserContexts);
                    const targetValue =
                        effect.targetType === 'value'
                            ? risuChatParser(effect.target, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.target, { chara: char }, parserContexts));
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
                case 'v2Loop':
                case 'v2LoopNTimes': {
                    // Looping is handled by the v2EndIndent
                    break;
                }
                case 'v2BreakLoop': {
                    for (; index < trigger.effect.length; index++) {
                        const ef = trigger.effect[index] as any;
                        if (ef.type === 'v2EndIndent' && ef.endOfLoop) {
                            break;
                        }
                    }
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
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
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
                            ? Number(risuChatParser(effect.start, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.start, { chara: char }, parserContexts)));
                    const end =
                        effect.endType === 'value'
                            ? Number(risuChatParser(effect.end, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.end, { chara: char }, parserContexts)));
                    chat.message = chat.message.slice(start, end);
                    break;
                }
                case 'v2ModifyChat': {
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    if (chat.message[index]) {
                        chat.message[index].data = value;
                    }
                    break;
                }
                case 'v2SystemPrompt': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    additonalSysPrompt[effect.location] += effectValue + '\n\n';
                    break;
                }
                case 'v2Impersonate': {
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
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
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
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
                    if (!arg.userId) {
                        throw new Error('userId is required for image generation');
                    }
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const negValue =
                        effect.negValueType === 'value'
                            ? risuChatParser(effect.negValue, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.negValue, { chara: char }, parserContexts));
                    const gen = await generateAIImage(effectValue, char, negValue, 'inlay');
                    if (!gen) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, 'Error: Image generation failed');
                        break;
                    }
                    // gen은 base64 데이터 URL이거나 URL일 수 있음
                    let imageBuffer: Buffer;
                    if (gen.startsWith('data:')) {
                        const base64 = gen.split(',')[1];
                        imageBuffer = Buffer.from(base64, 'base64');
                    } else {
                        // URL인 경우 fetch로 가져오기
                        const response = await fetch(gen);
                        const arrayBuffer = await response.arrayBuffer();
                        imageBuffer = Buffer.from(arrayBuffer);
                    }
                    const inlay = await writeInlayImage(imageBuffer, { name: 'generated', ext: 'png' }, arg.userId);
                    const res = `{{inlay::${inlay}}}`;
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, res);
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
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
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
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
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
                        null,
                        arg.userId || ''
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
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    console.log('[Trigger Alert]', effectValue);
                    break;
                }
                case 'v2ExtractRegex': {
                    if (!trigger.lowLevelAccess) {
                        break;
                    }
                    const effectValue =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const regexStr =
                        effect.regexType === 'value'
                            ? risuChatParser(effect.regex, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.regex, { chara: char }, parserContexts));
                    const flags =
                        effect.flagsType === 'value'
                            ? risuChatParser(effect.flags, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.flags, { chara: char }, parserContexts));
                    const regex = new RegExp(regexStr, flags);
                    const regexResult = regex.exec(effectValue);
                    if (!regexResult) {
                        setVar(effect.outputVar, '');
                        break;
                    }
                    const result =
                        effect.resultType === 'value'
                            ? risuChatParser(effect.result, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.result, { chara: char }, parserContexts));
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
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
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
                            ? Number(risuChatParser(effect.value, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.value, { chara: char }, parserContexts)));
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    break;
                }
                case 'v2LoopNTimes': {
                    // LoopNTimes는 v2EndIndent에서 처리됨
                    break;
                }
                case 'v2ModifyLorebook': {
                    char.globalLore = char.globalLore ?? [];
                    const target =
                        effect.targetType === 'value'
                            ? risuChatParser(effect.target, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.target, { chara: char }, parserContexts));
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));

                    const index = char.globalLore.findIndex((v: any) => v[0] === target);
                    if (index !== -1) {
                        char.globalLore[index][1] = value;
                    }

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2GetLorebook': {
                    char.globalLore = char.globalLore ?? [];
                    const target =
                        effect.targetType === 'value'
                            ? risuChatParser(effect.target, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.target, { chara: char }, parserContexts));
                    const index = char.globalLore.findIndex((v: any) => v[0] === target);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, index === -1 ? 'null' : char.globalLore[index][1]);
                    break;
                }
                case 'v2GetLorebookCount': {
                    char.globalLore = char.globalLore ?? [];
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, char.globalLore.length.toString());
                    break;
                }
                case 'v2GetLorebookEntry': {
                    char.globalLore = char.globalLore ?? [];
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    if (Number.isNaN(index)) {
                        index = 0;
                    }
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, char.globalLore[index]?.[1] ?? 'null');
                    break;
                }
                case 'v2SetLorebookActivation': {
                    char.globalLore = char.globalLore ?? [];
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const value = effect.value;
                    if (char.globalLore[index]) {
                        char.globalLore[index][2] = value;
                    }

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2GetLorebookIndexViaName': {
                    char.globalLore = char.globalLore ?? [];
                    let name =
                        effect.nameType === 'value'
                            ? risuChatParser(effect.name, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.name, { chara: char }, parserContexts));
                    let index = char.globalLore.findIndex((v: any) => v[0] === name);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, index.toString());
                    break;
                }
                case 'v2Random': {
                    let min =
                        effect.minType === 'value'
                            ? Number(risuChatParser(effect.min, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.min, { chara: char }, parserContexts)));
                    let max =
                        effect.maxType === 'value'
                            ? Number(risuChatParser(effect.max, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.max, { chara: char }, parserContexts)));

                    let output = Math.floor(Math.random() * (max - min + 1) + min);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, output.toString());
                    break;
                }
                case 'v2GetCharAt': {
                    let source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, source[index] ?? 'null');
                    break;
                }
                case 'v2GetCharCount': {
                    let source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, source.length.toString());
                    break;
                }
                case 'v2ToLowerCase': {
                    let source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, source.toLowerCase());
                    break;
                }
                case 'v2ToUpperCase': {
                    let source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, source.toUpperCase());
                    break;
                }
                case 'v2SetCharAt': {
                    let source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    let value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const source2 = [...source];
                    source2[index] = value;
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, source2.join(''));
                    break;
                }
                case 'v2SplitString': {
                    let source =
                        effect.sourceType === 'value'
                            ? risuChatParser(effect.source, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                    let delimiter: string;

                    if (effect.delimiterType === 'value') {
                        delimiter = risuChatParser(effect.delimiter, { chara: char }, parserContexts);
                    } else if (effect.delimiterType === 'var') {
                        delimiter = getVar(risuChatParser(effect.delimiter, { chara: char }, parserContexts));
                    } else {
                        delimiter = risuChatParser(effect.delimiter, { chara: char }, parserContexts);
                    }

                    let result: string[];
                    if (effect.delimiterType === 'regex') {
                        try {
                            const regexMatch = delimiter.match(/^\/(.+)\/([gimuy]*)$/);
                            if (regexMatch) {
                                const [, pattern, flags] = regexMatch;
                                const regex = new RegExp(pattern, flags);
                                result = source.split(regex);
                            } else {
                                const regex = new RegExp(delimiter);
                                result = source.split(regex);
                            }
                        } catch (error) {
                            result = [source];
                        }
                    } else {
                        result = source.split(delimiter);
                    }

                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, JSON.stringify(result));
                    break;
                }
                case 'v2JoinArrayVar': {
                    try {
                        let varValue =
                            effect.varType === 'value'
                                ? risuChatParser(effect.var, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let arr = JSON.parse(varValue);
                        let delimiter =
                            effect.delimiterType === 'value'
                                ? risuChatParser(effect.delimiter, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.delimiter, { chara: char }, parserContexts));
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, arr.join(delimiter));
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '');
                    }
                    break;
                }
                case 'v2GetCharacterDesc': {
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, char.desc);
                    break;
                }
                case 'v2SetCharacterDesc': {
                    let value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    char.desc = value;

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2GetPersonaDesc': {
                    const currentPersonaPrompt = db.personaPrompt ?? '';
                    const savedPersonaPrompt = db.personas?.[db.selectedPersona]?.personaPrompt ?? '';
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, currentPersonaPrompt || savedPersonaPrompt);
                    break;
                }
                case 'v2SetPersonaDesc': {
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    if (db.personas?.[db.selectedPersona] && arg.userId && !arg.displayMode) {
                        db.personas[db.selectedPersona].personaPrompt = value;
                        db.personaPrompt = value;
                        const adapter = arg.databaseAdapter || getDatabaseAdapter();
                        await adapter.saveUserDatabase(arg.userId, db);
                    }
                    break;
                }
                case 'v2GetReplaceGlobalNote': {
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, char.replaceGlobalNote ?? '');
                    break;
                }
                case 'v2SetReplaceGlobalNote': {
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    char.replaceGlobalNote = value;

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2MakeArrayVar': {
                    const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                    if (varName.startsWith('[') && varName.endsWith(']')) {
                        break;
                    }

                    setVar(varName, '[]');
                    break;
                }
                case 'v2GetArrayVarLength': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, arr.length.toString());
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '0');
                    }
                    break;
                }
                case 'v2GetArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let index =
                            effect.indexType === 'value'
                                ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                                : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, arr[index] ?? 'null');
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, 'null');
                    }
                    break;
                }
                case 'v2SetArrayVar': {
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    if (Number.isNaN(index)) {
                        break;
                    }
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        arr[index] = value;
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        // Ignore
                    }
                    break;
                }
                case 'v2PushArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let value =
                            effect.valueType === 'value'
                                ? risuChatParser(effect.value, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                        arr.push(value);
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, '[]');
                    }
                    break;
                }
                case 'v2PopArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, arr.pop() ?? 'null');
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, '[]');
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, 'null');
                    }
                    break;
                }
                case 'v2ShiftArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, arr.shift() ?? 'null');
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, '[]');
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, 'null');
                    }
                    break;
                }
                case 'v2UnshiftArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let value =
                            effect.valueType === 'value'
                                ? risuChatParser(effect.value, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                        arr.unshift(value);
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, '[]');
                    }
                    break;
                }
                case 'v2SpliceArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let start =
                            effect.startType === 'value'
                                ? Number(risuChatParser(effect.start, { chara: char }, parserContexts))
                                : Number(getVar(risuChatParser(effect.start, { chara: char }, parserContexts)));
                        let value =
                            effect.itemType === 'value'
                                ? risuChatParser(effect.item, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.item, { chara: char }, parserContexts));
                        arr.splice(start, 0, value);
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, '[]');
                    }
                    break;
                }
                case 'v2SliceArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let start =
                            effect.startType === 'value'
                                ? Number(risuChatParser(effect.start, { chara: char }, parserContexts))
                                : Number(getVar(risuChatParser(effect.start, { chara: char }, parserContexts)));
                        let end =
                            effect.endType === 'value'
                                ? Number(risuChatParser(effect.end, { chara: char }, parserContexts))
                                : Number(getVar(risuChatParser(effect.end, { chara: char }, parserContexts)));

                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, JSON.stringify(arr.slice(start, end)));
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '[]');
                    }
                    break;
                }
                case 'v2GetIndexOfValueInArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let value =
                            effect.valueType === 'value'
                                ? risuChatParser(effect.value, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, arr.indexOf(value).toString());
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '-1');
                    }
                    break;
                }
                case 'v2RemoveIndexFromArrayVar': {
                    try {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        let varValue = getVar(varName);
                        let arr = JSON.parse(varValue);
                        let index =
                            effect.indexType === 'value'
                                ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                                : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                        arr.splice(index, 1);
                        setVar(varName, JSON.stringify(arr));
                    } catch (error) {
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, '[]');
                    }
                    break;
                }
                case 'v2ConcatString': {
                    let source1 =
                        effect.source1Type === 'value'
                            ? risuChatParser(effect.source1, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source1, { chara: char }, parserContexts));
                    let source2 =
                        effect.source2Type === 'value'
                            ? risuChatParser(effect.source2, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.source2, { chara: char }, parserContexts));
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, source1 + source2);
                    break;
                }
                case 'v2GetLastUserMessage': {
                    let lastUserMessage = chat.message.slice().reverse().find((v) => v.role === 'user');
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, lastUserMessage?.data ?? 'null');
                    break;
                }
                case 'v2GetLastCharMessage': {
                    let lastCharMessage = chat.message.slice().reverse().find((v) => v.role === 'char');
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, lastCharMessage?.data ?? 'null');
                    break;
                }
                case 'v2GetFirstMessage': {
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, chat.fmIndex === -1 ? char.firstMessage : char.alternateGreetings[chat.fmIndex]);
                    break;
                }
                case 'v2GetAlertInput': {
                    if (arg.displayMode) {
                        break;
                    }
                    // 서버에서는 사용자 입력을 받을 수 없으므로 로깅
                    const display =
                        effect.displayType === 'value'
                            ? risuChatParser(effect.display, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.display, { chara: char }, parserContexts));
                    console.log('[Trigger Alert Input]', display);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, 'null');
                    break;
                }
                case 'v2GetAlertSelect': {
                    if (arg.displayMode) {
                        break;
                    }
                    // 서버에서는 사용자 선택을 받을 수 없으므로 로깅
                    const display =
                        effect.displayType === 'value'
                            ? risuChatParser(effect.display, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.display, { chara: char }, parserContexts));
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const options = value.split('|');
                    console.log('[Trigger Alert Select]', display, options);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, 'null');
                    break;
                }
                case 'v2GetDisplayState': {
                    if (!arg.displayMode) {
                        break;
                    }

                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, arg.displayData ?? 'null');
                    break;
                }
                case 'v2SetDisplayState': {
                    if (!arg.displayMode) {
                        break;
                    }
                    arg.displayData =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    break;
                }
                case 'v2UpdateGUI': {
                    // 서버에서는 GUI 업데이트가 없으므로 무시
                    break;
                }
                case 'v2UpdateChatAt': {
                    // 서버에서는 채팅 업데이트가 없으므로 무시
                    break;
                }
                case 'v2GetRequestState': {
                    if (!arg.displayMode) {
                        break;
                    }
                    const json = JSON.parse(arg.displayData || '[]') as OpenAIChat[];
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const content = json?.[index]?.content ?? 'null';
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, content);
                    break;
                }
                case 'v2SetRequestState': {
                    if (!arg.displayMode) {
                        break;
                    }
                    const json = JSON.parse(arg.displayData || '[]') as OpenAIChat[];
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    if (json[index]) {
                        json[index].content = value;
                    }
                    arg.displayData = JSON.stringify(json);
                    break;
                }
                case 'v2GetRequestStateRole': {
                    if (!arg.displayMode) {
                        break;
                    }
                    const json = JSON.parse(arg.displayData || '[]') as OpenAIChat[];
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const content = json?.[index]?.role ?? 'null';
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, content);
                    break;
                }
                case 'v2SetRequestStateRole': {
                    if (!arg.displayMode) {
                        break;
                    }
                    const json = JSON.parse(arg.displayData || '[]') as OpenAIChat[];
                    const index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    if (value === 'user' || value === 'assistant' || value === 'system') {
                        if (json[index]) {
                            json[index].role = value;
                        }
                    }
                    arg.displayData = JSON.stringify(json);
                    break;
                }
                case 'v2GetRequestStateLength': {
                    if (!arg.displayMode) {
                        break;
                    }
                    const json = JSON.parse(arg.displayData || '[]') as OpenAIChat[];
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, json.length.toString());
                    break;
                }
                case 'v2QuickSearchChat': {
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const depth =
                        effect.depthType === 'value'
                            ? Number(risuChatParser(effect.depth, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.depth, { chara: char }, parserContexts)));
                    const condition = effect.condition;

                    if (isNaN(depth)) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '0');
                        break;
                    }
                    let pass = false;
                    let da = chat.message.slice(0 - depth).map((v) => v.data).join(' ');
                    if (condition === 'strict') {
                        pass = da.split(' ').includes(value);
                    } else if (condition === 'loose') {
                        pass = da.toLowerCase().includes(value.toLowerCase());
                    } else if (condition === 'regex') {
                        pass = new RegExp(value).test(da);
                    }
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, pass ? '1' : '0');
                    break;
                }
                case 'v2StopPromptSending': {
                    stopSending = true;
                    break;
                }
                case 'v2Tokenize': {
                    if (!arg.tokenizerContext) {
                        throw new Error('TokenizerContext is required');
                    }
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    const tokenCount = await tokenize(value, arg.tokenizerContext);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, tokenCount.toString());
                    break;
                }
                case 'v2GetAllLorebooks': {
                    char.globalLore = char.globalLore ?? [];
                    const allPrompts = char.globalLore
                        .filter((lore: any) => lore && lore.content !== undefined)
                        .map((lore: any) => lore.content);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, JSON.stringify(allPrompts));
                    break;
                }
                case 'v2GetLorebookByName': {
                    char.globalLore = char.globalLore ?? [];
                    const name =
                        effect.nameType === 'value'
                            ? risuChatParser(effect.name, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.name, { chara: char }, parserContexts));
                    const regex = new RegExp(name, 'i');
                    const matchingIndices = char.globalLore
                        .map((lore: any, index: number) => {
                            if (lore && lore.comment !== undefined && regex.test(lore.comment)) {
                                return index;
                            }
                            return -1;
                        })
                        .filter((index: number) => index !== -1);
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, JSON.stringify(matchingIndices));
                    break;
                }
                case 'v2GetLorebookByIndex': {
                    char.globalLore = char.globalLore ?? [];
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));
                    if (Number.isNaN(index) || index < 0 || index >= char.globalLore.length) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, 'null');
                    } else {
                        const loreEntry = char.globalLore[index];
                        if (loreEntry && (loreEntry as any).content !== undefined) {
                            const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                            setVar(outputVar, (loreEntry as any).content);
                        } else {
                            const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                            setVar(outputVar, 'null');
                        }
                    }
                    break;
                }
                case 'v2CreateLorebook': {
                    char.globalLore = char.globalLore ?? [];
                    const name =
                        effect.nameType === 'value'
                            ? risuChatParser(effect.name, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.name, { chara: char }, parserContexts));
                    const key =
                        effect.keyType === 'value'
                            ? risuChatParser(effect.key, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));
                    const content =
                        effect.contentType === 'value'
                            ? risuChatParser(effect.content, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.content, { chara: char }, parserContexts));
                    const insertOrder =
                        effect.insertOrderType === 'value'
                            ? Number(risuChatParser(effect.insertOrder, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.insertOrder, { chara: char }, parserContexts)));

                    char.globalLore.push({
                        key: key,
                        comment: name,
                        content: content,
                        mode: 'normal',
                        insertorder: Number.isNaN(insertOrder) ? 100 : insertOrder,
                        alwaysActive: false,
                        secondkey: '',
                        selective: false,
                    } as any);

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2ModifyLorebookByIndex': {
                    char.globalLore = char.globalLore ?? [];
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));

                    if (Number.isNaN(index) || index < 0 || index >= char.globalLore.length || !char.globalLore[index]) {
                        break;
                    }

                    const currentLore = char.globalLore[index] as any;

                    let name =
                        effect.nameType === 'value'
                            ? risuChatParser(effect.name, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.name, { chara: char }, parserContexts));
                    name = name.replace(/{{slot}}/g, currentLore.comment || '');
                    char.globalLore[index] = { ...currentLore, comment: name };

                    let key =
                        effect.keyType === 'value'
                            ? risuChatParser(effect.key, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));
                    key = key.replace(/{{slot}}/g, currentLore.key || '');
                    char.globalLore[index] = { ...currentLore, key: key };

                    let content =
                        effect.contentType === 'value'
                            ? risuChatParser(effect.content, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.content, { chara: char }, parserContexts));
                    content = content.replace(/{{slot}}/g, currentLore.content || '');
                    char.globalLore[index] = { ...currentLore, content: content };

                    let insertOrder =
                        effect.insertOrderType === 'value'
                            ? risuChatParser(effect.insertOrder, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.insertOrder, { chara: char }, parserContexts));
                    insertOrder = insertOrder.replace(/{{slot}}/g, (currentLore.insertorder || 100).toString());
                    const insertOrderNum = Number(insertOrder);
                    if (!Number.isNaN(insertOrderNum)) {
                        char.globalLore[index] = { ...currentLore, insertorder: insertOrderNum };
                    }

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2DeleteLorebookByIndex': {
                    char.globalLore = char.globalLore ?? [];
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));

                    if (Number.isNaN(index) || index < 0 || index >= char.globalLore.length || !char.globalLore[index]) {
                        break;
                    }

                    char.globalLore.splice(index, 1);

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2GetLorebookCountNew': {
                    char.globalLore = char.globalLore ?? [];
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, char.globalLore.length.toString());
                    break;
                }
                case 'v2SetLorebookAlwaysActive': {
                    char.globalLore = char.globalLore ?? [];
                    let index =
                        effect.indexType === 'value'
                            ? Number(risuChatParser(effect.index, { chara: char }, parserContexts))
                            : Number(getVar(risuChatParser(effect.index, { chara: char }, parserContexts)));

                    if (Number.isNaN(index) || index < 0 || index >= char.globalLore.length || !char.globalLore[index]) {
                        break;
                    }

                    (char.globalLore[index] as any).alwaysActive = effect.value;

                    if (arg.userId && arg.characterId && !arg.displayMode) {
                        await setCharacter(arg.userId, arg.characterId, char);
                    }
                    break;
                }
                case 'v2RegexTest': {
                    try {
                        const value =
                            effect.valueType === 'value'
                                ? risuChatParser(effect.value, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                        const regexPattern =
                            effect.regexType === 'value'
                                ? risuChatParser(effect.regex, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.regex, { chara: char }, parserContexts));
                        const flags =
                            effect.flagsType === 'value'
                                ? risuChatParser(effect.flags, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.flags, { chara: char }, parserContexts));
                        const regex = new RegExp(regexPattern, flags);
                        const result = regex.test(value);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, result ? '1' : '0');
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '0');
                    }
                    break;
                }
                case 'v2GetAuthorNote': {
                    const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                    setVar(outputVar, chat.note ?? '');
                    break;
                }
                case 'v2SetAuthorNote': {
                    const value =
                        effect.valueType === 'value'
                            ? risuChatParser(effect.value, { chara: char }, parserContexts)
                            : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                    chat.note = value;

                    if (!arg.displayMode && arg.userId && arg.characterId && arg.chatId) {
                        const adapter = arg.databaseAdapter || getDatabaseAdapter();
                        await adapter.saveChat(arg.userId, chat);
                    }
                    break;
                }
                case 'v2MakeDictVar': {
                    const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                    if (varName.startsWith('{') && varName.endsWith('}')) {
                        break;
                    }

                    setVar(varName, '{}');
                    break;
                }
                case 'v2GetDictVar': {
                    try {
                        let varValue =
                            effect.varType === 'value'
                                ? risuChatParser(effect.var, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        let key =
                            effect.keyType === 'value'
                                ? risuChatParser(effect.key, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, dict[key] ?? 'null');
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, 'null');
                    }
                    break;
                }
                case 'v2SetDictVar': {
                    try {
                        const value =
                            effect.valueType === 'value'
                                ? risuChatParser(effect.value, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                        const key =
                            effect.keyType === 'value'
                                ? risuChatParser(effect.key, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));

                        if (effect.varType === 'value') {
                            break;
                        }

                        let varValue = getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        dict[key] = value;
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, JSON.stringify(dict));
                    } catch (error) {
                        if (effect.varType === 'var') {
                            const value =
                                effect.valueType === 'value'
                                    ? risuChatParser(effect.value, { chara: char }, parserContexts)
                                    : getVar(risuChatParser(effect.value, { chara: char }, parserContexts));
                            const key =
                                effect.keyType === 'value'
                                    ? risuChatParser(effect.key, { chara: char }, parserContexts)
                                    : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));
                            let dict: any = {};
                            dict[key] = value;
                            const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                            setVar(varName, JSON.stringify(dict));
                        }
                    }
                    break;
                }
                case 'v2DeleteDictKey': {
                    try {
                        if (effect.varType === 'value') {
                            break;
                        }

                        let varValue = getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        let key =
                            effect.keyType === 'value'
                                ? risuChatParser(effect.key, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));
                        delete dict[key];
                        const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                        setVar(varName, JSON.stringify(dict));
                    } catch (error) {
                        if (effect.varType === 'var') {
                            const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                            setVar(varName, '{}');
                        }
                    }
                    break;
                }
                case 'v2HasDictKey': {
                    try {
                        let varValue =
                            effect.varType === 'value'
                                ? risuChatParser(effect.var, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        let key =
                            effect.keyType === 'value'
                                ? risuChatParser(effect.key, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.key, { chara: char }, parserContexts));
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, Object.hasOwn(dict, key) ? '1' : '0');
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '0');
                    }
                    break;
                }
                case 'v2ClearDict': {
                    const varName = risuChatParser(effect.var, { chara: char }, parserContexts);
                    if (varName.startsWith('{') && varName.endsWith('}')) {
                        break;
                    }
                    setVar(varName, '{}');
                    break;
                }
                case 'v2GetDictSize': {
                    try {
                        let varValue =
                            effect.varType === 'value'
                                ? risuChatParser(effect.var, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, Object.keys(dict).length.toString());
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '0');
                    }
                    break;
                }
                case 'v2GetDictKeys': {
                    try {
                        let varValue =
                            effect.varType === 'value'
                                ? risuChatParser(effect.var, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        let keys = Object.keys(dict);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, JSON.stringify(keys));
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '[]');
                    }
                    break;
                }
                case 'v2GetDictValues': {
                    try {
                        let varValue =
                            effect.varType === 'value'
                                ? risuChatParser(effect.var, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.var, { chara: char }, parserContexts));
                        let dict = JSON.parse(varValue);
                        let values = Object.values(dict);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, JSON.stringify(values));
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '[]');
                    }
                    break;
                }
                case 'v2Calculate': {
                    try {
                        let expression =
                            effect.expressionType === 'value'
                                ? risuChatParser(effect.expression, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.expression, { chara: char }, parserContexts));
                        expression = expression.replace(/\$([a-zA-Z0-9_]+)/g, (_, varName) => {
                            const varValue = getVar(varName);
                            const parsed = parseFloat(varValue);
                            return isNaN(parsed) ? '0' : parsed.toString();
                        });

                        const result = calcString(expression);
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, result.toString());
                    } catch (error) {
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, '0');
                    }
                    break;
                }
                case 'v2ReplaceString': {
                    try {
                        const source =
                            effect.sourceType === 'value'
                                ? risuChatParser(effect.source, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                        const regexPattern =
                            effect.regexType === 'value'
                                ? risuChatParser(effect.regex, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.regex, { chara: char }, parserContexts));
                        const resultFormat =
                            effect.resultType === 'value'
                                ? risuChatParser(effect.result, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.result, { chara: char }, parserContexts));
                        const replacement =
                            effect.replacementType === 'value'
                                ? risuChatParser(effect.replacement, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.replacement, { chara: char }, parserContexts));
                        const flags =
                            effect.flagsType === 'value'
                                ? risuChatParser(effect.flags, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.flags, { chara: char }, parserContexts));

                        const regex = new RegExp(regexPattern, flags);
                        const result = source.replace(regex, (...args) => {
                            const match = args[0];
                            const groups = args.slice(1, -2);

                            const targetGroupMatch = resultFormat.match(/^\$(\d+)$/);
                            if (targetGroupMatch) {
                                const targetIndex = Number(targetGroupMatch[1]);
                                if (targetIndex === 0) {
                                    return replacement;
                                } else {
                                    const targetGroup = groups[targetIndex - 1];
                                    if (targetGroup) {
                                        return match.replace(targetGroup, replacement);
                                    }
                                }
                            }

                            return resultFormat
                                .replace(/\$[0-9]+/g, (placeholder) => {
                                    const index = Number(placeholder.slice(1));
                                    return index === 0 ? match : groups[index - 1] || '';
                                })
                                .replace(/\$&/g, match)
                                .replace(/\$\$/g, '$');
                        });
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, result);
                    } catch (error) {
                        const source =
                            effect.sourceType === 'value'
                                ? risuChatParser(effect.source, { chara: char }, parserContexts)
                                : getVar(risuChatParser(effect.source, { chara: char }, parserContexts));
                        const outputVar = risuChatParser(effect.outputVar, { chara: char }, parserContexts);
                        setVar(outputVar, source);
                    }
                    break;
                }
                case 'v2Comment': {
                    // 주석은 아무것도 하지 않음
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
