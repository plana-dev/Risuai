/**
 * Google Cloud Vertex AI API 구현
 * 원본: src/ts/process/request/google.ts (1205 lines)
 */

import type { Database } from '../../database';
import type { RequestDataArgumentExtended, RequestDataResponse, StreamResponseChunk } from './types';
import type { OpenAIChat } from '../types';
import { applyParameters } from './utils';
import { getModelInfo, LLMFlags, LLMFormat } from '../../model/modellist';
import { simplifySchema } from '../../util';
import { extractJSON } from '../prompt/templates';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

type GeminiFunctionCall = {
    id?: string;
    name: string;
    args: any;
};

type GeminiFunctionResponse = {
    id?: string;
    name: string;
    response: any;
};

interface GeminiPart {
    text?: string;
    thought?: boolean;
    thoughtSignature?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
    functionCall?: GeminiFunctionCall;
    functionResponse?: GeminiFunctionResponse;
}

interface GeminiChat {
    role: "user" | "model" | "function";
    parts: GeminiPart[];
}

/**
 * Google Cloud Vertex AI API 요청
 */
export async function requestGoogleCloudVertex(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    const formated = arg.formated;
    const modelInfo = arg.modelInfo || await getModelInfo(arg.aiModel || database.aiModel, userId);
    const maxTokens = arg.maxTokens || database.maxResponse;

    let reformatedChat: GeminiChat[] = [];
    let systemPrompt = '';

    // System 메시지 추출
    if (formated[0]?.role === 'system') {
        systemPrompt = formated[0].content as string;
        formated.shift();
    }

    // OpenAIChat을 GeminiChat으로 변환
    for (let i = 0; i < formated.length; i++) {
        const chat = formated[i];
        const prevChat = reformatedChat[reformatedChat.length - 1];
        const qRole =
            chat.role === 'user' ? 'user' :
                chat.role === 'assistant' ? 'model' :
                    chat.role;

        if (chat.multimodals && chat.multimodals.length > 0) {
            let geminiParts: GeminiPart[] = [];

            geminiParts.push({
                text: chat.content as string,
            });

            for (const modal of chat.multimodals) {
                if (
                    (modal.type === "image" && modelInfo.flags.includes(LLMFlags.hasImageInput)) ||
                    (modal.type === "audio" && modelInfo.flags.includes(LLMFlags.hasAudioInput)) ||
                    (modal.type === "video" && modelInfo.flags.includes(LLMFlags.hasVideoInput))
                ) {
                    const dataurl = modal.base64;
                    const base64 = dataurl.split(",")[1];
                    const mediaType = dataurl.split(";")[0].split(":")[1];

                    geminiParts.push({
                        inlineData: {
                            mimeType: mediaType,
                            data: base64,
                        }
                    });
                }
            }

            reformatedChat.push({
                role: chat.role === 'user' ? 'user' : 'model',
                parts: geminiParts,
            });
        } else if (chat.role === 'system') {
            if (prevChat?.role === 'user') {
                reformatedChat[reformatedChat.length - 1].parts[0].text += '\nsystem:' + chat.content;
            } else {
                systemPrompt += '\n\n' + chat.content;
            }
        } else {
            if (prevChat && prevChat.role === qRole) {
                if (prevChat.parts[prevChat.parts.length - 1]?.text) {
                    prevChat.parts[prevChat.parts.length - 1].text += '\n\n' + chat.content;
                } else {
                    prevChat.parts.push({
                        text: chat.content as string
                    });
                }
            } else {
                reformatedChat.push({
                    role: qRole as "user" | "model" | "function",
                    parts: [{
                        text: chat.content as string
                    }]
                });
            }
        }
    }

    // TODO: Tool calls 처리 (decodeToolCall, encodeToolCall는 MCP 제외)
    // 원본에서는 tool_calls를 파싱하여 functionCall로 변환하지만,
    // 서버 사이드에서는 MCP를 제외하므로 기본 구조만 제공

    // Safety settings
    const uncensoredCategory = [
        {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_HARASSMENT",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "threshold": "BLOCK_NONE"
        },
        {
            "category": "HARM_CATEGORY_CIVIC_INTEGRITY",
            "threshold": "BLOCK_NONE"
        }
    ];

    if (modelInfo.flags.includes(LLMFlags.noCivilIntegrity)) {
        uncensoredCategory.splice(4, 1);
    }

    if (modelInfo.flags.includes(LLMFlags.geminiBlockOff)) {
        for (let i = 0; i < uncensoredCategory.length; i++) {
            uncensoredCategory[i].threshold = "OFF";
        }
    }

    // Parameters
    let para: string[] = ['temperature', 'top_p', 'top_k', 'presence_penalty', 'frequency_penalty'];

    if (modelInfo.flags.includes(LLMFlags.geminiThinking)) {
        para.push('thinking_tokens');
    }

    para = para.filter((v) => {
        return modelInfo.parameters.includes(v);
    });

    // Request body 구성
    const body: any = {
        contents: reformatedChat,
        generation_config: applyParameters({
            "maxOutputTokens": maxTokens
        }, para, {
            'top_p': "topP",
            'top_k': "topK",
            'presence_penalty': "presencePenalty",
            'frequency_penalty': "frequencyPenalty",
            'thinking_tokens': "thinkingBudget"
        }, arg.mode || 'model', database, {
            ignoreTopKIfZero: true
        }),
        safetySettings: uncensoredCategory,
        systemInstruction: {
            parts: [
                {
                    "text": systemPrompt
                }
            ]
        },
        tools: {
            functionDeclarations: arg?.tools?.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description,
                    parameters: simplifySchema(tool.inputSchema)
                };
            }) ?? []
        }
    };

    // Thinking 모드 처리
    if (modelInfo.flags.includes(LLMFlags.geminiThinking)) {
        const internalId = modelInfo.internalID;
        const thinkingBudget = body.generation_config.thinkingBudget;

        // Gemini 3 models use `thinking_level` (via thinkingConfig.thinkingLevel) instead of `thinking_budget`.
        if (internalId && /^gemini-3-/.test(internalId)) {
            const budgetNum = typeof thinkingBudget === 'number' ? thinkingBudget : Number(thinkingBudget);

            let thinkingLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
            if (internalId === 'gemini-3-flash-preview') {
                if (!Number.isFinite(budgetNum) || budgetNum >= 16384) thinkingLevel = 'HIGH';
                else if (budgetNum >= 4096) thinkingLevel = 'MEDIUM';
                else thinkingLevel = 'LOW';
            } else {
                if (!Number.isFinite(budgetNum) || budgetNum >= 8192) thinkingLevel = 'HIGH';
                else thinkingLevel = 'LOW';
            }

            body.generation_config.thinkingConfig = {
                "thinkingLevel": thinkingLevel,
                "includeThoughts": true,
            };
        } else {
            body.generation_config.thinkingConfig = {
                "thinkingBudget": thinkingBudget,
                "includeThoughts": true,
            };
        }

        delete body.generation_config.thinkingBudget;
    }

    if (systemPrompt === '') {
        delete body.systemInstruction;
    }

    // Audio/Image 출력 지원
    if (modelInfo.flags.includes(LLMFlags.hasAudioOutput)) {
        body.generation_config.responseModalities = ['TEXT', 'AUDIO'];
        arg.useStreaming = false;
    }
    if (arg.imageResponse || modelInfo.flags.includes(LLMFlags.hasImageOutput)) {
        body.generation_config.responseModalities = ['TEXT', 'IMAGE'];
        arg.useStreaming = false;
    }

    // Media resolution
    if (database.gptVisionQuality === 'high') {
        body.generation_config.mediaResolution = "MEDIA_RESOLUTION_HIGH";
    } else {
        body.generation_config.mediaResolution = "MEDIA_RESOLUTION_MEDIUM";
    }

    const PROJECT_ID = database.google?.projectId;
    const REGION = database.vertexRegion;

    const isVertexGlobalOnlyModel = (modelId: string) => {
        return /^gemini-3-.*-preview$/.test(modelId);
    };

    // Vertex AI 인증 토큰 생성
    async function generateToken(email: string, key: string): Promise<string> {
        // Input validation
        if (!email.includes("gserviceaccount.com")) {
            throw new Error("Invalid Vertex client email. Must include gserviceaccount.com");
        }
        if (!key.includes("-----BEGIN PRIVATE KEY-----") ||
            !key.includes("-----END PRIVATE KEY-----")) {
            throw new Error("Invalid Vertex private key. Must include proper key markers.");
        }

        function str2ab(privateKey: string): Buffer {
            const binaryString = Buffer.from(
                privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n/g, ""),
                'base64'
            );
            return binaryString;
        }

        function base64url(source: Buffer): string {
            return source.toString('base64')
                .replace(/=+$/, "")
                .replace(/\+/g, "-")
                .replace(/\//g, "_");
        }

        const time = Math.floor(Date.now() / 1000);

        const header = {
            alg: "RS256",
            typ: "JWT",
        };

        const claimSet = {
            iss: email,
            iat: time,
            exp: time + 3600,
            scope: "https://www.googleapis.com/auth/cloud-platform",
            aud: "https://oauth2.googleapis.com/token",
        };

        const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
        const encodedClaimSet = base64url(Buffer.from(JSON.stringify(claimSet)));

        const privateKey = crypto.createPrivateKey({
            key: key,
            format: 'pem'
        });

        const signature = crypto.sign(
            "RSA-SHA256",
            Buffer.from(`${encodedHeader}.${encodedClaimSet}`),
            privateKey
        );

        const jwt = `${encodedHeader}.${encodedClaimSet}.${base64url(signature)}`;

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        if (!response.ok) {
            let errorText;
            try {
                errorText = JSON.stringify(await response.json());
            } catch {
                errorText = response.status.toString();
            }
            throw new Error(`Failed to refresh google access token: ${errorText}`);
        }

        const data = await response.json();
        const token = data.access_token;

        if (!token) {
            throw new Error("No google access token in the response");
        }

        // 데이터베이스에 토큰 저장 (vertexAccessToken, vertexAccessTokenExpires)
        database.vertexAccessToken = token;
        database.vertexAccessTokenExpires = Date.now() + 3600 * 1000; // 1시간 후 만료
        return token;
    }

    let headers: { [key: string]: string } = {};

    // JSON Schema 지원
    if (database.jsonSchemaEnabled || arg.schema) {
        // TODO: getGeneralJSONSchema 구현 필요
        body.generation_config.response_mime_type = "application/json";
        // body.generation_config.response_schema = getGeneralJSONSchema(arg.schema, ['$schema', 'additionalProperties']);
    }

    let url = '';
    let apiKey = arg.key || database.google?.accessToken;

    // URL 구성
    if (arg.customURL) {
        let baseURL = arg.customURL;
        if (!baseURL.endsWith('/')) {
            baseURL += '/';
        }
        const endpoint = arg.useStreaming ? 'streamGenerateContent' : 'generateContent';
        const u = new URL(`models/${modelInfo.internalID}:${endpoint}`, baseURL);
        u.searchParams.set('key', apiKey || '');
        if (arg.useStreaming) {
            u.searchParams.set('alt', 'sse');
        }
        url = u.toString();
    } else if (modelInfo.format === LLMFormat.VertexAIGemini) {
        if (!database.vertexAccessTokenExpires || database.vertexAccessTokenExpires < Date.now()) {
            if (!database.vertexClientEmail || !database.vertexPrivateKey) {
                return {
                    type: 'fail',
                    result: "Vertex AI authentication information is missing or incomplete. Please check your settings."
                };
            }
            headers['Authorization'] = "Bearer " + await generateToken(database.vertexClientEmail, database.vertexPrivateKey);
        } else {
            headers['Authorization'] = "Bearer " + (database.vertexAccessToken || '');
        }

        const endpoint = arg.useStreaming ? 'streamGenerateContent?alt=sse' : 'generateContent';
        const effectiveRegion = isVertexGlobalOnlyModel(modelInfo.internalID) ? 'global' : REGION;

        url = effectiveRegion === 'global' ?
            `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${effectiveRegion}/publishers/google/models/${modelInfo.internalID}:${endpoint}` :
            `https://${effectiveRegion}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${effectiveRegion}/publishers/google/models/${modelInfo.internalID}:${endpoint}`;
    } else if (modelInfo.format === LLMFormat.GoogleCloud && arg.useStreaming) {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${modelInfo.internalID}:streamGenerateContent?key=${apiKey}&alt=sse`;
    } else {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${modelInfo.internalID}:generateContent?key=${apiKey}`;
    }

    // Tools가 비어있으면 제거
    if (body.tools?.functionDeclarations?.length === 0) {
        body.tools = undefined;
    }

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                url: url,
                body: body,
                headers: headers
            })
        };
    }

    return requestGoogle(url, body, headers, arg, database, userId);
}

