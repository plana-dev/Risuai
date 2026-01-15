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

/**
 * 수식 계산 함수
 * 원본: src/ts/process/infunctions.ts
 * 
 * @param text - 계산할 수식 문자열 (예: "1 + 2 * 3", "$var1 + $var2")
 * @param getChatVar - 채팅 변수 가져오기 함수
 * @param getGlobalChatVar - 전역 변수 가져오기 함수
 * @returns 계산 결과
 */
export function calcString(
    text: string,
    getChatVar: (key: string) => string = () => '0',
    getGlobalChatVar: (key: string) => string = () => '0'
): number {
    function toRPN(expression: string) {
        let outputQueue = '';
        let operatorStack: string[] = [];
        const operators: { [key: string]: { precedence: number; associativity: 'Left' | 'Right' } } = {
            '+': { precedence: 2, associativity: 'Left' },
            '-': { precedence: 2, associativity: 'Left' },
            '*': { precedence: 3, associativity: 'Left' },
            '/': { precedence: 3, associativity: 'Left' },
            '^': { precedence: 4, associativity: 'Left' },
            '%': { precedence: 3, associativity: 'Left' },
            '<': { precedence: 1, associativity: 'Left' },
            '>': { precedence: 1, associativity: 'Left' },
            '|': { precedence: 1, associativity: 'Left' },
            '&': { precedence: 1, associativity: 'Left' },
            '≤': { precedence: 1, associativity: 'Left' },
            '≥': { precedence: 1, associativity: 'Left' },
            '=': { precedence: 1, associativity: 'Left' },
            '≠': { precedence: 1, associativity: 'Left' },
            '!': { precedence: 5, associativity: 'Right' },
        };
        const operatorsKeys = Object.keys(operators);

        expression = expression.replace(/\s+/g, '');
        const expression2: string[] = [];

        let lastToken = '';

        for (let i = 0; i < expression.length; i++) {
            const char = expression[i];
            if (char === '-' && (i === 0 || operatorsKeys.includes(expression[i - 1]) || expression[i - 1] === '(')) {
                lastToken += char;
            } else if (operatorsKeys.includes(char)) {
                if (lastToken !== '') {
                    expression2.push(lastToken);
                } else {
                    expression2.push('0');
                }
                lastToken = '';
                expression2.push(char);
            } else {
                lastToken += char;
            }
        }

        if (lastToken !== '') {
            expression2.push(lastToken);
        } else {
            expression2.push('0');
        }

        expression2.forEach(token => {
            if (parseFloat(token) || token === '0') {
                outputQueue += token + ' ';
            } else if (operatorsKeys.includes(token)) {
                while (
                    operatorStack.length > 0 &&
                    ((operators[token].associativity === 'Left' &&
                        operators[token].precedence <= operators[operatorStack[operatorStack.length - 1]].precedence) ||
                        (operators[token].associativity === 'Right' &&
                            operators[token].precedence < operators[operatorStack[operatorStack.length - 1]].precedence))
                ) {
                    outputQueue += operatorStack.pop() + ' ';
                }

                operatorStack.push(token);
            }
        });

        while (operatorStack.length > 0) {
            outputQueue += operatorStack.pop() + ' ';
        }

        return outputQueue.trim();
    }

    function calculateRPN(expression: string): number {
        const stack: number[] = [];

        expression.split(' ').forEach(token => {
            if (parseFloat(token) || token === '0') {
                stack.push(parseFloat(token));
            } else {
                const b = stack.pop();
                const a = stack.pop();
                if (a === undefined || b === undefined) {
                    return;
                }
                switch (token) {
                    case '+': stack.push(a + b); break;
                    case '-': stack.push(a - b); break;
                    case '*': stack.push(a * b); break;
                    case '/': stack.push(a / b); break;
                    case '^': stack.push(a ** b); break;
                    case '%': stack.push(a % b); break;
                    case '<': stack.push(a < b ? 1 : 0); break;
                    case '>': stack.push(a > b ? 1 : 0); break;
                    case '|': stack.push(a || b); break;
                    case '&': stack.push(a && b ? 1 : 0); break;
                    case '≤': stack.push(a <= b ? 1 : 0); break;
                    case '≥': stack.push(a >= b ? 1 : 0); break;
                    case '=': stack.push(a === b ? 1 : 0); break;
                    case '≠': stack.push(a !== b ? 1 : 0); break;
                    case '!': stack.push(b ? 0 : 1); break;
                }
            }
        });

        if (stack.length === 0) {
            return 0;
        }

        return stack.pop() ?? 0;
    }

    function executeRPNCalculation(text: string): number {
        const processedText = text
            .replace(/\$([a-zA-Z0-9_]+)/g, (_, p1) => {
                const v = getChatVar(p1);
                const parsed = parseFloat(v);
                if (isNaN(parsed)) {
                    return '0';
                }
                return parsed.toString();
            })
            .replace(/\@([a-zA-Z0-9_]+)/g, (_, p1) => {
                const v = getGlobalChatVar(p1);
                const parsed = parseFloat(v);
                if (isNaN(parsed)) {
                    return '0';
                }
                return parsed.toString();
            })
            .replace(/&&/g, '&')
            .replace(/\|\|/g, '|')
            .replace(/<=/g, '≤')
            .replace(/>=/g, '≥')
            .replace(/==/g, '=')
            .replace(/!=/g, '≠')
            .replace(/null/gi, '0');
        const expression = toRPN(processedText);
        const evaluated = calculateRPN(expression);
        return evaluated;
    }

    const depthText: string[] = [''];

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') {
            depthText.push('');
        } else if (text[i] === ')' && depthText.length > 1) {
            const result = executeRPNCalculation(depthText.pop() ?? '0');
            depthText[depthText.length - 1] += result;
        } else {
            depthText[depthText.length - 1] += text[i];
        }
    }

    return executeRPNCalculation(depthText.join(''));
}
