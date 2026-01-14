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
// TODO: 아래 함수들을 서버 사이드로 마이그레이션 필요
import { checkImageType } from '../../../ts/parser.svelte';
import { asBuffer } from '../../../ts/util';

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
                // TODO: PO 파일 파싱 로직 구현
                return {
                    success: false,
                    error: 'PO file processing not implemented yet',
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
                // TODO: CSV 파싱 로직 구현
                return {
                    success: false,
                    error: 'CSV file processing not implemented yet',
                };
            }
            case 'json': {
                // JSON 파일 처리
                try {
                    const data = JSON.parse(fileContent);
                    // TODO: JSON 구조에 따라 메시지 생성
                    return {
                        success: true,
                        data,
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
