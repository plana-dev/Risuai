/**
 * Ooba (Text Generation WebUI) API 구현
 * 원본: src/ts/process/request/request.ts의 requestOoba, requestOobaLegacy 함수
 */

import type { Database } from '../../database';
import type { RequestDataArgumentExtended, RequestDataResponse } from './types';
import type { OpenAIChat } from '../types';
import type { character, groupChat } from '../../database';
import { applyChatTemplate } from '../prompt/templates';
import { getStopStrings } from '../auxiliary/stringlize';
import { unstringlizeChat } from '../auxiliary/stringlize';
import { risuChatParser } from '../../parser';

/**
 * Ooba Legacy 요청 (v1/generate 엔드포인트)
 */
export async function requestOobaLegacy(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    const formated = arg.formated;
    const aiModel = arg.aiModel || database.aiModel;
    const maxTokens = arg.maxTokens || database.maxResponse;
    const useStreaming = arg.useStreaming;
    const abortSignal = arg.abortSignal;

    // URL 구성
    let streamUrl = database.textgenWebUIStreamURL?.replace(/\/api.*/, '/api/v1/stream') || '';
    let blockingUrl = database.textgenWebUIBlockingURL?.replace(/\/api.*/, '/api/v1/generate') || '';

    if (!blockingUrl) {
        return {
            type: 'fail',
            result: 'Ooba URL not configured',
        };
    }

    // 프롬프트 생성
    const currentChar = arg.currentChar;
    const prompt = applyChatTemplate(formated, database, currentChar);

    // Stop strings (간단한 버전 - ProcessContext 없이)
    let stopStrings: string[] = [];
    if (database.localStopStrings) {
        stopStrings = database.localStopStrings.map((v) => {
            return risuChatParser(v.replace(/\\n/g, '\n'), { chara: currentChar });
        });
    } else {
        // 기본 stop strings
        stopStrings = [database.username || 'User', currentChar?.name || 'Assistant'];
    }

    // Body 구성
    const bodyTemplate: Record<string, any> = {
        max_new_tokens: maxTokens,
        do_sample: database.ooba?.do_sample ?? true,
        temperature: (database.temperature / 100),
        top_p: database.ooba?.top_p ?? 0.9,
        typical_p: database.ooba?.typical_p ?? 1.0,
        repetition_penalty: database.ooba?.repetition_penalty ?? 1.0,
        encoder_repetition_penalty: database.ooba?.encoder_repetition_penalty ?? 1.0,
        top_k: database.ooba?.top_k ?? 0,
        min_length: database.ooba?.min_length ?? 0,
        no_repeat_ngram_size: database.ooba?.no_repeat_ngram_size ?? 0,
        num_beams: database.ooba?.num_beams ?? 1,
        penalty_alpha: database.ooba?.penalty_alpha ?? 0,
        length_penalty: database.ooba?.length_penalty ?? 1.0,
        early_stopping: false,
        truncation_length: maxTokens,
        ban_eos_token: database.ooba?.ban_eos_token ?? false,
        stopping_strings: stopStrings,
        seed: -1,
        add_bos_token: database.ooba?.add_bos_token ?? false,
        topP: database.top_p,
        prompt: prompt,
    };

    // Headers
    const headers: Record<string, string> = {};
    if (aiModel !== 'textgen_webui' && database.mancerHeader) {
        headers['X-API-KEY'] = database.mancerHeader;
    }

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                url: blockingUrl,
                body: bodyTemplate,
                headers: headers,
            }),
        };
    }

    // 스트리밍 처리
    if (useStreaming && streamUrl) {
        // TODO: WebSocket 스트리밍 구현 (서버 사이드에서는 WebSocket 클라이언트 필요)
        // 현재는 blocking 요청으로 fallback
        console.warn('Ooba Legacy streaming not yet implemented on server-side, using blocking request');
    }

    // Blocking 요청
    try {
        const response = await fetch(blockingUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: JSON.stringify(bodyTemplate),
            signal: abortSignal || undefined,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            return {
                type: 'fail',
                result: `HTTP Error: ${JSON.stringify(errorData)}`,
            };
        }

        const dat = await response.json();
        let result: string = dat.results?.[0]?.text || '';

        // unstringlizeChat 처리 (간단한 버전)
        // TODO: ProcessContext를 받아서 완전한 unstringlizeChat 사용
        const charName = currentChar?.name || '';
        const userName = database.username || 'User';
        
        // 기본 stop strings 제거
        const stopPatterns = [
            `${charName}:`,
            `${userName}:`,
            `\n\n${charName}:`,
            `\n\n${userName}:`,
        ];
        for (const pattern of stopPatterns) {
            const index = result.indexOf(pattern);
            if (index !== -1) {
                result = result.substring(0, index).trim();
            }
        }

        return {
            type: 'success',
            result: result,
        };
    } catch (error) {
        return {
            type: 'fail',
            result: `Ooba Legacy Error: ${error}`,
        };
    }
}

