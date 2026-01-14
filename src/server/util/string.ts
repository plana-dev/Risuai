/**
 * 문자열 처리 함수들
 * 원본: src/ts/util.ts
 */

/**
 * 다국어 문자열 인코딩
 */
export function encodeMultilangString(data: { [code: string]: string }): string {
    let result = '';
    if (data.xx) {
        result = data.xx;
    }
    for (const key in data) {
        result = `${result}\n# \`${key}\`\n${data[key]}`;
    }
    return result;
}

/**
 * 다국어 문자열 파싱
 */
export function parseMultilangString(data: string): { [code: string]: string } {
    const result: { [code: string]: string } = {};
    const regex = /# `(.+?)`\n([\s\S]+?)(?=\n# `|$)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(data)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        result[m[1]] = m[2];
    }
    result.xx = data.replace(regex, '');
    return result;
}

/**
 * 언어 코드를 언어 이름으로 변환
 */
export function toLangName(code: string): string {
    try {
        switch (code) {
            case 'xx': { // Special case for unknown language
                return 'Unknown Language';
            }
            default: {
                return new Intl.DisplayNames([code, 'en'], { type: 'language' }).of(code) || code;
            }
        }
    } catch (error) {
        return code;
    }
}

/**
 * 마지막 문자가 구두점인지 확인
 */
export function isLastCharPunctuation(s: string): boolean {
    const lastChar = s.trim().at(-1);
    const punctuation = [
        '.', '!', '?', '。', '！', '？', '…', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '<', '>', ',', '.', '/', '~', '`', ' ',
        '¡', '¿', '‽', '⁉', "'", '"'
    ];
    if (lastChar && !(punctuation.indexOf(lastChar) !== -1
        // spacing modifier letters
        || (lastChar.charCodeAt(0) >= 0x02B0 && lastChar.charCodeAt(0) <= 0x02FF)
        // combining diacritical marks
        || (lastChar.charCodeAt(0) >= 0x0300 && lastChar.charCodeAt(0) <= 0x036F)
        // hebrew punctuation
        || (lastChar.charCodeAt(0) >= 0x0590 && lastChar.charCodeAt(0) <= 0x05CF)
        // CJK symbols and punctuation
        || (lastChar.charCodeAt(0) >= 0x3000 && lastChar.charCodeAt(0) <= 0x303F)
    )) {
        return false;
    }
    return true;
}

/**
 * 구두점까지 문자열 자르기
 */
export function trimUntilPunctuation(s: string): string {
    let result = s;
    while (result.length > 0 && !isLastCharPunctuation(result)) {
        result = result.slice(0, -1);
    }
    return result;
}

/**
 * 지원되는 언어 코드 목록
 */
export const languageCodes = ["af", "ak", "am", "an", "ar", "as", "ay", "az", "be", "bg", "bh", "bm", "bn", "br", "bs", "ca", "co", "cs", "cy", "da", "de", "dv", "ee", "el", "en", "eo", "es", "et", "eu", "fa", "fi", "fo", "fr", "fy", "ga", "gd", "gl", "gn", "gu", "ha", "he", "hi", "hr", "ht", "hu", "hy", "ia", "id", "ig", "is", "it", "iu", "ja", "jv", "ka", "kk", "km", "kn", "ko", "ku", "ky", "la", "lb", "lg", "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "nb", "ne", "nl", "nn", "no", "ny", "oc", "om", "or", "pa", "pl", "ps", "pt", "qu", "rm", "ro", "ru", "rw", "sa", "sd", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "st", "su", "sv", "sw", "ta", "te", "tg", "th", "ti", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ug", "uk", "ur", "uz", "vi", "wa", "wo", "xh", "yi", "yo", "zh", "zu"];
