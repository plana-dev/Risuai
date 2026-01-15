/**
 * 플레이스홀더 치환 유틸리티
 * 원본: src/ts/util.ts의 replacePlaceholders
 */

import type { Database, character } from '../database';
import { getUserName } from './database';

/**
 * 플레이스홀더 치환
 * {{char}}, {{user}} 등을 실제 값으로 치환
 */
export async function replacePlaceholders(
    msg: string,
    userId: string,
    currentChar?: character,
    chatId?: string,
    database?: Database
): Promise<string> {
    const charName = currentChar?.name || '';
    const userName = await getUserName(userId, chatId, database);

    return msg
        .replace(/({{char}})|({{Char}})|(<Char>)|(<char>)/gi, charName)
        .replace(/({{user}})|({{User}})|(<User>)|(<user>)/gi, userName)
        .replace(/(\{\{((set)|(get))var::.+?\}\})/gu, '');
}
