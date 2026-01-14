/**
 * Tokenizer 유틸리티 함수들
 * 원본: src/ts/tokenizer.ts
 */

import type { character, groupChat, Chat } from '../database';
import type { OpenAIChat, MultiModal } from '../process/types';
import type { TokenizerContext } from './types';
import { encode } from './encode';
import { risuChatParser } from '../parser';
import { ChatTokenizer } from './chat-tokenizer';

/**
 * 캐릭터 토큰 수 계산
 */
export async function tokenizerChar(
    char: character,
    context: TokenizerContext
): Promise<number> {
    const data = char.name + '\n' + char.firstMessage + '\n' + char.desc;
    const encoded = await encode(data, context);
    return Array.isArray(encoded) ? encoded.length : encoded.length;
}

/**
 * 텍스트 토큰 수 계산
 */
export async function tokenize(
    data: string,
    context: TokenizerContext
): Promise<number> {
    const encoded = await encode(data, context);
    return Array.isArray(encoded) ? encoded.length : encoded.length;
}

/**
 * 정확한 토큰 수 계산 (CBS 파싱 포함)
 */
export async function tokenizeAccurate(
    data: string,
    context: TokenizerContext,
    consistantChar?: boolean
): Promise<number> {
    const parsed = risuChatParser(data.replace('{{slot}}', ''), {
        tokenizeAccurate: true,
        consistantChar: consistantChar,
    }, {
        parser: {
            getDatabase: () => context.database,
            getSelectedCharID: () => 0, // TODO: 적절한 값 전달
            findCharacterbyId: () => null, // TODO: 적절한 함수 전달
        },
        matcher: {
            // TODO: MatcherContext 구현
        } as any,
        block: {
            // TODO: BlockMatcherContext 구현
        } as any,
    });
    const encoded = await encode(parsed, context);
    return Array.isArray(encoded) ? encoded.length : encoded.length;
}

/**
 * 토큰 ID 배열 반환
 */
export async function tokenizeNum(
    data: string,
    context: TokenizerContext
): Promise<number[] | Uint32Array | Int32Array> {
    return await encode(data, context);
}

/**
 * 캐릭터의 영구 및 동적 토큰 수 계산
 */
export async function getCharToken(
    char: character | groupChat | null,
    context: TokenizerContext
): Promise<{ persistant: number; dynamic: number }> {
    let persistant = 0;
    let dynamic = 0;

    if (!char || char.type === 'group') {
        return { persistant: 0, dynamic: 0 };
    }

    const basicTokenize = async (data: string) => {
        data = data.replace(/{{char}}/g, char.name).replace(/<char>/g, char.name);
        return await tokenize(data, context);
    };

    persistant += await basicTokenize(char.desc);
    persistant += await basicTokenize(char.personality ?? '');
    persistant += await basicTokenize(char.scenario ?? '');
    
    for (const lore of char.globalLore) {
        const cont = lore.content.split('\n').filter((line) => {
            if (line.startsWith('@@')) {
                return false;
            }
            if (line === '') {
                return false;
            }
            return true;
        }).join('\n');
        dynamic += await basicTokenize(cont);
    }

    return { persistant, dynamic };
}

/**
 * 채팅의 토큰 수 계산
 */
export async function getChatToken(
    chat: Chat,
    context: TokenizerContext
): Promise<number> {
    let persistant = 0;

    const chatTokenizer = new ChatTokenizer(0, 'name');
    const chatf = chat.message.map((d) => {
        return {
            role: d.role === 'user' ? 'user' : 'assistant',
            content: d.data,
        } as OpenAIChat;
    });
    
    for (const chatItem of chatf) {
        persistant += await chatTokenizer.tokenizeChat(chatItem, context);
    }

    return persistant;
}

/**
 * Strong ban bias 생성 (localStorage 대신 Redis 사용)
 */
export async function strongBan(
    data: string,
    bias: { [key: number]: number },
    context: TokenizerContext,
    cache?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> }
): Promise<{ [key: number]: number }> {
    const cacheKey = 'strongBan_' + data;
    
    // Redis에서 캐시 확인
    if (cache) {
        const cached = await cache.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    }

    const charAlt = [
        data,
        data.trim(),
        data.toLocaleUpperCase(),
        data.toLocaleLowerCase(),
        data[0].toLocaleUpperCase() + data.slice(1),
        data[0].toLocaleLowerCase() + data.slice(1),
    ];

    const banChars = " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~""''«»「」…–―※";
    const unbanChars: number[] = [];

    for (const char of banChars) {
        const encoded = await tokenizeNum(char, context);
        if (Array.isArray(encoded) && encoded.length > 0) {
            unbanChars.push(encoded[0]);
        } else if (encoded.length > 0) {
            unbanChars.push(encoded[0]);
        }
    }

    for (const char of banChars) {
        const encoded = await tokenizeNum(char, context);
        if (Array.isArray(encoded) && encoded.length > 0) {
            if (!unbanChars.includes(encoded[0])) {
                bias[encoded[0]] = -100;
            }
        } else if (encoded.length > 0) {
            if (!unbanChars.includes(encoded[0])) {
                bias[encoded[0]] = -100;
            }
        }
        
        for (const alt of charAlt) {
            const encoded1 = await tokenizeNum(alt + char, context);
            if (Array.isArray(encoded1) && encoded1.length > 0) {
                if (!unbanChars.includes(encoded1[0])) {
                    bias[encoded1[0]] = -100;
                }
            } else if (encoded1.length > 0) {
                if (!unbanChars.includes(encoded1[0])) {
                    bias[encoded1[0]] = -100;
                }
            }
            
            const encoded2 = await tokenizeNum(char + alt, context);
            if (Array.isArray(encoded2) && encoded2.length > 0) {
                if (!unbanChars.includes(encoded2[0])) {
                    bias[encoded2[0]] = -100;
                }
            } else if (encoded2.length > 0) {
                if (!unbanChars.includes(encoded2[0])) {
                    bias[encoded2[0]] = -100;
                }
            }
        }
    }

    // Redis에 캐시 저장
    if (cache) {
        await cache.set(cacheKey, JSON.stringify(bias));
    }

    return bias;
}