/**
 * Google API 요청 실행
 */
async function requestGoogle(
    url: string,
    body: any,
    headers: { [key: string]: string },
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    // Fallback 처리
    const fallBackGemini = async (originalError: string): Promise<RequestDataResponse> => {
        if (!database.antiServerOverloads) {
            return {
                type: 'fail',
                result: originalError,
                failByServerError: true
            };
        }

        if (arg?.abortSignal?.aborted) {
            return {
                type: 'fail',
                result: originalError,
                failByServerError: true
            };
        }

        // TODO: Fallback 로직 구현
        return {
            type: 'fail',
            result: originalError,
            failByServerError: true
        };
    };

    // 텍스트 응답 처리
    const processTextResponse = (rDatas: { text: string, thought?: boolean }[]): string => {
        if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
            for (let i = 0; i < rDatas.length; i++) {
                const extracted = extractJSON(rDatas[i].text, arg.extractJson || '', undefined);
                rDatas[i].text = extracted;
            }
        }
        const thoughts = rDatas.filter(d => d.thought).map(d => d.text).join('\n\n');
        const content = rDatas.filter(d => !d.thought).map(d => d.text).join('\n\n');
        return (thoughts ? `<Thoughts>\n\n${thoughts}\n\n</Thoughts>\n\n` : '') + content;
    };

    // 스트리밍 처리
    if ((arg.modelInfo?.format === LLMFormat.GoogleCloud || arg.modelInfo?.format === LLMFormat.VertexAIGemini) && arg.useStreaming) {
        headers['Content-Type'] = 'application/json';

        if (arg.previewBody) {
            return {
                type: 'success',
                result: JSON.stringify({
                    url: url,
                    body: body,
                    headers: headers
                })
            };
        }

        const f = await fetch(url, {
            headers: headers,
            body: JSON.stringify(body),
            method: 'POST',
            signal: arg.abortSignal || undefined,
        });

        if (f.status !== 200) {
            const text = await f.text();
            if (text.includes('RESOURCE_EXHAUSTED')) {
                return fallBackGemini(text);
            }
            return {
                type: 'fail',
                result: text
            };
        }

        const transtream = getTranStream();
        if (f.body) {
            f.body.pipeTo(transtream.writable);
            return {
                type: 'streaming',
                result: wrapToolStream(transtream.readable, body, headers, url, arg, database, userId)
            };
        }

        return {
            type: 'fail',
            result: 'No response body'
        };
    }

    // 비스트리밍 처리
    const res = await fetch(url, {
        headers: headers,
        body: JSON.stringify(body),
        signal: arg.abortSignal || undefined,
    });

    if (!res.ok) {
        const text = JSON.stringify(await res.json());
        if (text.includes('RESOURCE_EXHAUSTED')) {
            return fallBackGemini(text);
        }
        return {
            type: 'fail',
            result: `${text}`
        };
    }

    const data = await res.json();
    let rDatas: { text: string, thought?: boolean }[] = [];

    // 응답 데이터 처리
    const processDataItem = async (data: any): Promise<GeminiPart[]> => {
        const parts = data?.candidates?.[0]?.content?.parts as GeminiPart[];

        if (parts) {
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (part.text) {
                    rDatas.push({
                        text: part.text,
                        thought: part.thought
                    });
                }

                if (part.inlineData) {
                    // TODO: 이미지/오디오 처리 (writeInlayImage, setInlayAsset)
                    // 서버 사이드에서는 나중에 구현
                    if (part.inlineData.mimeType.startsWith('image/')) {
                        // const id = uuidv4();
                        // await writeInlayImage(...);
                        // rDatas.push({ text: `{{inlayeddata::${id}}}` });
                    } else {
                        // const id = uuidv4();
                        // await setInlayAsset(id, {...});
                    }
                }
            }
        }
        return parts || [];
    };

    // 다중 응답 처리
    let parts: GeminiPart[] = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            const p = await processDataItem(item);
            parts = parts.concat(p);
        }
    } else {
        const p = await processDataItem(data);
        parts = parts.concat(p);
    }
    parts = parts.filter((p) => p);

    // Function calls 처리
    const calls = parts.filter((p) => !!p?.functionCall).map((p) => p?.functionCall as GeminiFunctionCall);

    if (calls.length > 0) {
        const chat = body.contents as GeminiChat[];

        // Add the model response part to the request content (only function calls if simplifiedToolUse is enabled)
        if (database.simplifiedToolUse) {
            chat.push({
                role: 'model',
                parts: calls.map((call) => {
                    return {
                        functionCall: {
                            name: call.name,
                            args: call.args
                        }
                    } as GeminiPart;
                })
            });
        } else {
            // Add the model response part to the request content (text response and function calls)
            chat.push({
                role: 'model',
                parts: parts.filter((p) => !p.thought)
            });
        }

        // If the last part is a model response, merge it with the previous model response
        if (chat[chat.length - 2]?.role === 'model') {
            chat[chat.length - 2].parts = chat[chat.length - 2].parts.concat(chat[chat.length - 1].parts);
            chat.pop();
        }

        const functionParts: GeminiPart[] = [];
        const callCodes: string[] = [];
        const tools = arg?.tools ?? [];

        // Handle tool calls (MCP 제외)
        for (const call of calls) {
            const functionName = call.name;
            const functionArgs = call.args;

            const tool = tools.find((t) => t.name === functionName);
            if (tool) {
                // TODO: Tool 실행 로직 구현 (MCP 제외)
                // 현재는 기본 구조만 제공
                console.warn(`Tool ${functionName} execution is not yet fully implemented in server-side (MCP excluded)`);
                
                // Placeholder for tool result
                const result = [{ type: 'text' as const, text: `Tool ${functionName} execution not yet implemented` }];
                
                if (result.length === 0) {
                    functionParts.push({
                        functionResponse: {
                            name: call.name,
                            response: 'No response from tool.'
                        }
                    });
                }

                // Store the encoded tool call history for later use
                if (arg.rememberToolUsage) {
                    // TODO: encodeToolCall 구현 (MCP 제외)
                    callCodes.push(`<tool_call>${JSON.stringify({ call: { id: call.id, name: call.name, arg: call.args }, response: result })}</tool_call>`);
                }

                for (let i = 0; i < result.length; i++) {
                    let response: any = result[i].text;
                    try {
                        // Try JSON parse
                        response = {
                            data: JSON.parse(response)
                        };
                    } catch (error) {
                        response = {
                            data: response
                        };
                    }
                    functionParts.push({
                        functionResponse: {
                            name: call.name,
                            response
                        }
                    });
                }
            } else {
                functionParts.push({
                    functionResponse: {
                        name: call.name,
                        response: `Tool ${call.name} not found.`
                    }
                });
            }
        }

        // Add the user response part to the request content (function responses)
        chat.push({
            role: 'function',
            parts: functionParts
        });

        body.contents = chat;

        // Send the next request recursively
        let resRec;
        let attempt = 0;
        do {
            attempt++;
            resRec = await requestGoogle(url, body, headers, arg, database, userId);

            if (resRec.type !== 'fail') {
                break;
            }
        } while (attempt <= database.requestRetrys); // Retry up to database.requestRetrys times

        // Does not include the text response if simplifiedToolUse is enabled
        const textResult = processTextResponse(rDatas);
        const result = (database.simplifiedToolUse ? '' : textResult + '\n\n') + callCodes.join('\n\n');

        // If the next request fails, only the responses so far are returned
        if (resRec.type === 'fail') {
            console.error('Failed to fetch model response after tool execution');
            return {
                type: 'success',
                result: result
            };
        } else if (resRec.type === 'success') {
            return {
                type: 'success',
                result: result + '\n\n' + resRec.result
            };
        }

        return resRec;
    }

    const result = processTextResponse(rDatas);

    if (!result) {
        return {
            type: 'fail',
            result: `Got empty response: ${JSON.stringify(data)}`
        };
    }

    return {
        type: 'success',
        result: result
    };
}

