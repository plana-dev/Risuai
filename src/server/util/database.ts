/**
 * 데이터베이스 관련 유틸리티 함수들
 * 원본: src/ts/util.ts
 * 서버 사이드에서 사용할 수 있도록 userId 기반으로 구현
 */

import type { Database, character, Chat } from '../database';
import { getDatabaseAdapter, type DatabaseAdapter } from '../database-adapter';

/**
 * 사용자 이름 가져오기
 * 서버 사이드에서는 userId와 chatId를 받아서 처리
 */
export async function getUserName(
    userId: string,
    chatId?: string,
    database?: Database
): Promise<string> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    // 바인딩된 페르소나 확인
    if (chatId) {
        try {
            const db = getDatabaseAdapter();
            const chat = await db.loadChat(userId, chatId);
            if (chat?.bindedPersona) {
                const persona = database.personas.find(p => p.id === chat.bindedPersona);
                if (persona) {
                    return persona.name;
                }
            }
        } catch (error) {
            // Chat을 찾을 수 없는 경우 무시
        }
    }

    return database.username ?? 'User';
}

/**
 * 사용자 아이콘 가져오기
 */
export async function getUserIcon(
    userId: string,
    chatId?: string,
    database?: Database
): Promise<string> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    // 바인딩된 페르소나 확인
    if (chatId) {
        try {
            const db = getDatabaseAdapter();
            const chat = await db.loadChat(userId, chatId);
            if (chat?.bindedPersona) {
                const persona = database.personas.find(p => p.id === chat.bindedPersona);
                if (persona) {
                    return persona.icon ?? '';
                }
            }
        } catch (error) {
            // Chat을 찾을 수 없는 경우 무시
        }
    }

    return database.userIcon ?? '';
}

/**
 * 페르소나 프롬프트 가져오기
 */
export async function getPersonaPrompt(
    userId: string,
    chatId?: string,
    database?: Database
): Promise<string> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    // 바인딩된 페르소나 확인
    if (chatId) {
        try {
            const db = getDatabaseAdapter();
            const chat = await db.loadChat(userId, chatId);
            if (chat?.bindedPersona) {
                const persona = database.personas.find(p => p.id === chat.bindedPersona);
                if (persona) {
                    return persona.personaPrompt ?? '';
                }
            }
        } catch (error) {
            // Chat을 찾을 수 없는 경우 무시
        }
    }

    return database.personaPrompt ?? '';
}

/**
 * Author Note 기본 텍스트 가져오기
 */
export function getAuthorNoteDefaultText(database: Database): string {
    return database.authorNoteDefaultText ?? '';
}

/**
 * 캐릭터 ID로 찾기
 */
export async function findCharacterbyId(
    userId: string,
    characterId: string,
    database?: Database
): Promise<character | null> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    const character = database.characters.find(c => c.chaId === characterId);
    return character || null;
}

/**
 * 캐릭터 ID로 인덱스 찾기
 * 원본: src/ts/util.ts의 findCharacterIndexbyId
 */
export async function findCharacterIndexbyId(
    userId: string,
    characterId: string,
    database?: Database
): Promise<number> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    const index = database.characters.findIndex(c => c.chaId === characterId);
    return index;
}

/**
 * 캐릭터 인덱스 객체 생성
 * 원본: src/ts/util.ts의 getCharacterIndexObject
 */
export async function getCharacterIndexObject(
    userId: string,
    database?: Database
): Promise<{ [key: string]: number }> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    const result: { [key: string]: number } = {};
    database.characters.forEach((char, index) => {
        result[char.chaId] = index;
    });
    return result;
}

/**
 * 사용자 아이콘 포트레이트 가져오기
 * 원본: src/ts/util.ts의 getUserIconProtrait
 */
export async function getUserIconProtrait(
    userId: string,
    chatId?: string,
    database?: Database
): Promise<string | false> {
    if (!database) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    // 바인딩된 페르소나 확인
    if (chatId) {
        try {
            const db = getDatabaseAdapter();
            const chat = await db.loadChat(userId, chatId);
            if (chat?.bindedPersona) {
                const persona = database.personas.find(p => p.id === chat.bindedPersona);
                if (persona) {
                    return (persona as any).largePortrait ?? false;
                }
            }
        } catch (error) {
            // Chat을 찾을 수 없는 경우 무시
        }
    }

    // selectedPersona 확인
    if (database.selectedPersona !== undefined && database.personas[database.selectedPersona]) {
        return (database.personas[database.selectedPersona] as any).largePortrait ?? false;
    }

    return false;
}
