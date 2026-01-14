/**
 * 랜덤 및 해시 함수들
 * 원본: src/ts/util.ts
 */

/**
 * sfc32 랜덤 함수 생성기
 */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
    return function () {
        a |= 0; b |= 0; c |= 0; d |= 0;
        let t = (a + b | 0) + d | 0;
        d = d + 1 | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    };
}

/**
 * UUID를 숫자로 변환
 */
export function uuidtoNumber(uuid: string): number {
    let result = 0;
    for (let i = 0; i < uuid.length; i++) {
        result += uuid.charCodeAt(i);
    }
    return result;
}

/**
 * 해시 기반 랜덤 값 생성
 */
export function pickHashRand(cid: number, word: string): number {
    let hashAddress = 5515;
    const rand = (word: string) => {
        for (let counter = 0; counter < word.length; counter++) {
            hashAddress = ((hashAddress << 5) + hashAddress) + word.charCodeAt(counter);
        }
        return hashAddress;
    };
    const randF = sfc32(rand(word), rand(word), rand(word), rand(word));
    const v = cid % 1000;
    for (let i = 0; i < v; i++) {
        randF();
    }
    return randF();
}
