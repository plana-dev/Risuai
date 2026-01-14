/**
 * 이미지 처리 관련 함수들
 */

import type { ImageType } from './types';

export function checkImageType(arr: Uint8Array): ImageType {
    const isJPEG = arr[0] === 0xFF && arr[1] === 0xD8 && arr[arr.length - 2] === 0xFF && arr[arr.length - 1] === 0xD9;
    const isPNG = arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47 && arr[4] === 0x0D && arr[5] === 0x0A && arr[6] === 0x1A && arr[7] === 0x0A;
    const isGIF = arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38 && (arr[4] === 0x37 || arr[4] === 0x39) && arr[5] === 0x61;
    const isBMP = arr[0] === 0x42 && arr[1] === 0x4D;
    const isAVIF = arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70 && arr[8] === 0x61 && arr[9] === 0x76 && arr[10] === 0x69 && arr[11] === 0x66;
    const isWEBP = arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 && arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50;

    if (isJPEG) return "JPEG";
    if (isPNG) return "PNG";
    if (isGIF) return "GIF";
    if (isBMP) return "BMP";
    if (isAVIF) return "AVIF";
    if (isWEBP) return "WEBP";
    return "Unknown";
}

export async function hasher(data: Uint8Array) {
    return Buffer.from(await crypto.subtle.digest("SHA-256", data as any)).toString('hex');
}

// 서버 사이드에서는 이미지 변환 기능을 제한적으로 제공
// 클라이언트 전용 기능은 별도로 처리 필요
export async function convertImage(data: Uint8Array, imageCompression: boolean): Promise<Uint8Array> {
    if (!imageCompression) {
        return data
    }
    const type = checkImageType(data)
    if (type !== 'Unknown' && type !== 'WEBP' && type !== 'AVIF') {
        // 서버 사이드에서는 리사이즈/변환 기능 제한
        // 필요시 별도 이미지 처리 라이브러리 사용
        return data
    }
    return data
}
