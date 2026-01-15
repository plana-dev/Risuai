/**
 * OpenAI API 구현
 * 원본: src/ts/process/request/openAI.ts
 * 
 * 파일이 매우 크므로 (1471 lines) 핵심 기능부터 단계적으로 구현합니다.
 */

import type { Database } from '../../database';
import type { RequestDataArgumentExtended, RequestDataResponse, OpenAIChatExtra, OpenAIContents, StreamResponseChunk } from './types';
import { applyParameters, setObjectValue } from './utils';
import type { OpenAIChat } from '../types';
import { tokenizeNum, strongBan, type TokenizerContext } from '../../tokenizer';
import { simplifySchema } from '../../util';
import { getModelInfo, LLMFlags, LLMFormat } from '../../model/modellist';
import { getFreeOpenRouterModel } from '../../model/openrouter';
import type { OpenAIToolCall } from './types';

import { extractJSON, getOpenAIJSONSchema, applyChatTemplate } from '../prompt/templates';

/**
 * OpenAI API 요청
 */
/**
 * Inlay 이미지 지원 여부 확인
 */
function supportsInlayImage(database: Database, modelInfo?: any): boolean {
    if (!modelInfo) {
        return false;
    }
    return modelInfo.flags?.includes(LLMFlags.hasImageInput) || false;
}

