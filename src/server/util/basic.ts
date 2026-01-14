/**
 * 기본 유틸리티 함수들
 * 원본: src/ts/util.ts
 */

/**
 * 지정된 시간(ms)만큼 대기
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 값이 null 또는 undefined인지 확인
 */
export function checkNullish(data: any): boolean {
    return data === undefined || data === null;
}

/**
 * Uint8Array를 텍스트로 변환
 */
export function BufferToText(data: Uint8Array): string {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(data);
    }
    // Node.js 환경에서 Buffer 사용
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(data).toString('utf-8');
    }
    // Fallback: 수동 디코딩
    let result = '';
    for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data[i]);
    }
    return result;
}

/**
 * 문자열의 첫 글자를 대문자로 변환
 */
export function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
