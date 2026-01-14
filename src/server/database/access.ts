/**
 * 데이터베이스 접근 함수들
 * 
 * 원본: src/ts/storage/database.svelte.ts
 * 서버 사이드에서는 데이터베이스 어댑터를 통해 접근합니다.
 */

import type { Database, character, groupChat, Chat, getDatabaseOptions } from './types';
import { getDatabaseAdapter } from '../index';

/**
 * 데이터베이스를 가져옵니다.
 * 
 * 서버 사이드에서는 DatabaseAdapter를 통해 사용자별 데이터를 가져옵니다.
 * 
 * @param userId - 사용자 ID (서버 사이드 필수)
 * @param options - 옵션 (snapshot 등)
 * @returns 데이터베이스 객체
 */
export async function getDatabase(
    userId: string,
    options: getDatabaseOptions = {}
): Promise<Database> {
    const adapter = getDatabaseAdapter();
    return await adapter.loadUserDatabase(userId);
}

/**
 * 데이터베이스를 설정합니다.
 * 
 * 서버 사이드에서는 DatabaseAdapter를 통해 사용자별 데이터를 저장합니다.
 * 
 * @param userId - 사용자 ID (서버 사이드 필수)
 * @param data - 저장할 데이터베이스 객체
 */
export async function setDatabase(
    userId: string,
    data: Database
): Promise<void> {
    const adapter = getDatabaseAdapter();
    await adapter.saveUserDatabase(userId, data);
}

/**
 * 현재 캐릭터를 가져옵니다.
 * 
 * 서버 사이드에서는 characterId를 직접 지정해야 합니다.
 * 
 * @param userId - 사용자 ID
 * @param characterId - 캐릭터 ID
 * @param options - 옵션
 * @returns 캐릭터 또는 그룹 채팅 객체
 */
export async function getCharacter(
    userId: string,
    characterId: string,
    options: getDatabaseOptions = {}
): Promise<character | groupChat | null> {
    const db = await getDatabase(userId, options);
    if (!db.characters) {
        return null;
    }
    return db.characters.find(char => char.chaId === characterId) || null;
}

/**
 * 캐릭터를 인덱스로 가져옵니다.
 * 
 * @param userId - 사용자 ID
 * @param index - 캐릭터 인덱스
 * @param options - 옵션
 * @returns 캐릭터 또는 그룹 채팅 객체
 */
export async function getCharacterByIndex(
    userId: string,
    index: number,
    options: getDatabaseOptions = {}
): Promise<character | groupChat | null> {
    const db = await getDatabase(userId, options);
    if (!db.characters || index >= db.characters.length) {
        return null;
    }
    return db.characters[index];
}

/**
 * 캐릭터를 설정합니다.
 * 
 * @param userId - 사용자 ID
 * @param characterId - 캐릭터 ID
 * @param char - 설정할 캐릭터 객체
 */
export async function setCharacter(
    userId: string,
    characterId: string,
    char: character | groupChat
): Promise<void> {
    const db = await getDatabase(userId);
    if (!db.characters) {
        db.characters = [];
    }
    const index = db.characters.findIndex(c => c.chaId === characterId);
    if (index >= 0) {
        db.characters[index] = char;
    } else {
        db.characters.push(char);
    }
    await setDatabase(userId, db);
}

/**
 * 캐릭터를 인덱스로 설정합니다.
 * 
 * @param userId - 사용자 ID
 * @param index - 캐릭터 인덱스
 * @param char - 설정할 캐릭터 객체
 */
export async function setCharacterByIndex(
    userId: string,
    index: number,
    char: character | groupChat
): Promise<void> {
    const db = await getDatabase(userId);
    if (!db.characters) {
        db.characters = [];
    }
    if (index >= db.characters.length) {
        db.characters.push(char);
    } else {
        db.characters[index] = char;
    }
    await setDatabase(userId, db);
}

/**
 * 현재 채팅을 가져옵니다.
 * 
 * @param userId - 사용자 ID
 * @param characterId - 캐릭터 ID
 * @returns 채팅 객체
 */
export async function getChat(
    userId: string,
    characterId: string
): Promise<Chat | null> {
    const char = await getCharacter(userId, characterId);
    if (!char) {
        return null;
    }
    return char.chats[char.chatPage] || null;
}

/**
 * 채팅을 설정합니다.
 * 
 * @param userId - 사용자 ID
 * @param characterId - 캐릭터 ID
 * @param chat - 설정할 채팅 객체
 */
export async function setChat(
    userId: string,
    characterId: string,
    chat: Chat
): Promise<void> {
    const char = await getCharacter(userId, characterId);
    if (!char) {
        return null;
    }
    char.chats[char.chatPage] = chat;
    await setCharacter(userId, characterId, char);
}
