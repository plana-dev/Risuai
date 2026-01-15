/**
 * Local 모델 API 구현
 * 원본: src/ts/process/models/local.ts
 * 
 * 서버 사이드에서는 로컬 모델 서버 API를 호출
 * 로컬 모델 서버는 localhost:7239 또는 localhost:10026에서 실행
 */

import type { Database } from '../../database';
import type { RequestDataArgumentExtended, RequestDataResponse } from './types';
import type { OpenAIChat } from '../types';
import { applyChatTemplate } from '../prompt/templates';
import { risuChatParser } from '../../parser';

/**
 * Local 모델 요청
 * 로컬 모델 서버 API를 호출
 */
export async function requestLocal(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    const formated = arg.formated;
    const aiModel = arg.aiModel || database.aiModel;
    const maxTokens = arg.maxTokens || database.maxResponse;
    const temperature = arg.temperature ?? (database.temperature / 100);
    const useStreaming = arg.useStreaming;
    const abortSignal = arg.abortSignal;

    // 로컬 모델 서버 URL (기본값: localhost:7239 또는 localhost:10026)
    const localServerURL = database.localModelServerURL || 'http://localhost:7239';
    const endpoint = database.localModelEndpoint || '/chat/completions';

    const url = new URL(localServerURL);
    url.pathname = endpoint;

    // 프롬프트 생성
    const currentChar = arg.currentChar;
    const prompt = applyChatTemplate(formated, database, currentChar);

    // Body 구성
    const bodyTemplate: Record<string, any> = {
        prompt: prompt,
        max_new_tokens: maxTokens,
        temperature: temperature,
        top_p: database.top_p,
        top_k: database.ooba?.top_k ?? 0,
        repetition_penalty: database.ooba?.repetition_penalty ?? 1.0,
        stop: [database.username || 'User', currentChar?.name || 'Assistant'],
    };

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                url: url.toString(),
                body: bodyTemplate,
                headers: {},
            }),
        };
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(database.localModelAuthKey ? { 'Authorization': `Bearer ${database.localModelAuthKey}` } : {}),
            },
            body: JSON.stringify(bodyTemplate),
            signal: abortSignal || undefined,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            return {
                type: 'fail',
                result: `Local Model Error: ${JSON.stringify(errorData)}`,
            };
        }

        const dat = await response.json();
        
        // 응답 형식에 따라 처리
        let text: string = '';
        if (dat.choices?.[0]?.text) {
            text = dat.choices[0].text;
        } else if (dat.results?.[0]?.text) {
            text = dat.results[0].text;
        } else if (dat.text) {
            text = dat.text;
        } else if (typeof dat === 'string') {
            text = dat;
        }

        // Stop strings 제거
        const charName = currentChar?.name || '';
        const userName = database.username || 'User';
        const stopPatterns = [
            `${charName}:`,
            `${userName}:`,
            `\n\n${charName}:`,
            `\n\n${userName}:`,
        ];
        for (const pattern of stopPatterns) {
            const index = text.indexOf(pattern);
            if (index !== -1) {
                text = text.substring(0, index).trim();
            }
        }

        return {
            type: 'success',
            result: text.replace(/##\n/g, ''),
        };
    } catch (error) {
        return {
            type: 'fail',
            result: `Local Model Error: ${error}`,
        };
    }
}
