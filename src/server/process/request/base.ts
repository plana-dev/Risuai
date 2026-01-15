/**
 * Request 기본 로직 및 라우터
 * 원본: src/ts/process/request/request.ts
 */

import type { Database } from '../../database';
import type { RequestDataArgument, RequestDataArgumentExtended, RequestDataResponse, ModelModeExtended } from './types';
import type { LLMModel } from '../../model/types';
import { LLMFlags } from '../../model/types';
import { LLMFormat } from '../../model/types';
import { getModelInfo } from '../../model/modellist-server';
import { sleep } from '../../util';
import { requestOpenAI } from './openai';
import { requestClaude } from './anthropic';
import { requestGoogleCloudVertex } from './google';
import { requestOoba, requestOobaLegacy } from './ooba';
import { requestLocal } from './local';
// TODO: 다른 모델 구현체들 import (NovelAI, Kobold, Ollama, Horde 등)

/**
 * 메시지 포맷터
 * 모델에 따라 메시지 형식 변환
 */
export function reformater(
    formated: any[], // OpenAIChat[]
    modelInfo: LLMModel | LLMFlags[],
    database: Database
): any[] {
    const flags = Array.isArray(modelInfo) ? modelInfo : modelInfo.flags;
    let systemPrompt: any | null = null;

    if (!flags.includes(LLMFlags.hasFullSystemPrompt)) {
        if (flags.includes(LLMFlags.hasFirstSystemPrompt)) {
            while (formated[0]?.role === 'system') {
                if (systemPrompt) {
                    systemPrompt.content += '\n\n' + formated[0].content;
                } else {
                    systemPrompt = formated[0];
                }
                formated = formated.slice(1);
            }
        }

        for (let i = 0; i < formated.length; i++) {
            if (formated[i].role === 'system') {
                formated[i].content = database.systemContentReplacement
                    ? database.systemContentReplacement.replace('{{slot}}', formated[i].content)
                    : `system: ${formated[i].content}`;
                formated[i].role = database.systemRoleReplacement;
            }
        }
    }

    // LLMFlags 체크 로직
    if (flags.includes(LLMFlags.requiresAlternateRole)) {
        // requiresAlternateRole: 같은 역할의 연속된 메시지를 병합
        let newFormated: any[] = [];
        for (let i = 0; i < formated.length; i++) {
            const m = formated[i];
            if (newFormated.length === 0) {
                newFormated.push(m);
                continue;
            }

            if (newFormated[newFormated.length - 1].role === m.role) {
                // 같은 역할이면 내용 병합
                newFormated[newFormated.length - 1].content += '\n' + m.content;
                
                if (m.multimodals) {
                    if (!newFormated[newFormated.length - 1].multimodals) {
                        newFormated[newFormated.length - 1].multimodals = [];
                    }
                    newFormated[newFormated.length - 1].multimodals.push(...m.multimodals);
                }

                if (m.thoughts) {
                    if (!newFormated[newFormated.length - 1].thoughts) {
                        newFormated[newFormated.length - 1].thoughts = [];
                    }
                    newFormated[newFormated.length - 1].thoughts.push(...m.thoughts);
                }

                if (m.cachePoint) {
                    if (!newFormated[newFormated.length - 1].cachePoint) {
                        newFormated[newFormated.length - 1].cachePoint = true;
                    }
                }

                continue;
            } else {
                newFormated.push(m);
            }
        }
        formated = newFormated;
    }

    if (flags.includes(LLMFlags.mustStartWithUserInput)) {
        // mustStartWithUserInput: 첫 메시지가 user여야 함
        if (formated.length === 0 || formated[0].role !== 'user') {
            formated.unshift({
                role: 'user',
                content: ' '
            });
        }
    }

    if (systemPrompt) {
        formated.unshift(systemPrompt);
    }

    return formated;
}

/**
 * 메인 요청 데이터 처리
 * 모델 형식에 따라 적절한 API 호출
 */
