/**
 * 파일 처리 서버 사이드 지원
 * 
 * 설계 방안:
 * 1. 파일 업로드: 클라이언트에서 서버로 파일 전송, 서버에서 처리 후 결과 반환
 * 2. 파일 다운로드: 서버에서 생성된 파일을 클라이언트로 전송
 * 3. Inlay 에셋: 서버에 저장하고 ID로 참조
 * 4. Multisend: 서버에서 파일 파싱 및 처리
 */

import type { FileProcessResult, InlayAsset } from './types';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../../database';
import { getDatabaseAdapter } from '../../database-adapter';
import { getRedisService } from '../../redis-service';
import { asBuffer } from '../../util';
import sharp from 'sharp';

const inlayImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
const inlayAudioExts = ['wav', 'mp3', 'ogg', 'flac'];
const inlayVideoExts = ['webm', 'mp4', 'mkv'];

/**
 * Inlay 에셋 업로드 (서버 사이드)
 */
export async function uploadInlayAsset(
    userId: string,
    file: {
        name: string;
        data: Uint8Array | Buffer;
    }
): Promise<FileProcessResult & { assetId?: string }> {
    const extension = file.name.split('.').at(-1)?.toLowerCase() || '';

    try {
        const assetId = uuidv4();
        const redis = getRedisService();

        if (inlayImageExts.includes(extension)) {
            // 이미지 처리
            // TODO: 이미지 리사이징 및 최적화
            const base64 = Buffer.from(file.data).toString('base64');

            const asset: InlayAsset = {
                id: assetId,
                name: file.name,
                type: 'image',
                data: base64,
                ext: extension,
            };

            // Redis에 저장 (또는 데이터베이스)
            await redis.setInlayAsset(userId, assetId, asset);

            return {
                success: true,
                assetId,
            };
        }

        if (inlayAudioExts.includes(extension)) {
            const base64 = Buffer.from(file.data).toString('base64');

            const asset: InlayAsset = {
                id: assetId,
                name: file.name,
                type: 'audio',
                data: base64,
                ext: extension,
            };

            await redis.setInlayAsset(userId, assetId, asset);

            return {
                success: true,
                assetId,
            };
        }

        if (inlayVideoExts.includes(extension)) {
            const base64 = Buffer.from(file.data).toString('base64');

            const asset: InlayAsset = {
                id: assetId,
                name: file.name,
                type: 'video',
                data: base64,
                ext: extension,
            };

            await redis.setInlayAsset(userId, assetId, asset);

            return {
                success: true,
                assetId,
            };
        }

        return {
            success: false,
            error: `Unsupported file type: ${extension}`,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Inlay 에셋 가져오기
 */
export async function getInlayAsset(userId: string, assetId: string): Promise<InlayAsset | null> {
    try {
        const redis = getRedisService();
        const asset = await redis.getInlayAsset(userId, assetId);
        return asset;
    } catch (error) {
        console.error('[File Processing] Error getting inlay asset:', error);
        return null;
    }
}

/**
 * 이미지를 Inlay 에셋으로 저장 (서버 사이드)
 * 원본: src/ts/process/files/inlays.ts의 writeInlayImage
 * 
 * @param imageData - 이미지 데이터 (Uint8Array 또는 Buffer)
 * @param arg - 옵션 (name, ext, id)
 * @param userId - 사용자 ID
 * @returns 에셋 ID
 */
export async function writeInlayImage(
    imageData: Uint8Array | Buffer,
    arg: { name?: string; ext?: string; id?: string } = {},
    userId: string
): Promise<string> {
    const imgid = arg.id ?? uuidv4();
    const redis = getRedisService();
    
    // 이미지 리사이징 (최대 1024x1024 픽셀)
    let processedData = imageData instanceof Buffer ? imageData : Buffer.from(imageData);
    
    try {
        // sharp를 사용하여 이미지 메타데이터 및 리사이징
        const image = sharp(processedData);
        const metadata = await image.metadata();
        
        let width = metadata.width || 0;
        let height = metadata.height || 0;
        
        // 최대 픽셀 수 제한 (1024x1024)
        const maxPixels = 1024 * 1024;
        const currentPixels = width * height;
        
        if (currentPixels > maxPixels) {
            const scaleFactor = Math.sqrt(maxPixels / currentPixels);
            width = Math.floor(width * scaleFactor);
            height = Math.floor(height * scaleFactor);
            
            // 리사이징
            processedData = await image
                .resize(width, height, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .png()
                .toBuffer();
        } else {
            // PNG로 변환 (일관성을 위해)
            processedData = await image.png().toBuffer();
        }
        
        // Base64로 변환
        const base64 = processedData.toString('base64');
        
        const asset: InlayAsset = {
            id: imgid,
            name: arg.name ?? imgid,
            type: 'image',
            data: `data:image/png;base64,${base64}`,
            ext: 'png',
            width,
            height,
        };
        
        await redis.setInlayAsset(userId, imgid, asset);
        
        return imgid;
    } catch (error) {
        console.error('[File Processing] Error processing image:', error);
        // 에러 발생 시 원본 데이터를 그대로 저장
        const base64 = processedData.toString('base64');
        const asset: InlayAsset = {
            id: imgid,
            name: arg.name ?? imgid,
            type: 'image',
            data: `data:image/${arg.ext || 'png'};base64,${base64}`,
            ext: arg.ext || 'png',
            width: 0,
            height: 0,
        };
        await redis.setInlayAsset(userId, imgid, asset);
        return imgid;
    }
}

/**
 * Multisend 파일 처리 (서버 사이드)
 * 
 * 클라이언트에서 파일을 업로드하면 서버에서 파싱하고 처리
 */
export async function processMultisendFile(
    userId: string,
    characterId: string,
    chatId: string,
    fileContent: string,
    fileType: 'po' | 'txt' | 'csv' | 'json'
): Promise<FileProcessResult> {
    try {
        const db = getDatabaseAdapter();
        const database = await db.loadDatabase(userId);
        const character = await db.loadCharacter(userId, characterId);
        const chat = await db.loadChat(userId, chatId);

        if (!character || !chat) {
            return {
                success: false,
                error: 'Character or chat not found',
            };
        }

        switch (fileType) {
            case 'po': {
                // PO 파일 처리
                // 원본: src/ts/process/files/multisend.ts의 sendPofile
                const lines = fileContent.split('\n');
                const messages: any[] = [];
                let msgId = '';
                let note = '';
                let speaker = '';
                let parseMode = 0; // 0: normal, 1: msgid continuation, 2: msgstr

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    if (line === '') {
                        if (msgId === '') {
                            continue;
                        }

                        // 메시지 생성
                        let text = msgId;
                        if (speaker !== '') {
                            text = `Speaker: ${speaker}\n${text}`;
                        }
                        if (note !== '') {
                            text = `Note: ${note}\n${text}`;
                        }

                        messages.push({
                            role: 'user',
                            data: text,
                        });

                        // 리셋
                        note = '';
                        speaker = '';
                        msgId = '';
                        parseMode = 0;
                        continue;
                    }

                    if (line.startsWith('#. Note =')) {
                        note = line.replace('#. Note =', '').trim();
                        continue;
                    }

                    if (line.startsWith('#. Speaker =')) {
                        speaker = line.replace('#. Speaker =', '').trim();
                        continue;
                    }

                    if (line.startsWith('msgid')) {
                        parseMode = 0;
                        msgId = line
                            .replace('msgid ', '')
                            .trim()
                            .replaceAll('\\"', '♠#')
                            .replaceAll('"', '')
                            .replaceAll('♠#', '\\"');
                        if (msgId === '') {
                            parseMode = 1;
                        }
                        continue;
                    }

                    if (parseMode === 1 && line.startsWith('"') && line.endsWith('"')) {
                        msgId += line.substring(1, line.length - 1).replaceAll('\\"', '"');
                        continue;
                    }

                    if (line.startsWith('msgstr')) {
                        if (msgId === '') {
                            parseMode = 0;
                        } else {
                            parseMode = 2;
                        }
                        continue;
                    }

                    if (parseMode === 2 && line.startsWith('"') && line.endsWith('"')) {
                        continue; // msgstr 내용은 무시
                    }
                }

                // 마지막 메시지 처리
                if (msgId !== '') {
                    let text = msgId;
                    if (speaker !== '') {
                        text = `Speaker: ${speaker}\n${text}`;
                    }
                    if (note !== '') {
                        text = `Note: ${note}\n${text}`;
                    }
                    messages.push({
                        role: 'user',
                        data: text,
                    });
                }

                // 메시지 저장
                if (messages.length > 0) {
                    chat.message.push(...messages);
                    await db.saveChat(userId, chatId, chat);
                }

                return {
                    success: true,
                    data: { messageCount: messages.length },
                };
            }
            case 'txt': {
                // 텍스트 파일 처리
                const lines = fileContent.split('\n');
                const messages: any[] = [];

                for (const line of lines) {
                    if (line.trim()) {
                        messages.push({
                            role: 'user',
                            data: line.trim(),
                        });
                    }
                }

                // 메시지 저장
                chat.message.push(...messages);
                await db.saveChat(userId, chatId, chat);

                return {
                    success: true,
                    data: { messageCount: messages.length },
                };
            }
            case 'csv': {
                // CSV 파일 처리
                // 간단한 CSV 파싱 (쉼표로 구분, 첫 번째 줄은 헤더로 간주)
                const lines = fileContent.split('\n').filter(line => line.trim());
                if (lines.length === 0) {
                    return {
                        success: false,
                        error: 'CSV file is empty',
                    };
                }

                const messages: any[] = [];
                const headers = lines[0].split(',').map(h => h.trim());

                // 헤더에서 'message' 또는 'text' 컬럼 찾기
                const messageColIndex = headers.findIndex(
                    h => h.toLowerCase() === 'message' || h.toLowerCase() === 'text' || h.toLowerCase() === 'data'
                );

                if (messageColIndex === -1) {
                    // 메시지 컬럼이 없으면 첫 번째 컬럼 사용
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        if (values[0] && values[0].trim()) {
                            messages.push({
                                role: 'user',
                                data: values[0].trim(),
                            });
                        }
                    }
                } else {
                    // 메시지 컬럼 사용
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        if (values[messageColIndex] && values[messageColIndex].trim()) {
                            messages.push({
                                role: 'user',
                                data: values[messageColIndex].trim(),
                            });
                        }
                    }
                }

                // 메시지 저장
                if (messages.length > 0) {
                    chat.message.push(...messages);
                    await db.saveChat(userId, chatId, chat);
                }

                return {
                    success: true,
                    data: { messageCount: messages.length },
                };
            }
            case 'json': {
                // JSON 파일 처리
                // 지원하는 JSON 구조:
                // 1. 배열 형태: [{role: 'user', data: '...'}, ...]
                // 2. 객체 형태: {messages: [{role: 'user', data: '...'}, ...]}
                // 3. 단순 배열: ['message1', 'message2', ...]
                try {
                    const data = JSON.parse(fileContent);
                    const messages: any[] = [];

                    if (Array.isArray(data)) {
                        // 배열 형태
                        if (data.length > 0 && typeof data[0] === 'string') {
                            // 단순 문자열 배열
                            for (const text of data) {
                                if (text && typeof text === 'string' && text.trim()) {
                                    messages.push({
                                        role: 'user',
                                        data: text.trim(),
                                    });
                                }
                            }
                        } else {
                            // 객체 배열 (role, data 포함)
                            for (const item of data) {
                                if (item && typeof item === 'object') {
                                    const role = item.role === 'char' ? 'char' : 'user';
                                    const dataText = item.data || item.text || item.message || '';
                                    if (dataText && typeof dataText === 'string' && dataText.trim()) {
                                        messages.push({
                                            role,
                                            data: dataText.trim(),
                                        });
                                    }
                                }
                            }
                        }
                    } else if (data && typeof data === 'object') {
                        // 객체 형태
                        const messageArray = data.messages || data.message || data.chat || [];
                        if (Array.isArray(messageArray)) {
                            for (const item of messageArray) {
                                if (item && typeof item === 'object') {
                                    const role = item.role === 'char' ? 'char' : 'user';
                                    const dataText = item.data || item.text || item.message || '';
                                    if (dataText && typeof dataText === 'string' && dataText.trim()) {
                                        messages.push({
                                            role,
                                            data: dataText.trim(),
                                        });
                                    }
                                } else if (typeof item === 'string' && item.trim()) {
                                    messages.push({
                                        role: 'user',
                                        data: item.trim(),
                                    });
                                }
                            }
                        }
                    }

                    // 메시지 저장
                    if (messages.length > 0) {
                        chat.message.push(...messages);
                        await db.saveChat(userId, chatId, chat);
                    }

                    return {
                        success: true,
                        data: { messageCount: messages.length },
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: 'Invalid JSON format',
                    };
                }
            }
            default: {
                return {
                    success: false,
                    error: `Unsupported file type: ${fileType}`,
                };
            }
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
