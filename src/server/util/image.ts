/**
 * 이미지 처리 유틸리티
 * 원본: src/ts/globalApi.svelte.ts의 readImage
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import { getAssetService } from '../asset-service';
import { getDatabaseAdapter } from '../database-adapter';
import { getRedisService } from '../redis-service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 이미지 파일 읽기
 * 서버 사이드에서는 AssetService 또는 파일 시스템을 사용
 */
export async function readImage(data: string): Promise<Uint8Array> {
    // URL인 경우
    if (data.startsWith('http://') || data.startsWith('https://')) {
        const response = await fetch(data);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    // Base64 데이터 URL인 경우
    if (data.startsWith('data:')) {
        const base64Data = data.split(',')[1];
        return new Uint8Array(Buffer.from(base64Data, 'base64'));
    }

    // Asset ID인 경우 (Supabase Storage)
    if (data.startsWith('assets/') || !data.includes('/')) {
        try {
            const assetService = getAssetService();
            // Asset ID로 파일 다운로드 시도
            const buffer = await assetService.downloadFile(data);
            return new Uint8Array(buffer);
        } catch (error) {
            // AssetService에서 찾을 수 없는 경우 파일 시스템 시도
            console.warn(`AssetService failed for ${data}, trying filesystem`);
        }
    }

    // 파일 경로인 경우
    try {
        // 상대 경로인 경우 public 폴더에서 찾기
        if (!path.isAbsolute(data)) {
            const publicPath = path.join(process.cwd(), 'public', data);
            const fileData = await fs.readFile(publicPath);
            return new Uint8Array(fileData);
        } else {
            // 절대 경로인 경우
            const fileData = await fs.readFile(data);
            return new Uint8Array(fileData);
        }
    } catch (error) {
        console.error(`Failed to read image from filesystem: ${data}`, error);
        throw new Error(`Failed to read image: ${data}`);
    }
}