export async function requestChatDataMain(
    arg: RequestDataArgument,
    model: ModelModeExtended,
    database: Database,
    abortSignal: AbortSignal | null = null,
    userId: string
): Promise<RequestDataResponse> {
    const targ: RequestDataArgumentExtended = {
        ...arg,
        formated: JSON.parse(JSON.stringify(arg.formated)), // safeStructuredClone 대체
        maxTokens: arg.maxTokens ?? database.maxResponse,
        temperature: arg.temperature ?? database.temperature / 100,
        useStreaming: database.useStreaming && arg.useStreaming,
        continue: arg.continue ?? false,
        biasString: arg.biasString ?? [],
        aiModel: arg.staticModel ? arg.staticModel : (model === 'model' ? database.aiModel : database.subModel),
        multiGen: (database.genTime > 1 && (arg.staticModel || (model === 'model' ? database.aiModel : database.subModel)).startsWith('gpt') && (!arg.continue)) && (!arg.noMultiGen),
        abortSignal: abortSignal || undefined,
        modelInfo: await getModelInfo(arg.staticModel || (model === 'model' ? database.aiModel : database.subModel), userId),
        mode: model,
        extractJson: arg.extractJson ?? database.extractJson,
    };

    // Reverse proxy 설정
    if (targ.aiModel === 'reverse_proxy') {
        targ.modelInfo.internalID = database.customProxyRequestModel;
        targ.modelInfo.format = database.customAPIFormat;
        targ.customURL = database.forceReplaceUrl;
        targ.key = database.proxyKey;
    }

    // Custom model 설정
    if (targ.aiModel?.startsWith('xcustom:::')) {
        const found = database.customModels.find(m => m.id === targ.aiModel);
        targ.customURL = found?.url;
        targ.key = found?.key;
    }

    // Separate models 설정
    if (database.seperateModelsForAxModels && !arg.staticModel) {
        if (database.seperateModels[model]) {
            targ.aiModel = database.seperateModels[model];
            targ.modelInfo = await getModelInfo(targ.aiModel, userId);
        }
    }

    const format = targ.modelInfo.format;

    targ.formated = reformater(targ.formated, targ.modelInfo, database);

    // 모델 형식에 따라 적절한 API 호출
    switch (format) {
        case LLMFormat.OpenAICompatible:
        case LLMFormat.Mistral:
            return requestOpenAI(targ, database, userId);
        case LLMFormat.Anthropic:
        case LLMFormat.AnthropicLegacy:
        case LLMFormat.AWSBedrockClaude:
            return requestClaude(targ, database, userId);
        case LLMFormat.VertexAIGemini:
        case LLMFormat.GoogleCloud:
            return requestGoogleCloudVertex(targ, database, userId);
        case LLMFormat.OobaLegacy:
            return requestOobaLegacy(targ, database, userId);
        case LLMFormat.Ooba:
            return requestOoba(targ, database, userId);
        // Local 모델은 선택적 (로컬 모델 서버 필요)
        // case LLMFormat.Local:
        //     return requestLocal(targ, database, userId);
        // TODO: 다른 형식들 추가 (NovelAI, Kobold, Ollama, Horde 등)
        default:
            // Local 모델은 특별 처리 (id가 local_로 시작하는 경우)
            if (targ.aiModel?.startsWith('local_')) {
                return requestLocal(targ, database, userId);
            }
            return {
                type: 'fail',
                result: `Unknown model format: ${format}`,
            };
    }
}

/**
 * 요청 데이터 처리 (재시도 및 폴백 로직 포함)
 */
export async function requestChatData(
    arg: RequestDataArgument,
    model: ModelModeExtended,
    database: Database,
    abortSignal: AbortSignal | null = null,
    userId: string,
    options?: {
        getTools?: () => Promise<any[]>;
        runTrigger?: (char: any, type: string, data: any) => Promise<any>;
        risuUnescape?: (text: string) => string;
        risuEscape?: (text: string) => string;
    }
): Promise<RequestDataResponse> {
    const fallBackModels: string[] = JSON.parse(JSON.stringify(database?.fallbackModels?.[model] ?? []));
    const tools = options?.getTools ? await options.getTools() : [];
    fallBackModels.push('');

    let da: RequestDataResponse;

    if (arg.escape) {
        arg.useStreaming = false;
        console.warn('Escape is enabled, disabling streaming');
    }

    const originalFormated = JSON.parse(JSON.stringify(arg.formated)).map((m: any) => {
        m.content = options?.risuUnescape ? options.risuUnescape(m.content) : m.content;
        return m;
    });

    for (let fallbackIndex = 0; fallbackIndex < fallBackModels.length; fallbackIndex++) {
        let trys = 0;
        arg.formated = JSON.parse(JSON.stringify(originalFormated));

        if (fallbackIndex !== 0 && !fallBackModels[fallbackIndex]) {
            continue;
        }

        while (true) {
            if (abortSignal?.aborted) {
                return {
                    type: 'fail',
                    result: 'Aborted',
                };
            }

            // TODO: Plugin replacer 처리
            // TODO: Trigger 처리

            da = await requestChatDataMain(
                {
                    ...arg,
                    staticModel: fallBackModels[fallbackIndex],
                    tools: tools,
                },
                model,
                database,
                abortSignal,
                userId
            );

            if (abortSignal?.aborted) {
                return {
                    type: 'fail',
                    result: 'Aborted',
                };
            }

            if (da.type === 'success' && arg.escape && options?.risuEscape) {
                da.result = options.risuEscape(da.result);
            }

            // TODO: Plugin replacer afterRequest 처리

            // Ban character set 체크
            if (da.type === 'success' && database.banCharacterset?.length > 0) {
                let failed = false;
                for (const set of database.banCharacterset) {
                    const checkRegex = new RegExp(`\\p{Script=${set}}`, 'gu');
                    if (checkRegex.test(da.result)) {
                        trys += 1;
                        failed = true;
                        break;
                    }
                }
                if (failed) {
                    continue;
                }
            }

            // Fallback when blank response
            if (da.type === 'success' && fallbackIndex !== fallBackModels.length - 1 && database.fallbackWhenBlankResponse) {
                if (da.result.trim() === '') {
                    break;
                }
            }

            if (da.type !== 'fail' || da.noRetry) {
                return {
                    ...da,
                    model: fallBackModels[fallbackIndex],
                };
            }

            if (da.failByServerError) {
                await sleep(1000);
                if (database.antiServerOverloads) {
                    trys -= 0.5; // reduce trys by 0.5, so that it will retry twice as much
                }
            }

            trys += 1;
            if (trys > database.requestRetrys) {
                if (fallbackIndex === fallBackModels.length - 1 || da.model === 'custom') {
                    return da;
                }
                break;
            }
        }
    }

    return da ?? {
        type: 'fail',
        result: 'All models failed',
    };
}
