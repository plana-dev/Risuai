/**
 * 암호화 함수들 (서버 사이드용)
 * 원본: src/ts/util.ts (클라이언트용 window.crypto 사용)
 * 
 * 서버 사이드에서는 Node.js의 crypto 모듈을 사용합니다.
 */

import * as crypto from 'crypto';

/**
 * 버퍼 암호화 (AES-GCM)
 */
export async function encryptBuffer(data: Uint8Array, keys: string): Promise<ArrayBuffer> {
    // 키를 SHA-256으로 해시하여 고정 길이 키 값 생성
    const keyBuffer = crypto.createHash('sha256').update(keys).digest();

    // AES-GCM 암호화
    const iv = Buffer.alloc(12, 0); // 12바이트 IV (0으로 초기화)
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(data)),
        cipher.final()
    ]);

    // GCM 모드에서는 authTag가 별도로 반환됨
    const authTag = cipher.getAuthTag();

    // 암호화된 데이터와 authTag를 결합
    const result = Buffer.concat([encrypted, authTag]);

    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

/**
 * 버퍼 복호화 (AES-GCM)
 */
export async function decryptBuffer(data: Uint8Array, keys: string): Promise<ArrayBuffer> {
    // 키를 SHA-256으로 해시하여 고정 길이 키 값 생성
    const keyBuffer = crypto.createHash('sha256').update(keys).digest();

    // GCM 모드에서는 authTag가 16바이트로 끝에 붙어있음
    const authTagLength = 16;
    const encrypted = Buffer.from(data.slice(0, data.length - authTagLength));
    const authTag = Buffer.from(data.slice(data.length - authTagLength));

    const iv = Buffer.alloc(12, 0); // 12바이트 IV (0으로 초기화)
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength);
}
