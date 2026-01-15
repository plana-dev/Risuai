/**
 * 메인 채팅 처리 함수
 * 원본: src/ts/process/index.svelte.ts의 sendChat 함수
 * 
 * 주요 기능:
 * - 프롬프트 템플릿 처리
 * - 토큰 계산 및 관리
 * - 메모리 시스템 통합
 * - 스트리밍 처리
 * - 후처리 로직 (runInlayScreen, addRerolls, sayTTS)
 * - Auto Continue Chat
 * - IGP (Image Generation Prompt) 처리
 */

import type { character, Chat, Database, MessageGenerationInfo, MessagePresetInfo } from '../../database';
import type { OpenAIChat } from '../types';
import type { SendChatArg, SendChatResult, UnformatedPrompts, StageTimings, StreamingCallback } from './types';
import type { ProcessContext } from '../context';
import type { TokenizerContext } from '../../tokenizer';
import { v4 as uuidv4 } from 'uuid';
import { risuChatParser, parseChatML } from '../../parser';
import { createParserContexts } from '../parser-context';
import { loadLoreBookV3Prompt } from '../lorebook';
import { runTrigger } from '../trigger';
import { requestChatData } from '../request';
import { tokenize } from '../../tokenizer';
import { updateContextChat } from '../context';
// TODO: 아래 함수들을 서버 사이드로 마이그레이션 필요
import { exampleMessage } from '../example-messages';
import { processScript, processScriptFull } from '../auxiliary/scripts';
import { runLuaEditTrigger } from '../scripting';
import { supaMemory } from '../memory/supa-memory';
import { hanuraiMemory } from '../memory/hanurai-memory';
import { hypaMemoryV2 } from '../memory/hypa-v2';
import { hypaMemoryV3 } from '../memory/hypa-v3';
// Util functions are now available via ProcessContext
// import { getPersonaPrompt, getUserName, getAuthorNoteDefaultText, findCharacterbyId, parseToggleSyntax, prebuiltAssetCommand } from '../../util';
import { parseToggleSyntax, prebuiltAssetCommand, trimUntilPunctuation, isLastCharPunctuation } from '../../util';
import { additionalInformations } from '../auxiliary/additional-info';
import { getInlayAsset } from '../auxiliary/file-processing';
import { getGenerationModelString } from '../auxiliary/model-string';
import { getModuleAssets, getModuleToggles, getModuleLorebooks } from '../auxiliary/modules';
import { readImage } from '../../util/image';
import { asBuffer } from '../../util';
import { getModelInfo } from '../../model/modellist-server';
import { LLMFlags } from '../../model/types';
import { runImageEmbedding } from '../auxiliary/image-embedding';
import { HypaProcessor } from '../memory/hypa-processor';
import { runInlayScreen } from '../auxiliary/inlay-screen';
import { addRerolls } from '../auxiliary/reroll';
import { sayTTS } from '../auxiliary/tts';
import { groupOrder } from '../auxiliary/group';
import type { groupChat } from '../../database';

/**
 * sendChat 함수
 */
