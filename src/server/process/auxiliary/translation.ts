/**
 * 번역 처리 함수
 * 원본: src/ts/translator/translator.ts
 * 서버 사이드에서 외부 번역 API만 지원
 * 로컬 모델 번역은 클라이언트에서 처리
 */

import type { Database } from '../../database';
import { requestChatData } from '../request';
import type { OpenAIChat } from '../types';
import { sleep } from '../../util';

/**
 * 번역 실행
 * 서버 사이드에서는 외부 API만 지원 (DeepL, Google Translate 등)
 * 로컬 모델 번역은 클라이언트에서 처리
 * 
 * @param text - 번역할 텍스트
 * @param reverse - 역방향 번역 여부
 * @param from - 원본 언어 코드
 * @param target - 대상 언어 코드
 * @param database - 데이터베이스
 * @param userId - 사용자 ID
 * @param exarg - 추가 인자 (translatorNote 등)
 */
export async function runTranslator(
    text: string,
    reverse: boolean,
    from: string,
    target: string,
    database: Database,
    userId: string,
    exarg?: { translatorNote?: string }
): Promise<string> {
    const arg = {
        from: reverse ? from : target,
        to: reverse ? target : from,
        host: 'translate.googleapis.com',
        translatorNote: exarg?.translatorNote,
    };

    // 텍스트를 청크로 분할 (에셋 태그는 번역하지 않음)
    const texts = text.split('\n');
    let chunks: [string, boolean][] = [['', true]];

    for (let i = 0; i < texts.length; i++) {
        if (
            texts[i].startsWith('{{img') ||
            texts[i].startsWith('{{raw') ||
            texts[i].startsWith('{{video') ||
            texts[i].startsWith('{{audio') ||
            texts[i].length === 0
        ) {
            chunks.push([texts[i], false]);
            chunks.push(['', true]);
        } else {
            chunks[chunks.length - 1][0] += texts[i];
        }
    }

    let fullResult: string[] = [];

    for (const chunk of chunks) {
        if (chunk[1]) {
            const trimmed = chunk[0].trim();
            if (trimmed.length === 0) {
                fullResult.push(chunk[0]);
                continue;
            }
            const result = await translateMain(trimmed, arg, database, userId);

            if (result.startsWith('ERR::')) {
                console.error('[Translation] Error:', result);
                return text; // 에러 시 원본 텍스트 반환
            }

            fullResult.push(result.trim());
        } else {
            fullResult.push(chunk[0]);
        }
    }

    return fullResult.join('\n').trim();
}

/**
 * 번역 메인 함수
 * 다양한 번역 API 지원
 */
async function translateMain(
    text: string,
    arg: { from: string; to: string; host: string; translatorNote?: string },
    database: Database,
    userId: string
): Promise<string> {
    // LLM 번역 (서버 사이드에서 지원)
    if (database.translatorType === 'llm') {
        const tr = arg.to || 'en';
        return translateLLM(text, { to: tr, from: arg.from, translatorNote: arg.translatorNote }, database, userId);
    }

    // DeepL API
    if (database.translatorType === 'deepl') {
        const body = {
            text: [text],
            target_lang: arg.to.toUpperCase(),
        };
        const url = database.deeplOptions?.freeApi
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `DeepL-Auth-Key ${database.deeplOptions?.key || ''}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.text();
                return `ERR::DeepL API Error: ${errorData}`;
            }

            const data = await response.json();
            return data.translations?.[0]?.text || text;
        } catch (error) {
            return `ERR::DeepL API Error: ${error}`;
        }
    }

    // DeepLX (로컬 서버)
    if (database.translatorType === 'deeplX') {
        let url = database.deeplXOptions?.url || 'http://localhost:1188';
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        if (!url.endsWith('/translate')) {
            url += '/translate';
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (database.deeplXOptions?.token?.trim()) {
            headers['Authorization'] = `Bearer ${database.deeplXOptions.token}`;
        }

        const body = {
            text: text,
            target_lang: arg.to.toUpperCase(),
            source_lang: arg.from.toUpperCase(),
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.text();
                return `ERR::DeepLX API Error: ${errorData}`;
            }

            const data = await response.json();
            return data.data || text;
        } catch (error) {
            return `ERR::DeepLX API Error: ${error}`;
        }
    }

    // Google Translate (기본)
    // Google Translate API는 무료이지만 비공식 API이므로 안정성이 낮을 수 있음
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${arg.from}&tl=${arg.to}&q=${encodeURIComponent(text)}`;
        const response = await fetch(url, {
            method: 'GET',
        });

        if (response.ok) {
            const res = await response.json();
            
            // 응답 형식에 따라 처리
            if (typeof res === 'string') {
                return res;
            }
            
            if (res[0] && res[0].length > 0) {
                const result = res[0]
                    .map((s: any) => s[0])
                    .filter(Boolean)
                    .join('')
                    .replace(/\* ([^*]+)\*/g, '*$1*')
                    .replace(/\*([^*]+) \*/g, '*$1*');
                return result;
            }
        }
    } catch (error) {
        // Google Translate 실패 시 원본 텍스트 반환
    }

    // 기본값: 원본 텍스트 반환
    return text;
}

/**
 * LLM을 사용한 번역
 * 서버 사이드에서 지원
 * 원본: src/ts/translator/translator.ts의 translateLLM
 */
async function translateLLM(
    text: string,
    arg: { to: string; from: string; translatorNote?: string },
    database: Database,
    userId: string
): Promise<string> {
    const translatorNote = arg.translatorNote || database.translatorNote || '';
    
    // 프롬프트 구성
    let prompt: string;
    if (translatorNote) {
        prompt = `${translatorNote}\n\nTranslate the following text from ${arg.from} to ${arg.to}:\n${text}`;
    } else {
        prompt = `Translate the following text from ${arg.from} to ${arg.to}:\n${text}`;
    }

    const promptbody: OpenAIChat[] = [
        {
            role: 'user',
            content: prompt,
        },
    ];

    try {
        const rq = await requestChatData(
            {
                formated: promptbody,
                temperature: 0.2,
                maxTokens: 1000,
                bias: {},
                useStreaming: false,
                noMultiGen: true,
            },
            'translate', // translate 모드 사용 (database.seperateModels.translate 또는 database.aiModel 사용)
            database,
            null,
            userId
        );

        if (rq.type === 'fail') {
            return `ERR::LLM Translation Error: ${rq.result}`;
        }

        if (rq.type === 'streaming' || rq.type === 'multiline') {
            return `ERR::Unexpected response type`;
        }

        return rq.result.trim();
    } catch (error) {
        return `ERR::LLM Translation Error: ${error}`;
    }
}

/**
 * VOICEVOX용 번역 (일본어로 번역)
 * 원본: src/ts/translator/translator.ts의 translateVox
 */
export async function translateVox(
    text: string,
    database: Database,
    userId: string
): Promise<string> {
    // 일본어로 번역
    return runTranslator(text, false, 'auto', 'ja', database, userId);
}
