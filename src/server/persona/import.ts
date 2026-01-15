/**
 * Persona 가져오기 함수
 * 원본: src/ts/persona.ts
 */

import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../database';
import type { PersonaCard, PersonaImportResult } from './types';
import { getDatabase, setDatabase } from '../database';
import { getAssetService } from '../asset-service';
import { reencodeImage } from '../util/image';
import { PngChunk } from '../util/png-chunk';
// AppendableBuffer는 PngChunk에서 사용되므로 별도 import 불필요

/**
 * PNG 파일에서 Persona 데이터 가져오기
 */
export async function importUserPersona(
    userId: string,
    imageData: Uint8Array
): Promise<PersonaImportResult> {
    try {
        const readGenerator = PngChunk.readGenerator(imageData);
        let decoded: string | undefined;

        for await (const chunk of readGenerator) {
            if (chunk && !(chunk instanceof AppendableBuffer) && chunk.key === 'persona') {
                decoded = chunk.value;
                break;
            }
        }

        if (!decoded) {
            return {
                success: false,
                error: 'No persona data found in image'
            };
        }

        const data: PersonaCard = JSON.parse(Buffer.from(decoded, 'base64').toString('utf-8'));
        
        if (!data.name || !data.personaPrompt) {
            return {
                success: false,
                error: 'Invalid persona data: name or personaPrompt is missing'
            };
        }

        // 이미지 재인코딩 및 저장
        const reencoded = await reencodeImage(imageData);
        const assetService = getAssetService();
        
        const uploadResult = await assetService.uploadFile(
            userId,
            null, // characterId는 null (사용자 이미지)
            reencoded,
            `persona_${uuidv4()}.png`,
            'image/png'
        );

        // 데이터베이스에 Persona 추가
        const database = await getDatabase(userId);
        database.personas.push({
            name: data.name,
            icon: uploadResult.url,
            personaPrompt: data.personaPrompt,
            note: data.note,
            id: uuidv4()
        });

        await setDatabase(userId, database);

        return {
            success: true,
            persona: data,
            imageData: reencoded
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