export async function requestOpenAI(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string,
    tokenizerContext?: TokenizerContext
): Promise<RequestDataResponse> {
    const formated = arg.formated;
    const aiModel = arg.aiModel || database.aiModel;
    const modelInfo = arg.modelInfo || await getModelInfo(aiModel, userId);

    // 1. 메시지 포맷팅
    let formatedChat: OpenAIChatExtra[] = [];

    // Tool calls 처리 (TODO: decodeToolCall 서버 사이드 마이그레이션 필요)
    const processToolCalls = async (text: string, originalMessage: any) => {
        // TODO: decodeToolCall 구현 필요
        // 현재는 기본 구조만 제공
        if (text.includes('<tool_call>')) {
            console.warn('Tool calls in messages are not yet fully supported in server-side implementation');
        }
        return [originalMessage];
    };

    for (let i = 0; i < formated.length; i++) {
        const m = formated[i];

        // Tool calls 처리
        if (m.content && typeof m.content === 'string' && m.content.includes('<tool_call>')) {
            const processedMessages = await processToolCalls(m.content, m);
            formatedChat.push(...processedMessages);
        }
        // Multimodal 처리
        else if (m.multimodals && m.multimodals.length > 0 && m.role === 'user') {
            let v: OpenAIChatExtra = JSON.parse(JSON.stringify(m));
            let contents: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }> = [];
            
            for (let j = 0; j < m.multimodals.length; j++) {
                const quality = database.gptVisionQuality as 'low' | 'high' | 'auto' | undefined;
                contents.push({
                    type: 'image_url',
                    image_url: {
                        url: m.multimodals[j].base64,
                        detail: quality || 'auto'
                    }
                });
            }
            
            if (m.content) {
                contents.push({
                    type: 'text',
                    text: m.content
                });
            }
            
            v.content = contents as any;
            formatedChat.push(v);
        }
        else {
            formatedChat.push(m);
        }
    }

    // 메시지 정리
    let oobaSystemPrompts: string[] = [];
    for (let i = 0; i < formatedChat.length; i++) {
        if (formatedChat[i].role !== 'function') {
            if (!(formatedChat[i].name && formatedChat[i].name.startsWith('example_') && database.newOAIHandle)) {
                formatedChat[i].name = undefined;
            }
            if (database.newOAIHandle && (formatedChat[i] as any).memo && (formatedChat[i] as any).memo.startsWith('NewChat')) {
                formatedChat[i].content = '';
            }
            if (arg.modelInfo?.flags.includes(LLMFlags.deepSeekPrefix) && 
                i === formatedChat.length - 1 && 
                formatedChat[i].role === 'assistant') {
                (formatedChat[i] as any).prefix = true;
            }
            if (arg.modelInfo?.flags.includes(LLMFlags.deepSeekThinkingInput) && 
                i === formatedChat.length - 1 && 
                (formatedChat[i] as any).thoughts && 
                (formatedChat[i] as any).thoughts.length > 0 && 
                formatedChat[i].role === 'assistant') {
                (formatedChat[i] as any).reasoning_content = (formatedChat[i] as any).thoughts.join('\n');
            }
            delete (formatedChat[i] as any).memo;
            delete (formatedChat[i] as any).removable;
            delete (formatedChat[i] as any).attr;
            delete (formatedChat[i] as any).multimodals;
            delete (formatedChat[i] as any).thoughts;
            delete (formatedChat[i] as any).cachePoint;
        }
        
        if (aiModel === 'reverse_proxy' && database.reverseProxyOobaMode && formatedChat[i].role === 'system') {
            const cont = formatedChat[i].content;
            if (typeof cont === 'string') {
                oobaSystemPrompts.push(cont);
                formatedChat[i].content = '';
            }
        }
    }

    if (oobaSystemPrompts.length > 0) {
        formatedChat.push({
            role: 'system',
            content: oobaSystemPrompts.join('\n')
        });
    }

    if (database.newOAIHandle) {
        formatedChat = formatedChat.filter(m => {
            const content = typeof m.content === 'string' ? m.content : '';
            return content !== '' || 
                   ((m as any).multimodals && (m as any).multimodals.length > 0) || 
                   m.tool_calls || 
                   m.role === 'tool';
        });
    }

    // 2. 바이어스 처리
    let bias = { ...arg.bias };
    if (arg.biasString) {
        for (let i = 0; i < arg.biasString.length; i++) {
            const bia = arg.biasString[i];
            if (bia[0].startsWith('[[') && bia[0].endsWith(']]')) {
                const num = parseInt(bia[0].replace('[[', '').replace(']]', ''));
                bias[num] = bia[1];
                continue;
            }

            // strongBan 처리
            if (bia[1] === -101) {
                if (tokenizerContext) {
                    // Redis 캐시는 나중에 추가 가능
                    bias = await strongBan(bia[0], bias, tokenizerContext);
                } else {
                    console.warn('strongBan requires tokenizerContext');
                }
                continue;
            }
            
            if (tokenizerContext) {
                const tokens = await tokenizeNum(bia[0], tokenizerContext);
                const tokenArray = Array.isArray(tokens) ? tokens : Array.from(tokens);
                for (const token of tokenArray) {
                    bias[token] = bia[1];
                }
            }
        }
    }

    // 3. 모델 설정
    let requestModel = (aiModel === 'reverse_proxy' || aiModel === 'openrouter') 
        ? database.proxyRequestModel 
        : aiModel;
    let openrouterRequestModel = database.openrouterRequestModel;
    
    if (aiModel === 'reverse_proxy') {
        requestModel = database.customProxyRequestModel;
    }

    if (aiModel === 'openrouter' && database.openrouterRequestModel === 'risu/free') {
        openrouterRequestModel = await getFreeOpenRouterModel(userId);
    }

    // Developer role 처리
    if (arg.modelInfo?.flags.includes(LLMFlags.DeveloperRole)) {
        formatedChat = formatedChat.map((v) => {
            if (v.role === 'system') {
                v.role = 'developer' as any;
            }
            return v;
        });
    }

    // Mistral 포맷 처리
    if (arg.modelInfo?.format === LLMFormat.Mistral) {
        requestModel = aiModel;
        let reformatedChat: OpenAIChatExtra[] = [];

        for (let i = 0; i < formatedChat.length; i++) {
            const chat = formatedChat[i];
            if (i === 0) {
                if (chat.role === 'user' || chat.role === 'system') {
                    reformatedChat.push({
                        role: chat.role,
                        content: chat.content
                    });
                } else {
                    reformatedChat.push({
                        role: 'system',
                        content: chat.role + ':' + (typeof chat.content === 'string' ? chat.content : '')
                    });
                }
            } else {
                const prevChat = reformatedChat[reformatedChat.length - 1];
                if (prevChat?.role === chat.role) {
                    const prevContent = typeof prevChat.content === 'string' ? prevChat.content : '';
                    const chatContent = typeof chat.content === 'string' ? chat.content : '';
                    prevChat.content = prevContent + '\n' + chatContent;
                    continue;
                } else if (chat.role === 'system') {
                    if (prevChat?.role === 'user') {
                        const prevContent = typeof prevChat.content === 'string' ? prevChat.content : '';
                        const chatContent = typeof chat.content === 'string' ? chat.content : '';
                        prevChat.content = prevContent + '\nSystem:' + chatContent;
                    } else {
                        reformatedChat.push({
                            role: 'user',
                            content: 'System:' + (typeof chat.content === 'string' ? chat.content : '')
                        });
                    }
                } else if (chat.role === 'function') {
                    reformatedChat.push({
                        role: 'user',
                        content: typeof chat.content === 'string' ? chat.content : ''
                    });
                } else {
                    reformatedChat.push({
                        role: chat.role,
                        content: chat.content
                    });
                }
            }
        }

        const targs = {
            body: applyParameters({
                model: requestModel,
                messages: reformatedChat,
                safe_prompt: false,
                max_tokens: arg.maxTokens,
            }, ['temperature', 'presence_penalty', 'frequency_penalty', 'top_p'], {}, arg.mode || 'model', database),
            headers: {
                "Authorization": "Bearer " + (arg.key ?? database.mistralKey),
            },
            abortSignal: arg.abortSignal,
        } as const;

        if (arg.previewBody) {
            return {
                type: 'success',
                result: JSON.stringify({
                    url: "https://api.mistral.ai/v1/chat/completions",
                    body: targs.body,
                    headers: targs.headers
                })
            };
        }

        // TODO: globalFetch 서버 사이드 마이그레이션 필요
        const res = await fetch(arg.customURL ?? "https://api.mistral.ai/v1/chat/completions", {
            method: 'POST',
            headers: {
                ...targs.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(targs.body),
            signal: targs.abortSignal
        });

        const dat = await res.json();
        if (res.ok) {
            try {
                const msg = dat.choices[0].message;
                return {
                    type: 'success',
                    result: msg.content || ''
                };
            } catch (error) {
                return {
                    type: 'fail',
                    result: `HTTP Error: ${JSON.stringify(dat)}`
                };
            }
        } else {
            if (dat.error && dat.error.message) {
                return {
                    type: 'fail',
                    result: `HTTP Error: ${dat.error.message}`
                };
            } else {
                return {
                    type: 'fail',
                    result: `HTTP Error: ${JSON.stringify(dat)}`
                };
            }
        }
    }

    // 4. 요청 본문 구성
    let body: { [key: string]: any } = {
        model: aiModel === 'openrouter' ? openrouterRequestModel : requestModel,
        messages: formatedChat,
        max_tokens: arg.maxTokens,
    };

    if (Object.keys(bias).length > 0) {
        body.logit_bias = bias;
    }

    if (database.generationSeed > 0) {
        body.seed = database.generationSeed;
    }

    if (database.jsonSchemaEnabled || arg.schema) {
        body.response_format = {
            "type": "json_schema",
            "json_schema": getOpenAIJSONSchema(arg.schema, database)
        };
    }

    if (database.OAIPrediction) {
        body.prediction = {
            type: "content",
            content: database.OAIPrediction
        };
    }

    if (aiModel === 'openrouter') {
        if (database.openrouterFallback) {
            body.route = "fallback";
        }
        body.transforms = database.openrouterMiddleOut ? ['middle-out'] : [];

        if (database.openrouterProvider) {
            const provider: typeof database.openrouterProvider = {} as typeof database.openrouterProvider;
            if (database.openrouterProvider.order?.length) {
                provider.order = database.openrouterProvider.order;
            }
            if (database.openrouterProvider.only?.length) {
                provider.only = database.openrouterProvider.only;
            }
            if (database.openrouterProvider.ignore?.length) {
                provider.ignore = database.openrouterProvider.ignore;
            }
            if (Object.keys(provider).length) {
                body.provider = provider;
            }
        }

        if (database.useInstructPrompt) {
            delete body.messages;
            const prompt = applyChatTemplate(formated, database, arg.currentChar);
            body.prompt = prompt;
        }
    }

    body = applyParameters(
        body,
        arg.modelInfo?.parameters || [],
        {},
        arg.mode || 'model',
        database
    );

    // Tools 처리
    if (arg.tools && arg.tools.length > 0) {
        body.tools = arg.tools.map(tool => {
            return {
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: simplifySchema(tool.inputSchema),
                }
            };
        });
    }

    // Reverse proxy 추가 파라미터
    if (aiModel === 'reverse_proxy' && database.reverseProxyOobaMode) {
        const OobaBodyTemplate = database.reverseProxyOobaArgs;
        const keys = Object.keys(OobaBodyTemplate);
        for (const key of keys) {
            if (OobaBodyTemplate[key] !== undefined && OobaBodyTemplate[key] !== null) {
                body[key] = OobaBodyTemplate[key];
            }
        }
    }

    // Inlay image 모델은 logit_bias를 지원하지 않음
    // OpenAI의 gpt 기반 모델은 logit_bias와 inlay image를 모두 지원
    if (supportsInlayImage(database, modelInfo)) {
        if (!(
            aiModel.startsWith('gpt') || 
            (aiModel === 'reverse_proxy' && (
                database.proxyRequestModel?.startsWith('gpt') ||
                (database.proxyRequestModel === 'custom' && database.customProxyRequestModel?.startsWith('gpt'))
            ))
        )) {
            delete body.logit_bias;
        }
    }

    // 5. URL 및 헤더 설정
    let replacerURL = aiModel === 'openrouter' 
        ? "https://openrouter.ai/api/v1/chat/completions" 
        : (arg.customURL) ?? 'https://api.openai.com/v1/chat/completions';

    if (arg.modelInfo?.endpoint) {
        replacerURL = arg.modelInfo.endpoint;
    }

    let risuIdentify = false;
    if (replacerURL.startsWith("risu::")) {
        risuIdentify = true;
        replacerURL = replacerURL.replace("risu::", '');
    }

    if (aiModel === 'reverse_proxy' && database.autofillRequestUrl) {
        if (replacerURL.endsWith('v1')) {
            replacerURL += '/chat/completions';
        } else if (replacerURL.endsWith('v1/')) {
            replacerURL += 'chat/completions';
        } else if (!(replacerURL.endsWith('completions') || replacerURL.endsWith('completions/'))) {
            if (replacerURL.endsWith('/')) {
                replacerURL += 'v1/chat/completions';
            } else {
                replacerURL += '/v1/chat/completions';
            }
        }
    }

    let headers: Record<string, string> = {
        "Authorization": "Bearer " + (arg.key ?? 
            (aiModel === 'reverse_proxy' ? database.proxyKey : 
             (aiModel === 'openrouter' ? database.openrouterKey : database.openAIKey))),
        "Content-Type": "application/json"
    };

    if (arg.modelInfo?.keyIdentifier) {
        headers["Authorization"] = "Bearer " + (database.OaiCompAPIKeys?.[arg.modelInfo.keyIdentifier] || '');
    }
    
    if (aiModel === 'openrouter') {
        headers["X-Title"] = 'RisuAI';
        headers["HTTP-Referer"] = 'https://risuai.xyz';
    }
    
    if (risuIdentify) {
        headers["X-Proxy-Risu"] = 'RisuAI';
    }
    
    if (aiModel.startsWith('jamba')) {
        headers['Authorization'] = 'Bearer ' + database.ai21Key;
        replacerURL = 'https://api.ai21.com/studio/v1/chat/completions';
    }
    
    if (arg.multiGen) {
        if (arg.tools && arg.tools.length > 0) {
            return {
                type: 'fail',
                result: 'MultiGen mode cannot be used with tool calls. Please disable one of them.'
            };
        }
        body.n = database.genTime;
    }

    // 6. 스트리밍 처리
    if (arg.useStreaming) {
        body.stream = true;
        const urlHost = new URL(replacerURL).host;
        if (urlHost.includes("localhost") || urlHost.includes("127.0.0.1") || urlHost.includes("0.0.0.0")) {
            // 서버 사이드에서는 localhost 요청 허용
        }

        if (arg.previewBody) {
            return {
                type: 'success',
                result: JSON.stringify({
                    url: replacerURL,
                    body: body,
                    headers: headers
                })
            };
        }

        const res = await fetch(replacerURL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            signal: arg.abortSignal
        });

        if (res.status !== 200) {
            const errorText = await res.text();
            return {
                type: "fail",
                result: errorText
            };
        }

        const contentType = res.headers.get('Content-Type') || '';
        if (!contentType.includes('text/event-stream')) {
            const errorText = await res.text();
            return {
                type: "fail",
                result: errorText
            };
        }

        const transtream = getTranStream(arg, database);
        if (res.body) {
            // Node.js ReadableStream을 TransformStream으로 변환
            const reader = res.body.getReader();
            const writable = transtream.writable;
            const writer = writable.getWriter();

            (async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            await writer.close();
                            break;
                        }
                        await writer.write(value);
                    }
                } catch (error) {
                    await writer.abort(error);
                }
            })();

            return {
                type: 'streaming',
                result: wrapToolStream(transtream.readable, body, headers, replacerURL, arg, database, userId, tokenizerContext)
            };
        }

        return {
            type: 'fail',
            result: 'Streaming response body is null'
        };
    }

    // 7. Reverse proxy 추가 파라미터 처리
    if (aiModel === 'reverse_proxy' || aiModel.startsWith('xcustom:::')) {
        let additionalParams = aiModel === 'reverse_proxy' ? database.additionalParams : [];

        if (aiModel.startsWith('xcustom:::')) {
            const found = database.customModels?.find(m => m.id === aiModel);
            const params = found?.params;
            if (params) {
                const lines = params.split('\n');
                for (const line of lines) {
                    const split = line.split('=');
                    if (split.length >= 2) {
                        additionalParams.push([split[0], split.slice(1).join('=')]);
                    }
                }
            }
        }

        // TODO: setObjectValue를 사용하여 추가 파라미터 처리
        // 현재는 기본 구조만 제공
        for (let i = 0; i < additionalParams.length; i++) {
            let key = additionalParams[i][0];
            let value = additionalParams[i][1];

            if (!key || !value) {
                continue;
            }

            if (value === '{{none}}') {
                if (key.startsWith('header::')) {
                    key = key.replace('header::', '');
                    delete headers[key];
                } else {
                    delete body[key];
                }
                continue;
            }

            if (key.startsWith('header::')) {
                key = key.replace('header::', '');
                headers[key] = value;
            } else if (value.startsWith('json::')) {
                value = value.replace('json::', '');
                try {
                    body[key] = JSON.parse(value);
                } catch (error) {
                    // Ignore parse errors
                }
            } else {
                // setObjectValue를 사용하여 중첩된 키 설정
                try {
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                        body = setObjectValue(body, key, value.slice(1, -1));
                    } else if (value === 'true' || value === 'false') {
                        body = setObjectValue(body, key, value === 'true');
                    } else if (value === 'null') {
                        body = setObjectValue(body, key, null);
                    } else {
                        const num = Number(value);
                        if (isNaN(num)) {
                            body = setObjectValue(body, key, value);
                        } else {
                            body = setObjectValue(body, key, num);
                        }
                    }
                } catch (error) {
                    body = setObjectValue(body, key, value);
                }
            }
        }
    }

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                url: replacerURL,
                body: body,
                headers: headers
            })
        };
    }

    // 8. HTTP 요청
    return await requestHTTPOpenAI(replacerURL, body, headers, arg, database, userId);
}

