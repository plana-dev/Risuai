/**
 * Persona 내보내기 함수
 * 원본: src/ts/persona.ts
 */

import type { Database } from '../database';
import type { PersonaCard, PersonaImageResult } from './types';
import { readPersonaImage, createDefaultPersonaImage } from './image';
import { reencodeImage } from '../../ts/process/files/inlays';
import { PngChunk } from '../../ts/pngChunk';
import { sleep } from '../util';

/**
 * Persona를 PNG 파일로 내보내기
 */
export async function exportUserPersona(
    userId: string,
    database: Database
): Promise<PersonaImageResult> {
    if (!database.username || !database.personaPrompt) {
        throw new Error('username or persona prompt is empty');
    }

    let img: Uint8Array;
    
    if (!database.userIcon) {
        // 기본 이미지 생성
        img = await createDefaultPersonaImage();
    } else {
        // 기존 이미지 읽기
        img = await readPersonaImage(database.userIcon, userId);
    }

    const card: PersonaCard = {
        name: database.username,
        personaPrompt: database.personaPrompt,
        note: database.userNote,
    };

    // 이미지 재인코딩
    const reencoded = await reencodeImage(img);

    // PNG 청크에 Persona 데이터 쓰기
    const imgWithMetadata = (await PngChunk.write(reencoded, {
        "persona": Buffer.from(JSON.stringify(card)).toString('base64')
    })) as Uint8Array;

    const fileName = `${database.username.replace(/[<>:"/\\|?*\.\,]/g, "")}_export.png`;

    return {
        imageData: imgWithMetadata,
        fileName
    };
}
