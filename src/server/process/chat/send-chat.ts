/**
 * 메인 채팅 처리 함수
 * 원본: src/ts/process/index.svelte.ts의 sendChat 함수
 * 
 * TODO: 전체 구현 필요 - 현재는 기본 구조만 제공
 * 파일이 매우 크므로 (1971 lines) 단계적으로 구현 필요
 */

import type { character, Chat, Database, MessageGenerationInfo, MessagePresetInfo } from '../../database';
import type { OpenAIChat } from '../types';
import type { SendChatArg, SendChatResult, UnformatedPrompts, StageTimings } from './types';
import type { ProcessContext } from '../context';
import type { TokenizerContext } from '../../tokenizer';
import { v4 as uuidv4 } from 'uuid';
import { risuChatParser, parseChatML } from '../../parser';
import { createParserContexts } from '../parser-context';
import { loadLoreBookV3Prompt } from '../lorebook';
import { runTrigger } from '../trigger';
import { requestChatData } from '../request';
import { tokenize } from '../../tokenizer';
// TODO: 아래 함수들을 서버 사이드로 마이그레이션 필요
import { exampleMessage } from '../example-messages';
import { processScript, processScriptFull } from '../auxiliary/scripts';
import { runLuaEditTrigger } from '../scripting';
import { supaMemory } from '../memory/supa-memory';
import { hanuraiMemory } from '../memory/hanurai-memory';
import { hypaMemoryV2 } from '../../../ts/process/memory/hypav2';
import { hypaMemoryV3 } from '../../../ts/process/memory/hypav3';
// Util functions are now available via ProcessContext
// import { getPersonaPrompt, getUserName, getAuthorNoteDefaultText, findCharacterbyId, parseToggleSyntax, prebuiltAssetCommand } from '../../util';
import { parseToggleSyntax, prebuiltAssetCommand } from '../../util';
import { additionalInformations } from '../auxiliary/additional-info';
import { getInlayAsset } from '../auxiliary/file-processing';
import { getGenerationModelString } from '../auxiliary/model-string';
import { getModuleAssets, getModuleToggles, getModuleLorebooks } from '../auxiliary/modules';
import { readImage } from '../../../ts/globalApi.svelte';
import { asBuffer } from '../../util';
import { getModelInfo } from '../../model/modellist-server';
import { LLMFlags } from '../../model/modellist';
import { runImageEmbedding } from '../auxiliary/image-embedding';
import { HypaProcessor } from '../memory/hypa-processor';

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

    // TokenizerContext는 context에서 가져오거나 생성
    // TODO: ProcessContext에 tokenizerContext 추가 필요
    const tokenizerContext = context as any; // 임시 처리

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
    database.statics.messages += 1;
    const nowChatroom = currentCharacter;
    nowChatroom.lastInteraction = Date.now();

    let currentChar: character;
    let calculatedChatTokens = 0;
    if (database.aiModel.startsWith('gpt')) {
        calculatedChatTokens += 5;
    } else {
        calculatedChatTokens += 3;
    }

    // 그룹 채팅 처리
    if (nowChatroom.type === 'group') {
        // TODO: 그룹 채팅 처리
        return {
            success: false,
            error: 'Group chat not implemented yet',
        };
    } else {
        currentChar = nowChatroom;
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

    // TODO: 프롬프트 템플릿 처리, 토큰 계산, 메모리 시스템 처리 등
    // 현재는 기본 구조만 제공

    // 예제 메시지
    const examples = exampleMessage(currentChar, context.getUserName(), context);
    let chats: OpenAIChat[] = examples;

    if (!database.aiModel.startsWith('novelai') || database.promptSettings?.trimStartNewChat) {
        chats.push({
            role: 'system',
            content: '[Start a new chat]',
            memo: 'NewChat',
        });
    }

    // 첫 메시지
    if (nowChatroom.type !== 'group') {
        const firstMsg = currentChatData.fmIndex === -1 ? nowChatroom.firstMessage : nowChatroom.alternateGreetings[currentChatData.fmIndex];

        const chat: OpenAIChat = {
            role: 'assistant',
            content: await processScript(
                nowChatroom,
                risuChatParser(firstMsg, { chara: currentChar }, parserContexts),
                'editprocess',
                context
            ),
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
        userId: context.userId || '',
        characterId: context.currentCharacterId || '',
        chatId: context.currentChatId || '',
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
        const modelinfo = await getModelInfo(database.aiModel, userId);
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

    // TODO: 프롬프트 템플릿 처리, 메모리 시스템 처리, 토큰 재계산 등

    // API 요청
    if (arg.preview) {
        return {
            success: true,
            previewFormated: chats,
        };
    }

    stageTimings.stage3Start = Date.now();
    const generationId = uuidv4();
    const generationModel = getGenerationModelString(database);

    const generationInfo: MessageGenerationInfo = {
        model: generationModel,
        generationId: generationId,
        inputTokens: 0, // TODO: 계산
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
            formated: chats,
            bias: {},
            useStreaming: true,
            noMultiGen: true,
            continue: arg.continue,
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

    // TODO: 스트리밍 처리, 후처리 등

    stageTimings.stage4Duration = Date.now() - stageTimings.stage4Start;
    if (generationInfo.stageTiming) {
        generationInfo.stageTiming.stage3 = stageTimings.stage3Duration;
        generationInfo.stageTiming.stage4 = stageTimings.stage4Duration;
    }

    return {
        success: true,
        generationInfo,
    };
}