/**
 * OpenAI HTTP 요청 (비스트리밍)
 */
async function requestHTTPOpenAI(
    replacerURL: string,
    body: any,
    headers: Record<string, string>,
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    const res = await fetch(replacerURL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: arg.abortSignal
    });

    function processTextResponse(dat: any): string {
        if (dat?.choices[0]?.text) {
            let text = dat.choices[0].text as string;
            if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
                try {
                    const parsed = JSON.parse(text);
                    const extracted = extractJSON(parsed, arg.extractJson);
                    return extracted;
                } catch (error) {
                    console.log(error);
                    return text;
                }
            }
            return text;
        }
        
        if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
            return extractJSON(dat.choices[0].message.content, arg.extractJson);
        }
        
        const msg = dat.choices[0].message;
        let result = msg.content || '';
        
        // DeepSeek thinking output 처리
        if (arg.modelInfo?.flags.includes(LLMFlags.deepSeekThinkingOutput)) {
            console.log("Checking for reasoning content");
            let reasoningContent = "";
            result = result.replace(/(.*)\<\/think\>/gms, (m, p1) => {
                reasoningContent = p1;
                return "";
            });
            console.log(`Reasoning Content: ${reasoningContent}`);
            if (reasoningContent) {
                reasoningContent = reasoningContent.replace(/\<think\>/gms, '');
                result = `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${result}`;
            }
        }
        
        // DeepSeek Official Reasoning Model
        const reasoningContentField = dat?.choices[0]?.reasoning_content ?? dat?.choices[0]?.message?.reasoning_content;
        if (reasoningContentField) {
            result = `<Thoughts>\n${reasoningContentField}\n</Thoughts>\n${result}`;
        }
        
        // OpenRouter reasoning
        if (dat?.choices?.[0]?.message?.reasoning) {
            result = `<Thoughts>\n${dat.choices[0].message.reasoning}\n</Thoughts>\n${result}`;
        }

        return result;
    }

    const dat = await res.json();

    if (res.ok) {
        try {
            // Tool calls 처리 (TODO: 완전한 구현 필요)
            if (dat.choices?.[0]?.message?.tool_calls && dat.choices[0].message.tool_calls.length > 0) {
                // TODO: Tool calls 재귀 처리 구현 필요
                console.warn('Tool calls in response are not yet fully supported in server-side implementation');
            }

            // MultiGen 처리
            if (arg.multiGen && dat.choices) {
                if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
                    const c = dat.choices.map((v: { message: { content: string } }) => {
                        const extracted = extractJSON(v.message.content, arg.extractJson);
                        return ["char", extracted] as ['char', string];
                    });
                    return {
                        type: 'multiline',
                        result: c
                    };
                }
                return {
                    type: 'multiline',
                    result: dat.choices.map((v: any) => {
                        return ["char", v.message.content] as ['char', string];
                    })
                };
            }

            const result = processTextResponse(dat) ?? '';
            return {
                type: 'success',
                result: result
            };
        } catch (error) {
            return {
                type: 'fail',
                result: `HTTP Error: ${JSON.stringify(dat)}`
            };
        }
    }

    if (dat.error && dat.error.message) {
        return {
            type: 'fail',
            result: `HTTP Error: ${dat.error.message}`
        };
    }

    return {
        type: 'fail',
        result: `HTTP Error: ${JSON.stringify(dat)}`
    };
}

