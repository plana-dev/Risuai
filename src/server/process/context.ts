/**
 * Process 컨텍스트 생성 및 관리
 */

import type { ProcessContext } from './types';
import { getDatabaseAdapter } from '../database-adapter';
import { getAssetService } from '../asset-service';
import { getRedisService } from '../redis-service';
import { getModelInfo } from '../model/modellist-server';
import { getCharacter, getChat } from '../database';
import type { Database, character, groupChat, Chat } from '../database';
import type { LLMModel } from '../model/types';
import { ChatTokenizer } from '../tokenizer/chat-tokenizer';
import type { TokenizerContext } from '../tokenizer/types';
import {
    getUserName as getUserNameUtil,
    getUserIcon as getUserIconUtil,
    getPersonaPrompt as getPersonaPromptUtil,
    getAuthorNoteDefaultText as getAuthorNoteDefaultTextUtil,
    findCharacterbyId as findCharacterbyIdUtil,
} from '../util/database';

/**
 * ProcessContext 생성
 */
export async function createProcessContext(
    userId: string,
    characterId: string,
    chatId: string,
    options?: {
        chatAdditionalTokens?: number;
        continue?: boolean;
        usedContinueTokens?: number;
        preview?: boolean;
        previewPrompt?: boolean;
        signal?: AbortSignal;
    }
): Promise<ProcessContext> {
    const databaseAdapter = getDatabaseAdapter();
    const assetService = getAssetService();
    const redisService = getRedisService();

    // 데이터베이스 로드
    const database = await databaseAdapter.loadUserDatabase(userId);

    // 캐릭터 및 채팅 로드
    const character = await databaseAdapter.loadCharacter(userId, characterId);
    const chat = await databaseAdapter.loadChat(userId, chatId);

    if (!character) {
        throw new Error(`Character not found: ${characterId}`);
    }

    if (!chat) {
        throw new Error(`Chat not found: ${chatId}`);
    }

    // 모델 정보 가져오기
    const modelInfo = await getModelInfo(database.aiModel, userId);

    // TokenizerContext 생성
    const tokenizerContext: TokenizerContext = {
        userId,
        database,
        modelInfo,
        customTokenizer: database.customTokenizer,
        currentPluginProvider: database.currentPluginProvider,
        googleClaudeTokenizing: database.googleClaudeTokenizing,
        pluginTokenizer: undefined, // TODO: 플러그인 토크나이저 가져오기
        useTokenizerCaching: database.useTokenizerCaching,
    };

    // ChatTokenizer 생성
    const chatAdditionalTokens = database.aiModel.startsWith('gpt') ? 5 : 3;
    const chatTokenizer = new ChatTokenizer(chatAdditionalTokens, 'name');

    // 선택된 캐릭터/채팅 인덱스 찾기
    const selectedCharIndex = database.characters.findIndex(c => c.chaId === characterId);
    const selectedChatIndex = character.chats.findIndex(c => c.chatId === chatId);

    // 유틸리티 함수들 생성 (동기 버전 - 이미 로드된 database 사용)
    const getUserName = (): string => {
        // 바인딩된 페르소나 확인
        if (chat.bindedPersona) {
            const persona = database.personas.find(p => p.id === chat.bindedPersona);
            if (persona) {
                return persona.name;
            }
        }
        return database.username ?? 'User';
    };

    const getUserIcon = (): string => {
        // 바인딩된 페르소나 확인
        if (chat.bindedPersona) {
            const persona = database.personas.find(p => p.id === chat.bindedPersona);
            if (persona) {
                return persona.icon ?? '';
            }
        }
        return database.userIcon ?? '';
    };

    const getPersonaPrompt = (): string => {
        // 바인딩된 페르소나 확인
        if (chat.bindedPersona) {
            const persona = database.personas.find(p => p.id === chat.bindedPersona);
            if (persona) {
                return persona.personaPrompt ?? '';
            }
        }
        return database.personaPrompt ?? '';
    };

    const getAuthorNoteDefaultText = (): string => {
        const template = database.promptTemplate;
        if (!template) {
            return '';
        }
        for (const v of template) {
            if (v.type === 'authornote') {
                return v.defaultText ?? '';
            }
        }
        return database.authorNoteDefaultText ?? '';
    };

    const findCharacterbyId = (id: string): character | null => {
        const found = database.characters.find(c => c.chaId === id && c.type !== 'group');
        return found || null;
    };

    return {
        userId,
        characterId,
        chatId,
        database,
        databaseAdapter,
        assetService,
        redisService,
        character: character as character | groupChat,
        chat,
        selectedCharIndex: selectedCharIndex >= 0 ? selectedCharIndex : undefined,
        selectedChatIndex: selectedChatIndex >= 0 ? selectedChatIndex : undefined,
        modelInfo,
        chatTokenizer,
        tokenizerContext,
        getUserName,
        getUserIcon,
        getPersonaPrompt,
        getAuthorNoteDefaultText,
        findCharacterbyId,
        options,
    };
}

/**
 * ProcessContext에서 데이터베이스 업데이트
 */
export async function updateContextDatabase(
    context: ProcessContext,
    updater: (database: Database) => Database | Promise<Database>
): Promise<void> {
    const updatedDatabase = await updater(context.database);
    await context.databaseAdapter.saveUserDatabase(context.userId, updatedDatabase);
    context.database = updatedDatabase;
}

/**
 * ProcessContext에서 캐릭터 업데이트
 */
export async function updateContextCharacter(
    context: ProcessContext,
    updater: (character: character | groupChat) => character | groupChat | Promise<character | groupChat>
): Promise<void> {
    const updatedCharacter = await updater(context.character);
    await context.databaseAdapter.saveCharacter(context.userId, updatedCharacter);
    context.character = updatedCharacter;
}

/**
 * ProcessContext에서 채팅 업데이트
 */
export async function updateContextChat(
    context: ProcessContext,
    updater: (chat: Chat) => Chat | Promise<Chat>
): Promise<void> {
    const updatedChat = await updater(context.chat);
    await context.databaseAdapter.saveChat(context.userId, updatedChat);
    context.chat = updatedChat;
}
