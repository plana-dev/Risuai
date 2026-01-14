/**
 * 해시 함수
 * 원본: src/ts/parser.svelte.ts의 hasher 함수
 */

import { createHash } from 'crypto';

/**
 * Uint8Array 데이터를 SHA-256 해시로 변환
 */
export async function hasher(data: Uint8Array): Promise<string> {
    const hash = createHash('sha256');
    hash.update(Buffer.from(data));
    return hash.digest('hex');
}