/**
 * 스트림 변환 (SSE 파싱)
 */
function getTranStream(
    arg: RequestDataArgumentExtended,
    database: Database
): TransformStream<Uint8Array, StreamResponseChunk> {
    let dataUint: Uint8Array = new Uint8Array([]);
    let reasoningContent = "";

    return new TransformStream<Uint8Array, StreamResponseChunk>({
        transform(chunk, control) {
            dataUint = new Uint8Array([...dataUint, ...chunk]);
            let JSONreaded: { [key: string]: string } = {};
            try {
                const datas = new TextDecoder().decode(dataUint).split('\n');
                let readed: { [key: string]: string } = {};
                
                for (const data of datas) {
                    if (data.startsWith("data: ")) {
                        try {
                            const rawChunk = data.replace("data: ", "");
                            if (rawChunk === "[DONE]") {
                                if (arg.modelInfo?.flags.includes(LLMFlags.deepSeekThinkingOutput)) {
                                    readed["0"] = (readed["0"] || "").replace(/(.*)\<\/think\>/gms, (m, p1) => {
                                        reasoningContent = p1;
                                        return "";
                                    });

                                    if (reasoningContent) {
                                        reasoningContent = reasoningContent.replace(/\<think\>/gm, '');
                                    }
                                }
                                
                                if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
                                    for (const key in readed) {
                                        const extracted = extractJSON(readed[key], arg.extractJson || '');
                                        JSONreaded[key] = extracted;
                                    }
                                    control.enqueue(JSONreaded);
                                } else if (reasoningContent) {
                                    control.enqueue({
                                        "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"] || ''}`
                                    });
                                } else {
                                    control.enqueue(readed);
                                }
                                return;
                            }
                            
                            const choices = JSON.parse(rawChunk).choices;
                            for (const choice of choices) {
                                const chunk = choice.delta?.content ?? choice.text;
                                if (chunk) {
                                    if (arg.multiGen) {
                                        const ind = choice.index.toString();
                                        if (!readed[ind]) {
                                            readed[ind] = "";
                                        }
                                        readed[ind] += chunk;
                                    } else {
                                        if (!readed["0"]) {
                                            readed["0"] = "";
                                        }
                                        readed["0"] += chunk;
                                    }
                                }
                                
                                // Tool calls in delta (MCP 제외)
                                if (choice?.delta?.tool_calls) {
                                    if (!readed["__tool_calls"]) {
                                        readed["__tool_calls"] = JSON.stringify({});
                                    }
                                    const toolCallsData = JSON.parse(readed["__tool_calls"]);
                                    
                                    for (const toolCall of choice.delta.tool_calls) {
                                        const index = toolCall.index ?? 0;
                                        const toolCallId = toolCall.id;
                                        
                                        if (!toolCallsData[index]) {
                                            toolCallsData[index] = {
                                                id: toolCallId || null,
                                                type: 'function',
                                                function: {
                                                    name: null,
                                                    arguments: ''
                                                }
                                            };
                                        }
                                        
                                        if (toolCall.id) {
                                            toolCallsData[index].id = toolCall.id;
                                        }
                                        if (toolCall.function?.name) {
                                            toolCallsData[index].function.name = toolCall.function.name;
                                        }
                                        if (toolCall.function?.arguments) {
                                            toolCallsData[index].function.arguments += toolCall.function.arguments;
                                        }
                                    }
                                    
                                    readed["__tool_calls"] = JSON.stringify(toolCallsData);
                                }
                                
                                if (choice?.delta?.reasoning_content) {
                                    reasoningContent += choice.delta.reasoning_content;
                                }
                            }
                        } catch (error) {
                            // Ignore parse errors
                        }
                    }
                }
                
                if (arg.modelInfo?.flags.includes(LLMFlags.deepSeekThinkingOutput)) {
                    readed["0"] = (readed["0"] || "").replace(/(.*)\<\/think\>/gms, (m, p1) => {
                        reasoningContent = p1;
                        return "";
                    });

                    if (reasoningContent) {
                        reasoningContent = reasoningContent.replace(/\<think\>/gm, '');
                    }
                }
                
                if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
                    for (const key in readed) {
                        const extracted = extractJSON(readed[key], arg.extractJson || '');
                        JSONreaded[key] = extracted;
                    }
                    control.enqueue(JSONreaded);
                } else if (reasoningContent) {
                    control.enqueue({
                        "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"] || ''}`
                    });
                } else {
                    control.enqueue(readed);
                }
            } catch (error) {
                // Ignore errors
            }
        }
    });
}

/**
 * Tool stream 래퍼 (MCP tool calls 제외)
 */
function wrapToolStream(
    stream: ReadableStream<StreamResponseChunk>,
    body: any,
    headers: Record<string, string>,
    replacerURL: string,
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string,
    tokenizerContext?: TokenizerContext
): ReadableStream<StreamResponseChunk> {
    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            let reader = stream.getReader();
            let prefix = '';
            let lastValue: StreamResponseChunk | undefined;

            while (true) {
                let { done, value } = await reader.read();

                let content = value?.['0'] || '';
                if (done) {
                    value = lastValue ?? { '0': '' };
                    content = value?.['0'] || '';
                    
                    // Tool calls 처리 (MCP 제외 - 기본 구조만 제공)
                    const toolCallsData = value?.['__tool_calls'];
                    if (toolCallsData) {
                        try {
                            const toolCalls = Object.values(JSON.parse(toolCallsData) || {}) as OpenAIToolCall[];
                            if (toolCalls && toolCalls.length > 0) {
                                // TODO: MCP tool calls 구현 제외
                                console.warn('Tool calls in streaming are not yet fully supported in server-side (MCP excluded)');
                            }
                        } catch (error) {
                            // Ignore parse errors
                        }
                    }
                    
                    return controller.close();
                }
                
                lastValue = value;
                controller.enqueue({ "0": (prefix ? prefix + '\n\n' : '') + content });
            }
        }
    });
}