/**
 * 스트림 변환 (SSE 파싱)
 */
function getTranStream(): TransformStream<Uint8Array, StreamResponseChunk> {
    let buffer = '';

    return new TransformStream<Uint8Array, StreamResponseChunk>({
        transform(chunk, control) {
            buffer += new TextDecoder().decode(chunk);
            const lines = buffer.split('\n');

            let readed = initStreamState();

            try {
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') {
                            control.close();
                            return;
                        }

                        try {
                            const jsonData = JSON.parse(dataStr);

                            if (jsonData.candidates?.[0]?.content?.parts) {
                                const parts = jsonData.candidates[0].content.parts;
                                for (const part of parts) {
                                    if (part.text) {
                                        readed["__thoughts"] += readed["__last_thought"];
                                        readed["__last_thought"] = "";
                                        if (part.thought) {
                                            readed["__last_thought"] = part.text;
                                        } else {
                                            readed["0"] += part.text;
                                        }
                                        if (part.thoughtSignature) {
                                            readed["__sign_text"] = part.thoughtSignature;
                                        }
                                    }
                                    if (part.functionCall) {
                                        const toolCallsData = JSON.parse(readed["__tool_calls"] || "[]");
                                        toolCallsData.push(part.functionCall);
                                        readed["__tool_calls"] = JSON.stringify(toolCallsData);
                                        if (part.thoughtSignature) {
                                            readed["__sign_function"] = part.thoughtSignature;
                                        }
                                    }
                                }
                            }
                        } catch (error) {
                            // Ignore parse errors
                        }
                    }
                }
                control.enqueue(readed);
            } catch (error) {
                // Ignore errors
            }
        },
        flush(control) {
            control.close();
        }
    });
}

