/**
 * 버퍼 및 비동기 처리 함수들
 * 원본: src/ts/util.ts
 */

/**
 * 버퍼 타입 변환
 */
export function asBuffer(arr: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer>;
export function asBuffer(arr: ArrayBufferLike): ArrayBuffer;

export function asBuffer(arr: Uint8Array<ArrayBufferLike> | ArrayBufferLike): Uint8Array<ArrayBuffer> | ArrayBuffer {
    if (arr instanceof Uint8Array) {
        return arr as unknown as Uint8Array<ArrayBuffer>;
    } else {
        return arr as unknown as ArrayBuffer;
    }
}

/**
 * 비동기 replace 함수
 */
export async function replaceAsync(
    string: string,
    regexp: RegExp,
    replacerFunction: (...args: string[]) => Promise<string>
): Promise<string> {
    const replacements = await Promise.all(
        Array.from(string.matchAll(regexp),
            match => replacerFunction(...(match as string[]))));
    let i = 0;
    return string.replace(regexp, () => replacements[i++]);
}
