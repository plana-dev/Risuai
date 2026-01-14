/**
 * Persona 관리 함수들
 * 원본: src/ts/persona.ts
 */

import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../database';
import { getDatabase, setDatabase } from '../database';
import { getAssetService } from '../asset-service';

/**
 * 사용자 Persona 저장
 */
export async function saveUserPersona(
    userId: string,
    personaIndex: number
): Promise<void> {
    const database = await getDatabase(userId);
    
    if (!database.personas[personaIndex]) {
        throw new Error(`Persona at index ${personaIndex} not found`);
    }
    
    database.personas[personaIndex].name = database.username;
    database.personas[personaIndex].icon = database.userIcon;
    database.personas[personaIndex].personaPrompt = database.personaPrompt;
    database.personas[personaIndex].note = database.userNote;
    
    await setDatabase(userId, database);
}

/**
 * 사용자 Persona 변경
 */
export async function changeUserPersona(
    userId: string,
    personaIndex: number,
    save: 'save' | 'noSave' = 'save'
): Promise<void> {
    if (save === 'save') {
        await saveUserPersona(userId, personaIndex);
    }
    
    const database = await getDatabase(userId);
    const persona = database.personas[personaIndex];
    
    if (!persona) {
        throw new Error(`Persona at index ${personaIndex} not found`);
    }
    
    database.personaPrompt = persona.personaPrompt;
    database.username = persona.name;
    database.userIcon = persona.icon;
    database.userNote = persona.note;
    database.selectedPersona = personaIndex;
    
    await setDatabase(userId, database);
}

/**
 * 사용자 이미지 업로드 및 Persona 업데이트
 */
export async function uploadUserImage(
    userId: string,
    imageData: Uint8Array,
    fileName: string
): Promise<string> {
    const assetService = getAssetService();
    
    // 이미지 업로드
    const result = await assetService.uploadFile(
        userId,
        null, // characterId는 null (사용자 이미지)
        imageData,
        fileName,
        'image/png'
    );
    
    // 데이터베이스 업데이트
    const database = await getDatabase(userId);
    database.userIcon = result.url;
    
    // 현재 Persona 업데이트
    if (database.personas[database.selectedPersona]) {
        database.personas[database.selectedPersona] = {
            ...database.personas[database.selectedPersona],
            name: database.username,
            icon: database.userIcon,
            personaPrompt: database.personaPrompt,
            note: database.userNote,
            id: database.personas[database.selectedPersona].id || uuidv4()
        };
    }
    
    await setDatabase(userId, database);
    
    return result.url;
}
