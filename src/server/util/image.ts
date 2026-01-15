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
import { Buffer } from 'buffer';
import { asBuffer } from './buffer';

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

/**
 * 이미지 타입 확인
 * 원본: src/ts/parser.svelte.ts의 checkImageType
 */
export type ImageType = 'PNG' | 'JPEG' | 'GIF' | 'WEBP' | 'UNKNOWN';

export function checkImageType(arr: Uint8Array): ImageType {
    if (arr.length < 8) {
        return 'UNKNOWN';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47 &&
        arr[4] === 0x0D && arr[5] === 0x0A && arr[6] === 0x1A && arr[7] === 0x0A) {
        return 'PNG';
    }

    // JPEG: FF D8 FF
    if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
        return 'JPEG';
    }

    // GIF: 47 49 46 38
    if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) {
        return 'GIF';
    }

    // WEBP: RIFF ... WEBP
    if (arr.length >= 12 &&
        arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
        arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
        return 'WEBP';
    }

    return 'UNKNOWN';
}

/**
 * 이미지를 PNG로 재인코딩
 * 원본: src/ts/process/files/inlays.ts의 reencodeImage
 * 서버 사이드에서는 sharp를 사용 (없을 경우 원본 반환)
 */
export async function reencodeImage(img: Uint8Array): Promise<Uint8Array> {
    if (checkImageType(img) === 'PNG') {
        return img;
    }

    try {
        // sharp를 사용하여 이미지 변환 시도
        // 동적 import를 사용하여 sharp가 없어도 에러가 나지 않도록 함
        const sharp = await import('sharp').catch(() => null);
        
        if (sharp && sharp.default) {
            const buffer = Buffer.from(img);
            const converted = await sharp.default(buffer)
                .png()
                .toBuffer();
            return new Uint8Array(converted);
        } else {
            // sharp가 없는 경우 원본 반환 (또는 에러 발생)
            console.warn('sharp is not installed, returning original image. Install sharp for image conversion: npm install sharp');
            return img;
        }
    } catch (error) {
        console.error('Failed to reencode image:', error);
        // 변환 실패 시 원본 반환
        return img;
    }
}