export async function sendChat(
    context: ProcessContext,
    chatProcessIndex: number = -1,
    arg: SendChatArg = {}
): Promise<SendChatResult> {
    const {
        userId,
        database,
        character: currentCharacter,
        chat: currentChat,
        databaseAdapter,
    } = context;

    if (!currentCharacter || !currentChat || !database) {
        return {
            success: false,
            error: 'Missing required context',
        };
    }

    // TokenizerContext는 context에서 가져옴
    const tokenizerContext = context.tokenizerContext;

    const abortSignal = arg.signal ?? new AbortController().signal;

    const stageTimings: StageTimings = {
        stage1Start: 0,
        stage2Start: 0,
        stage3Start: 0,
        stage4Start: 0,
        stage1Duration: 0,
        stage2Duration: 0,
        stage3Duration: 0,
        stage4Duration: 0,
    };

    let findCharCache: { [key: string]: character } = {};
    function findCharacterbyIdwithCache(id: string): character | null {
        const d = findCharCache[id];
        if (d) {
            return d;
        } else {
            const r = context.findCharacterbyId(id);
            if (r) {
                findCharCache[id] = r;
            }
            return r;
        }
    }

    // Parser contexts 생성 (한 번만 생성하여 재사용)
    const parserContexts = createParserContexts(context);

    function runCurrentChatFunction(chat: Chat): Chat {
        chat.message = chat.message.map(v => {
            v.data = risuChatParser(v.data, { chara: currentCharacter, runVar: true }, parserContexts);
            return v;
        });
        return chat;
    }

    function throwError(error: string) {
        // 서버에서는 에러를 반환
        console.error('[sendChat Error]', error);
        return {
            success: false,
            error,
        };
    }

    // 통계 업데이트
    database.statics = database.statics || { messages: 0, imports: 0 };
    database.statics.messages += 1;
    const nowChatroom = currentCharacter;
    nowChatroom.lastInteraction = Date.now();
    
    // Chat ID 할당
    currentChat.message = currentChat.message.map((v) => {
        v.chatId = v.chatId ?? uuidv4();
        return v;
    });

    let currentChar: character;
    let calculatedChatTokens = 0;
    if (database.aiModel.startsWith('gpt')) {
        calculatedChatTokens += 5;
    } else {
        calculatedChatTokens += 3;
    }

    // 그룹 채팅 처리
    if (nowChatroom.type === 'group') {
        const groupChatroom = nowChatroom as groupChat;
        
        if (chatProcessIndex === -1) {
            // 모든 활성 캐릭터에 대해 순서대로 처리
            const charNames = groupChatroom.characters.map((v) => {
                const char = findCharacterbyIdwithCache(v);
                return char ? char.name : '';
            });

            const messages = groupChatroom.chats[groupChatroom.chatPage].message;
            const lastMessage = messages[messages.length - 1];
            
            // 활성 캐릭터 필터링 및 순서 결정
            let order = groupChatroom.characters.map((v, i) => {
                return {
                    id: v,
                    talkness: groupChatroom.characterActive[i] ? (groupChatroom.characterTalks[i] || 0) : -1,
                    index: i
                };
            }).filter((v) => {
                return v.talkness > 0;
            });
            
            // orderByOrder가 false이면 groupOrder로 순서 결정
            if (!groupChatroom.orderByOrder) {
                const lastMessageData = lastMessage?.data || '';
                order = groupOrder(order, lastMessageData, context).filter((v) => {
                    // 마지막 메시지를 보낸 캐릭터는 제외
                    if (v.id === lastMessage?.saying) {
                        return false;
                    }
                    return true;
                });
            }
            
            // 각 캐릭터에 대해 sendChat 호출
            const results: SendChatResult[] = [];
            for (let i = 0; i < order.length; i++) {
                const r = await sendChat(
                    context,
                    order[i].index,
                    {
                        ...arg,
                        chatAdditonalTokens: calculatedChatTokens,
                        signal: abortSignal
                    }
                );
                if (!r.success) {
                    return r;
                }
                results.push(r);
            }
            
            // 모든 결과를 합쳐서 반환
            return {
                success: true,
                generationInfo: results[results.length - 1]?.generationInfo || {} as MessageGenerationInfo,
                resendChat: results.some(r => r.resendChat),
                emoChanged: results.some(r => r.emoChanged),
            };
        } else {
            // 특정 캐릭터만 처리
            const charId = groupChatroom.characters[chatProcessIndex];
            const char = findCharacterbyIdwithCache(charId);
            if (!char) {
                return throwError(`cannot find character: ${charId}`);
            }
            currentChar = char;
        }
    } else {
        currentChar = nowChatroom as character;
    }

    let chatAdditonalTokens = arg.chatAdditonalTokens ?? calculatedChatTokens;
    let currentChatData = runCurrentChatFunction(currentChat);
    let maxContextTokens = database.maxContext;

    stageTimings.stage1Start = Date.now();

    // 프롬프트 준비
    let unformated: UnformatedPrompts = {
        main: [],
        jailbreak: [],
        chats: [],
        lorebook: [],
        globalNote: [],
        authorNote: [],
        lastChat: [],
        description: [],
        postEverything: [],
        personaPrompt: [],
    };

    let promptTemplate = database.promptTemplate ? JSON.parse(JSON.stringify(database.promptTemplate)) : null;
    const usingPromptTemplate = !!promptTemplate;

    // 기본 프롬프트 구성
    if (!currentChar.utilityBot && !promptTemplate) {
        const mainp = currentChar.systemPrompt?.replaceAll('{{original}}', database.mainPrompt) || database.mainPrompt;

        function formatPrompt(data: string): OpenAIChat[] {
            if (!data.startsWith('@@')) {
                data = '@@system\n' + data;
            }
            const parts = data.split(/@@@?(user|assistant|system)\n/);
            const chatObjects: OpenAIChat[] = [];
            for (let i = 1; i < parts.length; i += 2) {
                const role = parts[i] as 'user' | 'assistant' | 'system';
                const content = parts[i + 1]?.trim() || '';
                chatObjects.push({ role, content });
            }
            return chatObjects;
        }

        unformated.main.push(
            ...formatPrompt(
                risuChatParser(
                    mainp + (database.additionalPrompt === '' || !database.promptPreprocess ? '' : `\n${database.additionalPrompt}`),
                    { chara: currentChar }
                )
            )
        );

        if (database.jailbreakToggle) {
            unformated.jailbreak.push(...formatPrompt(risuChatParser(database.jailbreak, { chara: currentChar })));
        }

        unformated.globalNote.push(
            ...formatPrompt(
                risuChatParser(
                    currentChar.replaceGlobalNote?.replaceAll('{{original}}', database.globalNote) || database.globalNote,
                    { chara: currentChar }
                )
            )
        );
    }

    // Author Note
    if (currentChatData.note) {
        unformated.authorNote.push({
            role: 'system',
            content: risuChatParser(currentChatData.note, { chara: currentChar }),
        });
    } else if (getAuthorNoteDefaultText() !== '') {
        unformated.authorNote.push({
            role: 'system',
            content: risuChatParser(getAuthorNoteDefaultText(), { chara: currentChar }),
        });
    }

    // Chain of Thought
    if (database.chainOfThought && (!(usingPromptTemplate && database.promptSettings?.customChainOfThought))) {
        unformated.postEverything.push({
            role: 'system',
            content: `<instruction> - before respond everything, Think step by step as a ai assistant how would you respond inside <Thoughts> xml tag. this must be less than 5 paragraphs.</instruction>`,
        });
    }
    
    // 그룹 채팅 시스템 메시지
    if (nowChatroom.type === 'group') {
        const systemMsg = `[Write the next reply only as ${currentChar.name}]`;
        unformated.postEverything.push({
            role: 'system',
            content: systemMsg
        });
    }

    // Description
    {
        let description = risuChatParser(
            (database.promptPreprocess ? database.descriptionPrefix : '') + currentChar.desc,
            { chara: currentChar }
        );

        const additionalInfo = await additionalInformations(currentChar, currentChatData, context);
        if (additionalInfo) {
            description += '\n\n' + risuChatParser(additionalInfo, { chara: currentChar });
        }

        if (currentChar.personality) {
            description += risuChatParser('\n\nDescription of {{char}}: ' + currentChar.personality, { chara: currentChar });
        }

        if (currentChar.scenario) {
            description += risuChatParser('\n\nCircumstances and context of the dialogue: ' + currentChar.scenario, { chara: currentChar });
        }

        unformated.description.push({
            role: 'system',
            content: description,
        });
    }

    // Lorebook 로드
    const lorepmt = await loadLoreBookV3Prompt({
        character: currentChar,
        chat: currentChatData,
        database,
        tokenizerContext,
        getChatVar: (key: string) => {
            return currentChatData.scriptstate?.['$' + key]?.toString() || '';
        },
        setChatVar: (key: string, value: string) => {
            currentChatData.scriptstate ??= {};
            currentChatData.scriptstate['$' + key] = value;
        },
        findCharacterbyId: (id: string) => {
            return findCharacterbyIdwithCache(id);
        },
        getModuleLorebooks: () => {
            return getModuleLorebooks(database, currentChar, currentChatData);
        },
    });

    const normalActives = lorepmt.actives.filter(v => {
        return v.pos === '' && v.inject === null;
    });

    for (const lorebook of normalActives) {
        unformated.lorebook.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: currentChar }, parserContexts),
        });
    }

    // Persona Prompt
    if (database.personaPrompt) {
        unformated.personaPrompt.push({
            role: 'system',
            content: risuChatParser(context.getPersonaPrompt(), { chara: currentChar }, parserContexts),
        });
    }

    // 프롬프트 템플릿 처리 준비
    let currentTokens = database.maxResponse;
    let supaMemoryCardUsed = false;
    let hasCachePoint = false;
    
    // 예상치 못한 에러를 위한 여유 토큰
    currentTokens += 50;
    
    // Position parser 및 injection lorebook 처리
    const injectionLorebooks = lorepmt.actives.filter(v => {
        return v.inject && !v.inject.lore;
    });
    
    const injectionLorePosSet = new Set<string>();
    for (const lorebook of injectionLorebooks) {
        if (lorebook.inject?.location) {
            injectionLorePosSet.add(lorebook.inject.location);
        }
    }
    
    const positionRegex = /{{position::(.+?)}}/g;
    const positionParser = (text: string, loc: string): string => {
        if (injectionLorePosSet.has(loc)) {
            const matchings = injectionLorebooks.filter(v => {
                return v.inject?.location === loc;
            });
            for (const lore of matchings) {
                if (!lore.inject) continue;
                switch (lore.inject.operation) {
                    case 'append': {
                        text += ' ' + lore.prompt;
                        break;
                    }
                    case 'prepend': {
                        text = lore.prompt + ' ' + text;
                        break;
                    }
                    case 'replace': {
                        text = text.replace(lore.inject.param, lore.prompt);
                        break;
                    }
                }
            }
        }
        return text.replace(positionRegex, (match, p1) => {
            const matchingLorebooks = lorepmt.actives.filter(v => {
                return v.pos === ('pt_' + p1);
            });
            return matchingLorebooks.map(v => v.prompt).join('\n');
        });
    };
    
    // pushPrompts 함수
    let formated: OpenAIChat[] = [];
    const pushPrompts = (cha: OpenAIChat[]): void => {
        for (const chat of cha) {
            if (!chat.content.trim() && !(chat.multimodals && chat.multimodals.length > 0)) {
                continue;
            }
            if (!(database.aiModel.startsWith('gpt') || database.aiModel.startsWith('claude') || database.aiModel === 'openrouter' || database.aiModel === 'reverse_proxy')) {
                formated.push(chat);
                continue;
            }
            if (chat.role === 'system') {
                const endf = formated.at(-1);
                if (endf && endf.role === 'system' && endf.memo === chat.memo && endf.name === chat.name) {
                    formated[formated.length - 1].content += '\n\n' + chat.content;
                } else {
                    formated.push(chat);
                }
            } else {
                formated.push(chat);
            }
        }
    };
    
    // 토큰 계산 함수
    const tokenizeChatArray = async (chats: OpenAIChat[]): Promise<void> => {
        for (const chat of chats) {
            const tokens = await context.chatTokenizer.tokenizeChat(chat, tokenizerContext);
            currentTokens += tokens;
        }
    };
    
    // 프롬프트 템플릿 처리
    if (promptTemplate) {
        // postEverything 카드가 없으면 추가
        let hasPostEverything = false;
        for (const card of promptTemplate) {
            if (card.type === 'postEverything') {
                hasPostEverything = true;
                break;
            }
        }
        if (!hasPostEverything) {
            promptTemplate.push({
                type: 'postEverything'
            } as any);
        }
        
        // 각 카드 타입별 처리
        for (const card of promptTemplate) {
            switch (card.type) {
                case 'persona': {
                    let pmt = JSON.parse(JSON.stringify(unformated.personaPrompt));
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(
                                positionParser(card.innerFormat, card.type),
                                { chara: currentChar },
                                parserContexts
                            ).replace('{{slot}}', pmt[i].content);
                        }
                    }
                    await tokenizeChatArray(pmt);
                    break;
                }
                case 'description': {
                    let pmt = JSON.parse(JSON.stringify(unformated.description));
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(
                                positionParser(card.innerFormat, card.type),
                                { chara: currentChar },
                                parserContexts
                            ).replace('{{slot}}', pmt[i].content);
                        }
                    }
                    await tokenizeChatArray(pmt);
                    break;
                }
                case 'authornote': {
                    let pmt = JSON.parse(JSON.stringify(unformated.authorNote));
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(
                                positionParser(card.innerFormat, card.type),
                                { chara: currentChar },
                                parserContexts
                            ).replace('{{slot}}', pmt[i].content || card.defaultText || '');
                        }
                    }
                    await tokenizeChatArray(pmt);
                    break;
                }
                case 'lorebook': {
                    await tokenizeChatArray(unformated.lorebook);
                    break;
                }
                case 'postEverything': {
                    await tokenizeChatArray(unformated.postEverything);
                    if (usingPromptTemplate && database.promptSettings?.postEndInnerFormat) {
                        await tokenizeChatArray([{
                            role: 'system',
                            content: database.promptSettings.postEndInnerFormat
                        }]);
                    }
                    break;
                }
                case 'plain':
                case 'jailbreak':
                case 'cot': {
                    if ((!database.jailbreakToggle) && (card.type === 'jailbreak')) {
                        continue;
                    }
                    if ((!database.chainOfThought) && (card.type === 'cot')) {
                        continue;
                    }
                    
                    const convertRole = {
                        "system": "system",
                        "user": "user",
                        "bot": "assistant"
                    } as const;
                    
                    const posType = card.type === 'plain' ? card.type2 : card.type;
                    let content = positionParser(card.text || '', posType || '');
                    
                    if (card.type2 === 'globalNote') {
                        if (currentChar.replaceGlobalNote) {
                            content = positionParser(currentChar.replaceGlobalNote, posType || '').replaceAll('{{original}}', content);
                        }
                        if (currentChar.prebuiltAssetCommand && !card.text?.includes('{{//@customimageinstruction}}')) {
                            content += prebuiltAssetCommand;
                        }
                        content = risuChatParser(content, { chara: currentChar, role: card.role }, parserContexts);
                    } else if (card.type2 === 'main') {
                        content = risuChatParser(content, { chara: currentChar, role: card.role }, parserContexts);
                    } else {
                        content = risuChatParser(content, { chara: currentChar, role: card.role }, parserContexts);
                    }
                    
                    const prompt: OpenAIChat = {
                        role: convertRole[card.role || 'system'],
                        content: content
                    };
                    
                    await tokenizeChatArray([prompt]);
                    break;
                }
                case 'chatML': {
                    let prompts = parseChatML(card.text || '', parserContexts);
                    if (prompts) {
                        await tokenizeChatArray(prompts);
                    }
                    break;
                }
                case 'chat': {
                    let start = card.rangeStart ?? 0;
                    let end = (card.rangeEnd === 'end') ? chats.length : (card.rangeEnd ?? chats.length);
                    if (start === -1000) {
                        start = 0;
                        end = chats.length;
                    }
                    if (start < 0) {
                        start = chats.length + start;
                        if (start < 0) {
                            start = 0;
                        }
                    }
                    if (end < 0) {
                        end = chats.length + end;
                        if (end < 0) {
                            end = 0;
                        }
                    }
                    
                    if (start >= end) {
                        break;
                    }
                    let chatSlice = chats.slice(start, end);
                    
                    if (usingPromptTemplate && database.promptSettings?.sendChatAsSystem && (!card.chatAsOriginalOnSystem)) {
                        // systemizeChat 함수는 나중에 구현
                        // chatSlice = systemizeChat(chatSlice);
                    }
                    await tokenizeChatArray(chatSlice);
                    break;
                }
                case 'memory': {
                    supaMemoryCardUsed = true;
                    break;
                }
                case 'cache': {
                    hasCachePoint = true;
                    break;
                }
            }
        }
    } else {
        // 프롬프트 템플릿이 없는 경우 모든 unformated를 토큰 계산
        for (const key in unformated) {
            const chatArray = unformated[key as keyof UnformatedPrompts] as OpenAIChat[];
            for (const chat of chatArray) {
                currentTokens += await context.chatTokenizer.tokenizeChat(chat, tokenizerContext);
            }
        }
    }
    
    // Depth prompts 처리 (토큰 계산만)
    const depthPrompts = lorepmt.actives.filter(v => {
        return (v.pos === 'depth' && v.depth > 0) || v.pos === 'reverse_depth';
    });
    
    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }, parserContexts)
        };
        currentTokens += await context.chatTokenizer.tokenizeChat(chat, tokenizerContext);
    }

    // 예제 메시지
    const examples = exampleMessage(currentChar, context.getUserName(), context);
    let chats: OpenAIChat[] = JSON.parse(JSON.stringify(examples)); // safeStructuredClone 대체

    if (!database.aiModel.startsWith('novelai') || database.promptSettings?.trimStartNewChat) {
        chats.push({
            role: 'system',
            content: '[Start a new chat]',
            memo: 'NewChat',
        });
    }

    // 첫 메시지
    if (nowChatroom.type !== 'group') {
        const firstMsg = currentChatData.fmIndex === -1 
            ? nowChatroom.firstMessage 
            : (nowChatroom.alternateGreetings?.[currentChatData.fmIndex] || nowChatroom.firstMessage);

        const processedFirstMsg = await processScript(
            nowChatroom,
            risuChatParser(firstMsg, { chara: currentChar }, parserContexts),
            'editprocess',
            context
        );
        
        const chat: OpenAIChat = {
            role: 'assistant',
            content: processedFirstMsg,
        };

        if (usingPromptTemplate && database.promptSettings?.sendName) {
            chat.content = `${currentChar.name}: ${chat.content}`;
            chat.attr = ['nameAdded'];
        }
        chats.push(chat);
    }

    // 트리거 실행 (start)
    const triggerResult = await runTrigger(currentChar, 'start', {
        chat: currentChatData,
        database,
        tokenizerContext,
        userId: context.userId,
        characterId: context.characterId,
        chatId: context.chatId,
    });

    if (triggerResult) {
        currentChatData = triggerResult.chat || currentChatData;
        if (triggerResult.stopSending) {
            return {
                success: false,
                error: 'Trigger stopped sending',
            };
        }
    }

    // 메시지 포맷팅
    let index = 0;
    for (const msg of currentChatData.message) {
        if (msg.disabled === true) {
            continue;
        }
        if (msg.disabled === 'allBefore') {
            break;
        }

        let formatedChat = (
            await processScriptFull(
                nowChatroom,
                risuChatParser(msg.data, { chara: currentChar, role: msg.role }, parserContexts),
                'editprocess',
                context,
                index,
                {
                    chatRole: msg.role,
                }
            )
        ).data;

        let name = '';
        if (msg.role === 'char') {
            if (msg.saying) {
                name = `${findCharacterbyIdwithCache(msg.saying)?.name || currentChar.name}`;
            } else {
                name = `${currentChar.name}`;
            }
        } else if (msg.role === 'user') {
            name = `${context.getUserName()}`;
        }

        let inlays: string[] = [];
        if (msg.role === 'char') {
            formatedChat = formatedChat.replace(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g, (match: string, p1: string, p2: string) => {
                if (p2 && p1 === 'inlayeddata') {
                    inlays.push(p2);
                }
                return '';
            });
        } else {
            const inlayMatch = formatedChat.match(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g);
            if (inlayMatch) {
                for (const inlay of inlayMatch) {
                    inlays.push(inlay);
                }
            }
        }

        let multimodal: any[] = [];
        const modelinfo = await getModelInfo(database.aiModel, context.userId);
        if (inlays.length > 0) {
            for (const inlay of inlays) {
                const inlayName = inlay.replace('{{inlayed::', '').replace('{{inlay::', '').replace('}}', '');
                const inlayData = await getInlayAsset(context.userId, inlayName);
                if (inlayData?.type === 'image') {
                    if (modelinfo.flags.includes(LLMFlags.hasImageInput)) {
                        multimodal.push({
                            type: 'image',
                            base64: inlayData.data,
                            width: inlayData.width,
                            height: inlayData.height,
                        });
                    } else {
                        const captionResult = await runImageEmbedding(inlayData.data);
                        formatedChat += `[${captionResult[0].generated_text}]`;
                    }
                }
                if (inlayData?.type === 'video' || inlayData?.type === 'audio') {
                    if (multimodal.length === 0) {
                        multimodal.push({
                            type: inlayData.type,
                            base64: inlayData.data,
                        });
                    }
                }
                formatedChat = formatedChat.replace(inlay, '');
            }
        }

        let role: 'user' | 'assistant' | 'system' = msg.role === 'user' ? 'user' : 'assistant';
        
        // 그룹 채팅 메시지 포맷팅
        if (
            (nowChatroom.type === 'group' && msg.saying && findCharacterbyIdwithCache(msg.saying)?.chaId !== currentChar.chaId) ||
            (nowChatroom.type === 'group' && database.groupOtherBotRole === 'assistant') ||
            (usingPromptTemplate && database.promptSettings?.sendName)
        ) {
            const sayingChar = msg.saying ? findCharacterbyIdwithCache(msg.saying) : null;
            if (sayingChar) {
                const form = database.groupTemplate || `<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`;
                formatedChat = risuChatParser(form, { chara: sayingChar }, parserContexts).replace('{{slot}}', formatedChat);
            }
            switch (database.groupOtherBotRole) {
                case 'user':
                case 'assistant':
                case 'system':
                    role = database.groupOtherBotRole;
                    break;
                default:
                    role = 'assistant';
                    break;
            }
        }
        
        let thoughts: string[] = [];
        const maxThoughtDepth = database.promptSettings?.maxThoughtTagDepth ?? -1;
        formatedChat = formatedChat.replace(/<Thoughts>(.+)<\/Thoughts>/gms, (match, p1) => {
            if (maxThoughtDepth === -1 || maxThoughtDepth - currentChatData.message.length <= index) {
                thoughts.push(p1);
            }
            return '';
        });

        const chat: OpenAIChat = {
            role: role,
            content: formatedChat,
            memo: msg.chatId || uuidv4(),
            multimodals: multimodal.length > 0 ? multimodal : undefined,
            thoughts: thoughts.length > 0 ? thoughts : undefined,
        };
        chats.push(chat);
        index++;
    }

    // 메모리 시스템 통합
    let memories: OpenAIChat[] = [];
    if (nowChatroom.supaMemory && (database.supaModelType !== 'none' || database.hanuraiEnable || database.hypav2 || database.hypaV3)) {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start;
        stageTimings.stage2Start = Date.now();
        
        if (database.hanuraiEnable) {
            const hn = await hanuraiMemory(
                chats,
                {
                    currentTokens,
                    maxContextTokens,
                    tokenizer: context.chatTokenizer,
                    tokenizerContext,
                },
                database,
                userId
            );
            
            if (hn === false) {
                return {
                    success: false,
                    error: 'HanuraiMemory processing failed',
                };
            }
            
            chats = hn.chats;
            currentTokens = hn.tokens;
        } else if (database.hypav2) {
            const sp = await hypaMemoryV2(
                chats,
                currentTokens,
                maxContextTokens,
                currentChatData,
                nowChatroom,
                context.chatTokenizer,
                tokenizerContext,
                database,
                userId
            );
            
            if (sp.error) {
                console.error('[HypaMemoryV2 Error]', sp.error);
                return {
                    success: false,
                    error: sp.error,
                };
            }
            
            chats = sp.chats;
            currentTokens = sp.currentTokens;
            if (sp.memory) {
                currentChatData.hypaV2Data = sp.memory;
                await updateContextChat(context, (chat) => {
                    chat.hypaV2Data = sp.memory;
                    return chat;
                });
            }
        } else if (database.hypaV3) {
            const sp = await hypaMemoryV3(
                chats,
                currentTokens,
                maxContextTokens,
                currentChatData,
                nowChatroom,
                context.chatTokenizer,
                tokenizerContext,
                database,
                userId
            );
            
            if (sp.error) {
                // Save new summary
                if (sp.memory) {
                    currentChatData.hypaV3Data = sp.memory;
                    await updateContextChat(context, (chat) => {
                        chat.hypaV3Data = sp.memory;
                        return chat;
                    });
                }
                console.error('[HypaMemoryV3 Error]', sp.error);
                return {
                    success: false,
                    error: sp.error,
                };
            }
            
            chats = sp.chats;
            currentTokens = sp.currentTokens;
            if (sp.memory) {
                currentChatData.hypaV3Data = sp.memory;
                await updateContextChat(context, (chat) => {
                    chat.hypaV3Data = sp.memory;
                    return chat;
                });
            }
        } else {
            const sp = await supaMemory(
                chats,
                currentTokens,
                maxContextTokens,
                currentChatData,
                nowChatroom,
                context.chatTokenizer,
                tokenizerContext,
                {
                    asHyper: database.hypaMemory,
                },
                database,
                userId
            );
            
            if (sp.error) {
                console.error('[SupaMemory Error]', sp.error);
                return {
                    success: false,
                    error: sp.error,
                };
            }
            
            chats = sp.chats;
            currentTokens = sp.currentTokens;
            if (sp.memory) {
                currentChatData.supaMemoryData = sp.memory;
                await updateContextChat(context, (chat) => {
                    chat.supaMemoryData = sp.memory;
                    return chat;
                });
            }
            if (sp.lastId) {
                currentChatData.lastMemory = sp.lastId;
                await updateContextChat(context, (chat) => {
                    chat.lastMemory = sp.lastId;
                    return chat;
                });
            }
        }
        
        stageTimings.stage2Duration = Date.now() - stageTimings.stage2Start;
    } else {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start;
        
        // 토큰 제한 처리
        while (currentTokens > maxContextTokens) {
            if (chats.length <= 1) {
                return {
                    success: false,
                    error: `Too much token required. Required Tokens: ${currentTokens}`,
                };
            }
            
            currentTokens -= await context.chatTokenizer.tokenizeChat(chats[0], tokenizerContext);
            chats.splice(0, 1);
        }
        
        if (chats.length > 0) {
            currentChatData.lastMemory = chats[0].memo;
        }
    }
    
    // Biases 처리
    let biases: [string, number][] = database.bias.concat(currentChar.bias).map((v) => {
        return [
            risuChatParser(
                v[0].replaceAll('\\n', '\n').replaceAll('\\r', '\r').replaceAll('\\\\', '\\'),
                { chara: currentChar },
                parserContexts
            ),
            v[1]
        ];
    });
    
    // 프롬프트 템플릿 최종 포맷팅 준비
    if (!promptTemplate) {
        unformated.lastChat.push(chats[chats.length - 1]);
        chats.splice(chats.length - 1, 1);
    }
    
    unformated.chats = chats.map((v) => {
        if (v.memo !== 'supaMemory' && v.memo !== 'hypaMemory') {
            v.removable = true;
        } else if (supaMemoryCardUsed) {
            memories.push(v);
            return {
                role: 'system',
                content: '',
            } as OpenAIChat;
        } else {
            v.content = `<Previous Conversation>${v.content}</Previous Conversation>`;
        }
        return v;
    }).filter((v) => {
        return v.content.trim() !== '' || (v.multimodals && v.multimodals.length > 0);
    });
    
    // Depth prompts를 unformated.chats에 삽입
    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }, parserContexts)
        };
        const depth = depthPrompt.pos === 'depth' 
            ? depthPrompt.depth 
            : (unformated.chats.length - depthPrompt.depth);
        unformated.chats.splice(depth, 0, chat);
    }
    
    // Trigger 결과를 unformated에 추가
    if (triggerResult) {
        if (triggerResult.additonalSysPrompt?.promptend) {
            unformated.postEverything.push({
                role: 'system',
                content: triggerResult.additonalSysPrompt.promptend
            });
        }
        if (triggerResult.additonalSysPrompt?.historyend) {
            unformated.lastChat.push({
                role: 'system',
                content: triggerResult.additonalSysPrompt.historyend
            });
        }
        if (triggerResult.additonalSysPrompt?.start) {
            unformated.lastChat.unshift({
                role: 'system',
                content: triggerResult.additonalSysPrompt.start
            });
        }
    }
    
    // Continue chat 모델 처리
    if (arg.continue && (database.aiModel.startsWith('claude') || database.aiModel.startsWith('gpt') || database.aiModel === 'openrouter' || database.aiModel === 'reverse_proxy')) {
        unformated.postEverything.push({
            role: 'system',
            content: '[Continue the last response]'
        });
    }
    
    // systemizeChat 함수
    const systemizeChat = (chat: OpenAIChat[]): OpenAIChat[] => {
        for (let i = 0; i < chat.length; i++) {
            if (chat[i].role === 'user' || chat[i].role === 'assistant') {
                const attr = chat[i].attr ?? [];
                if (chat[i].name?.startsWith('example_')) {
                    chat[i].content = chat[i].name + ': ' + chat[i].content;
                } else if (!attr.includes('nameAdded')) {
                    chat[i].content = chat[i].role + ': ' + chat[i].content;
                }
                chat[i].role = 'system';
            }
        }
        return chat;
    };
    
    // 프롬프트 템플릿 최종 포맷팅
    if (promptTemplate) {
        const template = promptTemplate;
        
        for (const card of template) {
            switch (card.type) {
                case 'persona': {
                    let pmt = JSON.parse(JSON.stringify(unformated.personaPrompt));
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(
                                positionParser(card.innerFormat, card.type),
                                { chara: currentChar },
                                parserContexts
                            ).replace('{{slot}}', pmt[i].content);
                        }
                    }
                    pushPrompts(pmt);
                    break;
                }
                case 'description': {
                    let pmt = JSON.parse(JSON.stringify(unformated.description));
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(
                                positionParser(card.innerFormat, card.type),
                                { chara: currentChar },
                                parserContexts
                            ).replace('{{slot}}', pmt[i].content);
                        }
                    }
                    pushPrompts(pmt);
                    break;
                }
                case 'authornote': {
                    let pmt = JSON.parse(JSON.stringify(unformated.authorNote));
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(
                                positionParser(card.innerFormat, card.type),
                                { chara: currentChar },
                                parserContexts
                            ).replace('{{slot}}', pmt[i].content || card.defaultText || '');
                        }
                    }
                    pushPrompts(pmt);
                    break;
                }
                case 'lorebook': {
                    pushPrompts(unformated.lorebook);
                    break;
                }
                case 'postEverything': {
                    pushPrompts(unformated.postEverything);
                    if (usingPromptTemplate && database.promptSettings?.postEndInnerFormat) {
                        pushPrompts([{
                            role: 'system',
                            content: database.promptSettings.postEndInnerFormat
                        }]);
                    }
                    break;
                }
                case 'plain':
                case 'jailbreak':
                case 'cot': {
                    if ((!database.jailbreakToggle) && (card.type === 'jailbreak')) {
                        continue;
                    }
                    if ((!database.chainOfThought) && (card.type === 'cot')) {
                        continue;
                    }
                    
                    const convertRole = {
                        "system": "system",
                        "user": "user",
                        "bot": "assistant"
                    } as const;
                    
                    const posType = card.type === 'plain' ? card.type2 : card.type;
                    let content = positionParser(card.text || '', posType || '');
                    
                    if (card.type2 === 'globalNote') {
                        if (currentChar.replaceGlobalNote) {
                            content = positionParser(currentChar.replaceGlobalNote, posType || '').replaceAll('{{original}}', content);
                        }
                        if (currentChar.prebuiltAssetCommand && !card.text?.includes('{{//@customimageinstruction}}')) {
                            content += prebuiltAssetCommand;
                        }
                        content = risuChatParser(content, { chara: currentChar, role: card.role }, parserContexts);
                    } else if (card.type2 === 'main') {
                        content = risuChatParser(content, { chara: currentChar, role: card.role }, parserContexts);
                    } else {
                        content = risuChatParser(content, { chara: currentChar, role: card.role }, parserContexts);
                    }
                    
                    const prompt: OpenAIChat = {
                        role: convertRole[card.role || 'system'],
                        content: content
                    };
                    
                    pushPrompts([prompt]);
                    break;
                }
                case 'chatML': {
                    let prompts = parseChatML(card.text || '', parserContexts);
                    if (prompts) {
                        pushPrompts(prompts);
                    }
                    break;
                }
                case 'chat': {
                    let start = card.rangeStart ?? 0;
                    let end = (card.rangeEnd === 'end') ? unformated.chats.length : (card.rangeEnd ?? unformated.chats.length);
                    if (start === -1000) {
                        start = 0;
                        end = unformated.chats.length;
                    }
                    if (start < 0) {
                        start = unformated.chats.length + start;
                        if (start < 0) {
                            start = 0;
                        }
                    }
                    if (end < 0) {
                        end = unformated.chats.length + end;
                        if (end < 0) {
                            end = 0;
                        }
                    }
                    
                    if (start >= end) {
                        break;
                    }
                    let chatSlice = unformated.chats.slice(start, end);
                    
                    if (usingPromptTemplate && database.promptSettings?.sendChatAsSystem && (!card.chatAsOriginalOnSystem)) {
                        chatSlice = systemizeChat(chatSlice);
                    }
                    pushPrompts(chatSlice);
                    
                    // Automatic cache point 처리
                    if (database.automaticCachePoint && !hasCachePoint) {
                        let pointer = formated.length - 1;
                        let depthRemaining = 3;
                        while (pointer >= 0) {
                            if (depthRemaining === 0) {
                                break;
                            }
                            if (formated[pointer].role === 'user') {
                                formated[pointer].cachePoint = true;
                                depthRemaining--;
                            }
                            pointer--;
                        }
                    }
                    break;
                }
                case 'cache': {
                    let pointer = formated.length - 1;
                    let depthRemaining = card.depth;
                    while (pointer >= 0) {
                        if (depthRemaining === 0) {
                            break;
                        }
                        if (formated[pointer].role === card.role || card.role === 'all') {
                            formated[pointer].cachePoint = true;
                            depthRemaining--;
                        }
                        pointer--;
                    }
                    break;
                }
            }
        }
    } else {
        // 프롬프트 템플릿이 없는 경우 formatOrder 사용
        const formatOrder = database.formatingOrder ? JSON.parse(JSON.stringify(database.formatingOrder)) : null;
        if (formatOrder) {
            formatOrder.push('postEverything');
            for (let i = 0; i < formatOrder.length; i++) {
                const cha = unformated[formatOrder[i] as keyof UnformatedPrompts] as OpenAIChat[];
                pushPrompts(cha);
            }
        } else {
            // 기본 순서
            pushPrompts(unformated.main);
            pushPrompts(unformated.jailbreak);
            pushPrompts(unformated.globalNote);
            pushPrompts(unformated.description);
            pushPrompts(unformated.authorNote);
            pushPrompts(unformated.personaPrompt);
            pushPrompts(unformated.lorebook);
            pushPrompts(unformated.chats);
            pushPrompts(unformated.lastChat);
            pushPrompts(unformated.postEverything);
        }
    }
    
    // formated 배열 정리
    formated = formated.map((v) => {
        v.content = v.content.trim();
        return v;
    });
    
    // depth_prompt 처리
    if (currentChar.depth_prompt && currentChar.depth_prompt.prompt && currentChar.depth_prompt.prompt.length > 0) {
        const depthPrompt = currentChar.depth_prompt;
        formated.splice(formated.length - depthPrompt.depth, 0, {
            role: 'system',
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }, parserContexts)
        });
    }
    
    // runLuaEditTrigger (editRequest)
    formated = await runLuaEditTrigger(
        context.userId,
        context.currentCharacterId || '',
        context.currentChatId || '',
        currentChar,
        'editRequest',
        formated,
        database,
        tokenizerContext
    );
    
    // 토큰 재계산 및 제거
    let inputTokens = 0;
    for (const chat of formated) {
        inputTokens += await context.chatTokenizer.tokenizeChat(chat, tokenizerContext);
    }
    
    if (inputTokens > maxContextTokens) {
        let pointer = 0;
        while (inputTokens > maxContextTokens) {
            if (pointer >= formated.length) {
                return {
                    success: false,
                    error: `Too much token at token rechecking. Required Tokens: ${inputTokens}`,
                };
            }
            if (formated[pointer].removable) {
                inputTokens -= await context.chatTokenizer.tokenizeChat(formated[pointer], tokenizerContext);
                formated[pointer].content = '';
            }
            pointer++;
        }
        formated = formated.filter((v) => {
            return v.content !== '' || (v.multimodals && v.multimodals.length > 0);
        });
    }
    
    // Output tokens 추정
    let outputTokens = database.maxResponse;
    if (inputTokens + outputTokens > maxContextTokens) {
        outputTokens = maxContextTokens - inputTokens;
    }
    
    stageTimings.stage3Start = Date.now();
    const generationId = uuidv4();
    const generationModel = getGenerationModelString(database);
    
    // Preview 모드
    if (arg.preview) {
        return {
            success: true,
            previewFormated: formated,
        };
    }

    const generationInfo: MessageGenerationInfo = {
        model: generationModel,
        generationId: generationId,
        inputTokens: inputTokens,
        outputTokens: database.maxResponse,
        maxContext: maxContextTokens,
        stageTiming: {
            stage1: stageTimings.stage1Duration,
            stage2: stageTimings.stage2Duration,
            stage3: 0,
            stage4: 0,
        },
    };

    const req = await requestChatData(
        {
            formated: formated, // formated 배열 사용
            bias: biases,
            useStreaming: true,
            noMultiGen: true,
            continue: arg.continue,
            currentChar: currentChar,
            isGroupChat: nowChatroom.type === 'group',
            chatId: generationId,
            imageResponse: database.outputImageModal,
            previewBody: arg.previewPrompt,
            escape: nowChatroom.type === 'character' && nowChatroom.escapeOutput,
            rememberToolUsage: database.rememberToolUsage,
        },
        'model',
        database,
        abortSignal,
        userId
    );

    if (req.type === 'fail') {
        return {
            success: false,
            error: req.result,
        };
    }

    if (arg.previewPrompt && req.type === 'success') {
        return {
            success: true,
            previewBody: req.result,
        };
    }

    // 스트리밍 처리 및 후처리
    let result = '';
    let emoChanged = false;
    let resendChat = false;
    
    if (abortSignal?.aborted === true) {
        return {
            success: false,
            error: 'Request aborted',
        };
    }
    
    // reformatContent 함수
    const reformatContent = (data: string): string => {
        return data.trim();
    };
    
    if (req.type === 'streaming') {
        // 스트리밍 처리
        const reader = req.result.getReader();
        let msgIndex = currentChatData.message.length;
        let prefix = '';
        
        if (arg.continue) {
            msgIndex -= 1;
            prefix = currentChatData.message[msgIndex]?.data || '';
        } else {
            // 새 메시지 추가
            currentChatData.message.push({
                role: 'char',
                data: '',
                saying: currentChar.chaId,
                time: Date.now(),
                generationInfo,
                chatId: generationId,
            });
        }
        
        let lastResponseChunk: { [key: string]: string } = {};
        
        while (abortSignal?.aborted === false) {
            const readed = await reader.read();
            if (readed.value) {
                lastResponseChunk = readed.value;
                const firstChunkKey = Object.keys(lastResponseChunk)[0];
                result = lastResponseChunk[firstChunkKey] || '';
                
                if (database.removeIncompleteResponse) {
                    result = trimUntilPunctuation(result);
                }
                
                let result2 = await processScriptFull(
                    nowChatroom,
                    reformatContent(prefix + result),
                    'editoutput',
                    context,
                    msgIndex
                );
                
                currentChatData.message[msgIndex].data = result2.data;
                emoChanged = result2.emoChanged;
                
                // 스트리밍 콜백 호출 (WebSocket 등)
                if (arg.streamingCallback) {
                    try {
                        await arg.streamingCallback(lastResponseChunk);
                    } catch (error) {
                        console.error('[Streaming] Callback error:', error);
                    }
                }
                
                // 스트리밍 중 데이터베이스 업데이트 (최적화를 위해 주기적으로만 저장)
                if (msgIndex % 5 === 0) { // 5개 메시지마다 저장
                    await updateContextChat(context, (chat) => {
                        chat.message[msgIndex].data = result2.data;
                        return chat;
                    });
                }
            }
            
            if (readed.done) {
                break;
            }
        }
        
        // addRerolls 처리
        await addRerolls(generationId, Object.values(lastResponseChunk), userId);
        
        // runCurrentChatFunction 처리
        currentChatData = runCurrentChatFunction(currentChatData);
        
        // Trigger 실행 (output)
        const outputTriggerResult = await runTrigger(currentChar, 'output', {
            chat: currentChatData,
            database,
            tokenizerContext,
            userId: context.userId,
            characterId: context.characterId,
            chatId: context.chatId,
        });
        
        if (outputTriggerResult) {
            if (outputTriggerResult.chat) {
                currentChatData = outputTriggerResult.chat;
            }
            if (outputTriggerResult.sendAIprompt) {
                resendChat = true;
            }
        }
        
        // 스트리밍 완료 후 최종 저장
        await updateContextChat(context, (chat) => {
            chat.message = currentChatData.message;
            chat.isStreaming = false;
            return chat;
        });
        
        // runInlayScreen 처리
        const inlayr = await runInlayScreen(currentChar, currentChatData.message[msgIndex].data, database, userId);
        currentChatData.message[msgIndex].data = inlayr.text;
        if (inlayr.promise) {
            const t = await inlayr.promise;
            currentChatData.message[msgIndex].data = t;
            await updateContextChat(context, (chat) => {
                chat.message[msgIndex].data = t;
                return chat;
            });
        }
        
        // TTS 처리
        if (database.ttsAutoSpeech) {
            const ttsResult = await sayTTS(currentChar, result, database, context.userId);
            // 서버 사이드에서는 오디오 데이터를 반환만 하고, 실제 재생은 클라이언트에서 처리
            if (ttsResult.audioData) {
                // TODO: 클라이언트로 오디오 데이터 전송 (WebSocket 또는 응답에 포함)
                console.log('[TTS] Audio data generated:', ttsResult.audioData.substring(0, 50) + '...');
            }
        }
    } else if (req.type === 'success' || req.type === 'multiline') {
        // 비스트리밍 처리
        const msgs = req.type === 'success' 
            ? [['char', req.result] as const]
            : req.type === 'multiline'
            ? req.result
            : [];
        
        let mrerolls: string[] = [];
        
        for (let i = 0; i < msgs.length; i++) {
            let msg = msgs[i];
            let mess = msg[1];
            let msgIndex = currentChatData.message.length;
            
            let result2 = await processScriptFull(
                nowChatroom,
                reformatContent(mess),
                'editoutput',
                context,
                msgIndex
            );
            
            if (i === 0 && arg.continue) {
                msgIndex -= 1;
                let beforeChat = currentChatData.message[msgIndex];
                result2 = await processScriptFull(
                    nowChatroom,
                    reformatContent(beforeChat.data + mess),
                    'editoutput',
                    context,
                    msgIndex
                );
            }
            
            if (database.removeIncompleteResponse) {
                result2.data = trimUntilPunctuation(result2.data);
            }
            
            result = result2.data;
            emoChanged = result2.emoChanged;
            
            // runInlayScreen 처리
            const inlayResult = await runInlayScreen(currentChar, result, database, userId);
            result = inlayResult.text;
            if (inlayResult.promise) {
                const processedResult = await inlayResult.promise;
                result = processedResult;
            }
            
            if (i === 0 && arg.continue) {
                currentChatData.message[msgIndex] = {
                    ...currentChatData.message[msgIndex],
                    data: result,
                };
            } else {
                currentChatData.message.push({
                    role: 'char',
                    data: result,
                    saying: currentChar.chaId,
                    time: Date.now(),
                    generationInfo,
                    chatId: generationId,
                });
            }
            
            mrerolls.push(result);
        }
        
        // addRerolls 처리
        if (mrerolls.length > 0) {
            await addRerolls(generationId, mrerolls, userId);
        }
        
        // runCurrentChatFunction 처리
        currentChatData = runCurrentChatFunction(currentChatData);
        
        // Trigger 실행 (output)
        const outputTriggerResult = await runTrigger(currentChar, 'output', {
            chat: currentChatData,
            database,
            tokenizerContext,
            userId: context.userId,
            characterId: context.characterId,
            chatId: context.chatId,
        });
        
        if (outputTriggerResult) {
            if (outputTriggerResult.chat) {
                currentChatData = outputTriggerResult.chat;
            }
            if (outputTriggerResult.sendAIprompt) {
                resendChat = true;
            }
        }
        
        // 비스트리밍 완료 후 최종 저장
        await updateContextChat(context, (chat) => {
            chat.message = currentChatData.message;
            return chat;
        });
        
        // TTS 처리
        if (database.ttsAutoSpeech && result) {
            const ttsResult = await sayTTS(currentChar, result, database, context.userId);
            if (ttsResult.audioData) {
                // TODO: 클라이언트로 오디오 데이터 전송
                console.log('[TTS] Audio data generated');
            }
        }
    }
    
    // 최종 데이터베이스 저장
    await updateContextChat(context, (chat) => {
        chat.message = currentChatData.message;
        chat.note = currentChatData.note;
        chat.localLore = currentChatData.localLore;
        chat.sdData = currentChatData.sdData;
        chat.supaMemoryData = currentChatData.supaMemoryData;
        chat.hypaV2Data = currentChatData.hypaV2Data;
        chat.hypaV3Data = currentChatData.hypaV3Data;
        chat.lastMemory = currentChatData.lastMemory;
        chat.suggestMessages = currentChatData.suggestMessages;
        chat.isStreaming = false;
        chat.scriptstate = currentChatData.scriptstate;
        chat.modules = currentChatData.modules;
        return chat;
    });
    
    stageTimings.stage3Duration = Date.now() - stageTimings.stage3Start;
    stageTimings.stage4Start = Date.now();
    stageTimings.stage4Duration = Date.now() - stageTimings.stage4Start;
    
    if (generationInfo.stageTiming) {
        generationInfo.stageTiming.stage3 = stageTimings.stage3Duration;
        generationInfo.stageTiming.stage4 = stageTimings.stage4Duration;
    }
    
    generationInfo.inputTokens = inputTokens;
    generationInfo.outputTokens = outputTokens;
    
    // 모델 정보 업데이트
    if (req.model) {
        generationInfo.model = getGenerationModelString(database, req.model);
    }
    
    // Auto Continue Chat 처리
    let needsAutoContinue = false;
    // tokenize 함수는 문자열과 context를 받음
    // ChatTokenizer의 tokenizeChat 메서드 사용
    const resultTokens = await context.chatTokenizer.tokenizeChat(
        { role: 'assistant', content: result },
        tokenizerContext
    ) + (arg.usedContinueTokens || 0);
    
    if (database.autoContinueMinTokens > 0 && resultTokens < database.autoContinueMinTokens) {
        needsAutoContinue = true;
    }
    
    if (database.autoContinueChat && !isLastCharPunctuation(result)) {
        // 결과가 구두점이나 특수 문자로 끝나지 않으면 자동 계속
        needsAutoContinue = true;
    }
    
    if (needsAutoContinue) {
        // 재귀적으로 sendChat 호출 (continue 모드)
        return await sendChat(
            context,
            chatProcessIndex,
            {
                ...arg,
                continue: true,
                usedContinueTokens: resultTokens,
            }
        );
    }
    
    // IGP (Image Generation Prompt) 처리
    if (database.igpPrompt) {
        const igp = risuChatParser(database.igpPrompt, { chara: currentChar }, parserContexts);
        if (igp) {
            const igpFormated = parseChatML(igp, parserContexts);
            if (igpFormated && igpFormated.length > 0) {
                const rq = await requestChatData(
                    {
                        formated: igpFormated,
                        bias: {},
                    },
                    'emotion',
                    database,
                    abortSignal,
                    userId
                );
                
                if (rq.type === 'success' && currentChatData.message.length > 0) {
                    const lastMessage = currentChatData.message[currentChatData.message.length - 1];
                    lastMessage.data += rq.result;
                    await updateContextChat(context, (chat) => {
                        if (chat.message.length > 0) {
                            chat.message[chat.message.length - 1].data = lastMessage.data;
                        }
                        return chat;
                    });
                }
            }
        }
    }
    
    // resendChat 처리
    if (resendChat) {
        return await sendChat(
            context,
            chatProcessIndex,
            {
                ...arg,
                signal: abortSignal,
            }
        );
    }
    
    return {
        success: true,
        generationInfo,
        resendChat,
        emoChanged,
    };
}
