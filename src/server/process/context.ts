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

    // 선택된 캐릭터/채팅 인덱스 찾기
    const selectedCharIndex = database.characters.findIndex(c => c.chaId === characterId);
    const selectedChatIndex = character.chats.findIndex(c => c.chatId === chatId);

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