/**
 * Stream state 초기화
 */
function initStreamState(state?: { [key: string]: string }): { [key: string]: string } {
    if (!state) {
        return {
            "__sign_text": "",
            "__sign_function": "",
            "__last_thought": "",
            "__thoughts": "",
            "__tool_calls": "[]",
            "0": ""
        };
    }
    state["__sign_text"] = state["__sign_text"] || "";
    state["__sign_function"] = state["__sign_function"] || "";
    state["__last_thought"] = state["__last_thought"] || "";
    state["__thoughts"] = state["__thoughts"] || "";
    state["__tool_calls"] = state["__tool_calls"] || "[]";
    state["0"] = state["0"] || "";
    return state;
}

/**
 * Tool stream 래퍼 (MCP tool calls 제외)
 */
function wrapToolStream(
    stream: ReadableStream<StreamResponseChunk>,
    body: any,
    headers: Record<string, string>,
    url: string,
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): ReadableStream<StreamResponseChunk> {
    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            let reader = stream.getReader();
            let prefix = '';
            let lastValue = initStreamState();

            while (true) {
                let { done, value } = await reader.read();

                value = initStreamState(value);

                if (arg.extractJson && (database.jsonSchemaEnabled || arg.schema)) {
                    for (const key in value) {
                        if (key.startsWith('__')) continue;
                        const extracted = extractJSON(value[key], arg.extractJson || '', undefined);
                        value[key] = extracted;
                    }
                }

                // TODO: Tool calls 처리 (MCP 제외)
                const toolCallsData = JSON.parse(value["__tool_calls"] || "[]");
                if (toolCallsData.length > 0) {
                    console.warn('Tool calls in streaming are not yet fully supported in server-side (MCP excluded)');
                    // 원본에서는 callTool을 호출하여 재귀적으로 요청하지만,
                    // 서버 사이드에서는 MCP를 제외하므로 기본 구조만 제공
                }

                // Thoughts 처리
                if (value["__thoughts"] || value["__last_thought"]) {
                    const thoughts = (value["__thoughts"] || "") + (value["__last_thought"] || "");
                    if (thoughts) {
                        value["0"] = `<Thoughts>\n\n${thoughts}\n\n</Thoughts>\n\n${value["0"] || ''}`;
                    }
                }

                lastValue = value;
                controller.enqueue(value);

                if (done) {
                    controller.close();
                    break;
                }
            }
        }
    });
}