/**
 * Ooba 요청 (v1/completions 엔드포인트)
 */
export async function requestOoba(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    const formated = arg.formated;
    const aiModel = arg.aiModel || database.aiModel;
    const maxTokens = arg.maxTokens || database.maxResponse;
    const temperature = arg.temperature ?? (database.temperature / 100);

    // URL 구성
    if (!database.textgenWebUIBlockingURL) {
        return {
            type: 'fail',
            result: 'Ooba URL not configured',
        };
    }

    const url = new URL(database.textgenWebUIBlockingURL);
    url.pathname = '/v1/completions';
    const urlStr = url.toString();

    // 프롬프트 생성
    const currentChar = arg.currentChar;
    const prompt = applyChatTemplate(formated, database, currentChar);

    // Stop strings (간단한 버전 - ProcessContext 없이)
    let stopStrings: string[] = [];
    if (database.localStopStrings) {
        stopStrings = database.localStopStrings.map((v) => {
            return risuChatParser(v.replace(/\\n/g, '\n'), { chara: currentChar });
        });
    } else {
        // 기본 stop strings
        stopStrings = [database.username || 'User', currentChar?.name || 'Assistant'];
    }

    // Body 구성
    let bodyTemplate: Record<string, any> = {
        prompt: prompt,
        presence_penalty: arg.PresensePenalty ?? (database.PresensePenalty / 100),
        frequency_penalty: arg.frequencyPenalty ?? (database.frequencyPenalty / 100),
        logit_bias: {},
        max_tokens: maxTokens,
        stop: stopStrings,
        temperature: temperature,
        top_p: database.top_p,
    };

    // Ooba 파라미터 적용
    const OobaParams = [
        'mode', 'turn_template', 'name1_instruct', 'name2_instruct', 'context_instruct',
        'system_message', 'name1', 'name2', 'context', 'greeting', 'chat_instruct_command',
        'preset', 'tokenizer', 'min_p', 'top_k', 'repetition_penalty', 'repetition_penalty_range',
        'typical_p', 'tfs', 'top_a', 'epsilon_cutoff', 'eta_cutoff', 'guidance_scale',
        'negative_prompt', 'penalty_alpha', 'mirostat_mode', 'mirostat_tau', 'mirostat_eta',
        'temperature_last', 'do_sample', 'seed', 'encoder_repetition_penalty',
        'no_repeat_ngram_size', 'min_length', 'num_beams', 'length_penalty',
        'early_stopping', 'truncation_length', 'max_tokens_second', 'custom_token_bans',
        'auto_max_new_tokens', 'ban_eos_token', 'add_bos_token', 'skip_special_tokens',
        'grammar_string',
    ];

    const OobaBodyTemplate = database.reverseProxyOobaArgs || {};
    const keys = Object.keys(OobaBodyTemplate);
    for (const key of keys) {
        if (OobaBodyTemplate[key] !== undefined && OobaBodyTemplate[key] !== null && OobaParams.includes(key)) {
            bodyTemplate[key] = OobaBodyTemplate[key];
        } else if (bodyTemplate[key]) {
            delete bodyTemplate[key];
        }
    }

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                url: urlStr,
                body: bodyTemplate,
                headers: {},
            }),
        };
    }

    try {
        const response = await fetch(urlStr, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyTemplate),
            signal: arg.abortSignal || undefined,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            return {
                type: 'fail',
                result: `HTTP Error: ${JSON.stringify(errorData)}`,
            };
        }

        const dat = await response.json();
        const text: string = dat.choices?.[0]?.text || '';

        return {
            type: 'success',
            result: text.replace(/##\n/g, ''),
        };
    } catch (error) {
        return {
            type: 'fail',
            result: `Ooba Error: ${error}`,
        };
    }
}
