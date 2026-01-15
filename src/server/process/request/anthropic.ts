/**
 * Anthropic (Claude) API 구현
 * 원본: src/ts/process/request/anthropic.ts (982 lines)
 */

import type { Database } from '../../database';
import type { RequestDataArgumentExtended, RequestDataResponse, StreamResponseChunk } from './types';
import { applyParameters } from './utils';
import { getModelInfo, LLMFormat } from '../../model/modellist';
import { simplifySchema } from '../../util';
import { extractJSON } from '../prompt/templates';
import { v4 as uuidv4 } from 'uuid';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { sleep } from '../../util';

interface Claude3TextBlock {
    type: 'text';
    text: string;
    cache_control?: {
        type: "ephemeral";
        ttl?: "5m" | "1h";
    };
}

interface Claude3ImageBlock {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
    cache_control?: {
        type: "ephemeral";
        ttl?: "5m" | "1h";
    };
}

interface Claude3ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: any;
    cache_control?: {
        type: "ephemeral";
    };
}

interface Claude3ToolResponseBlock {
    type: "tool_result";
    tool_use_id: string;
    content: Claude3ContentBlock[];
    cache_control?: {
        type: "ephemeral";
        ttl?: "5m" | "1h";
    };
}

type Claude3ContentBlock = Claude3TextBlock | Claude3ImageBlock | Claude3ToolUseBlock | Claude3ToolResponseBlock;

interface Claude3Chat {
    role: 'user' | 'assistant';
    content: Claude3ContentBlock[];
}

interface Claude3ExtendedChat {
    role: 'user' | 'assistant';
    content: Claude3ContentBlock[] | string;
}

/**
 * Claude API 요청
 */
export async function requestClaude(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    const formated = arg.formated;
    const aiModel = arg.aiModel || database.aiModel;
    const modelInfo = arg.modelInfo || await getModelInfo(aiModel, userId);
    const useStreaming = arg.useStreaming;
    let replacerURL = arg.customURL ?? 'https://api.anthropic.com/v1/messages';
    let apiKey = arg.key || ((aiModel === 'reverse_proxy') ? database.proxyKey : database.claudeAPIKey);
    const maxTokens = arg.maxTokens || database.maxResponse;

    // URL 자동 완성
    if (aiModel === 'reverse_proxy' && database.autofillRequestUrl) {
        if (replacerURL.endsWith('v1')) {
            replacerURL += '/messages';
        } else if (replacerURL.endsWith('v1/')) {
            replacerURL += 'messages';
        } else if (!(replacerURL.endsWith('messages') || replacerURL.endsWith('messages/'))) {
            if (replacerURL.endsWith('/')) {
                replacerURL += 'v1/messages';
            } else {
                replacerURL += '/v1/messages';
            }
        }
    }

    let claudeChat: Claude3Chat[] = [];
    let systemPrompt: string = '';

    // 메시지 포맷팅 함수
    const addClaudeChat = (chat: {
        role: 'user' | 'assistant';
        content: string;
        cache: boolean;
    }, multimodals?: Array<{ type: 'image' | 'video' | 'audio'; base64: string; width?: number; height?: number }>) => {
        if (claudeChat.length > 0 && claudeChat[claudeChat.length - 1].role === chat.role) {
            let content = claudeChat[claudeChat.length - 1].content;
            if (multimodals && multimodals.length > 0 && !Array.isArray(content)) {
                content = [{
                    type: 'text',
                    text: content as any
                }];
            }

            if (Array.isArray(content)) {
                let lastContent = content[content.length - 1];
                if (lastContent?.type === 'text') {
                    lastContent.text += "\n\n" + chat.content;
                    content[content.length - 1] = lastContent;
                } else {
                    content.push({
                        type: 'text',
                        text: chat.content
                    });
                }

                if (multimodals && multimodals.length > 0) {
                    for (const modal of multimodals) {
                        if (modal.type === 'image') {
                            const dataurl = modal.base64;
                            const base64 = dataurl.split(',')[1];
                            const mediaType = dataurl.split(';')[0].split(':')[1];

                            content.unshift({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64
                                }
                            });
                        }
                    }
                }
            }
            if (chat.cache) {
                if (database.claude1HourCaching) {
                    content[content.length - 1].cache_control = {
                        type: 'ephemeral',
                        ttl: "1h"
                    };
                } else {
                    content[content.length - 1].cache_control = {
                        type: 'ephemeral'
                    };
                }
            }
            claudeChat[claudeChat.length - 1].content = content;
        } else {
            let formatedChat: Claude3Chat = {
                role: chat.role,
                content: [{
                    type: 'text',
                    text: chat.content
                }]
            };
            if (multimodals && multimodals.length > 0) {
                formatedChat.content = [{
                    type: 'text',
                    text: chat.content
                }];
                for (const modal of multimodals) {
                    if (modal.type === 'image') {
                        const dataurl = modal.base64;
                        const base64 = dataurl.split(',')[1];
                        const mediaType = dataurl.split(';')[0].split(':')[1];

                        formatedChat.content.unshift({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64
                            }
                        });
                    }
                }
            }
            if (chat.cache) {
                if (database.claude1HourCaching) {
                    formatedChat.content[0].cache_control = {
                        type: 'ephemeral',
                        ttl: "1h"
                    };
                } else {
                    formatedChat.content[0].cache_control = {
                        type: 'ephemeral'
                    };
                }
            }
            claudeChat.push(formatedChat);
        }
    };

    // OpenAIChat을 Claude3Chat으로 변환
    for (const chat of formated) {
        switch (chat.role) {
            case 'user': {
                addClaudeChat({
                    role: 'user',
                    content: chat.content as string,
                    cache: chat.cachePoint || false
                }, chat.multimodals);
                break;
            }
            case 'assistant': {
                addClaudeChat({
                    role: 'assistant',
                    content: chat.content as string,
                    cache: chat.cachePoint || false
                }, chat.multimodals);
                break;
            }
            case 'system': {
                if (claudeChat.length === 0) {
                    systemPrompt += '\n\n' + chat.content;
                } else {
                    addClaudeChat({
                        role: 'user',
                        content: "System: " + chat.content,
                        cache: chat.cachePoint || false
                    });
                }
                break;
            }
            case 'function': {
                // ignore function for now
                break;
            }
        }
    }

    if (claudeChat.length === 0 && systemPrompt === '') {
        return {
            type: 'fail',
            result: 'No input'
        };
    }
    if (claudeChat.length === 0 && systemPrompt !== '') {
        claudeChat.push({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        });
        systemPrompt = '';
    }
    if (claudeChat[0].role !== 'user') {
        claudeChat.unshift({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        });
    }

    // TODO: Tool calls 처리 (decodeToolCall, encodeToolCall는 MCP 제외)
    // 원본에서는 <tool_call> 태그를 파싱하여 tool_use 블록으로 변환하지만,
    // 서버 사이드에서는 MCP를 제외하므로 기본 구조만 제공

    let finalChat: Claude3ExtendedChat[] = claudeChat;

    if (aiModel === 'reverse_proxy') {
        finalChat = claudeChat.map((v): Claude3ExtendedChat => {
            if (v.content.length > 0 && v.content[0].type === 'text') {
                return {
                    role: v.role,
                    content: v.content[0].text
                };
            }
            return v;
        });
    }

    // Request body 구성
    let body: any = applyParameters({
        model: modelInfo.internalID,
        messages: finalChat,
        system: systemPrompt.trim(),
        max_tokens: maxTokens,
        stream: useStreaming ?? false
    }, modelInfo.parameters, {
        'thinking_tokens': 'thinking.budget_tokens'
    }, arg.mode || 'model', database);

    if (body?.thinking?.budget_tokens === 0) {
        delete body.thinking;
    } else if (body?.thinking?.budget_tokens && body?.thinking?.budget_tokens > 0) {
        body.thinking.type = 'enabled';
    } else if (body?.thinking?.budget_tokens === null) {
        delete body.thinking;
    }

    if (systemPrompt === '') {
        delete body.system;
    }

    // AWS Bedrock 지원
    const bedrock = modelInfo.format === LLMFormat.AWSBedrockClaude;

    if (bedrock && aiModel !== 'reverse_proxy') {
        function getCredentialParts(key: string) {
            const [accessKeyId, secretAccessKey, region] = key.split(":");
            if (!accessKeyId || !secretAccessKey || !region) {
                throw new Error("The key assigned to this request is invalid.");
            }
            return { accessKeyId, secretAccessKey, region };
        }
        const { accessKeyId, secretAccessKey, region } = getCredentialParts(apiKey);

        const AMZ_HOST = "bedrock-runtime.%REGION%.amazonaws.com";
        const host = AMZ_HOST.replace("%REGION%", region);
        const stream = false; // TODO: Bedrock streaming 지원

        const datePart = Number(modelInfo.internalID.match(/(\d{8})/)?.[0]);
        const awsModel = datePart && datePart >= 20250929 ? "global." + modelInfo.internalID : "us." + modelInfo.internalID;
        const url = `https://${host}/model/${awsModel}/invoke${stream ? "-with-response-stream" : ""}`;

        let params = { ...body };
        params.anthropic_version = "bedrock-2023-05-31";
        delete params.model;
        delete params.stream;
        if (params.thinking?.type === "enabled") {
            params.temperature = 1.0;
            delete params.top_k;
            delete params.top_p;
        }

        const rq = new HttpRequest({
            method: "POST",
            protocol: "https:",
            hostname: host,
            path: `/model/${awsModel}/invoke${stream ? "-with-response-stream" : ""}`,
            headers: {
                ["Host"]: host,
                ["Content-Type"]: "application/json",
                ["accept"]: "application/json",
            },
            body: JSON.stringify(params),
        });

        const signer = new SignatureV4({
            sha256: Sha256,
            credentials: { accessKeyId, secretAccessKey },
            region,
            service: "bedrock",
        });

        const signed = await signer.sign(rq);

        if (arg.previewBody) {
            return {
                type: 'success',
                result: JSON.stringify({
                    url: url,
                    body: params,
                    headers: signed.headers
                })
            };
        }

        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify(params),
            headers: signed.headers as Record<string, string>,
        });

        if (!res.ok) {
            const errorText = await res.text();
            return {
                type: 'fail',
                result: errorText
            };
        }

        const data = await res.json();
        if (data.error) {
            return {
                type: 'fail',
                result: JSON.stringify(data.error)
            };
        }

        const contents = data?.content;
        if (!contents || contents.length === 0) {
            return {
                type: 'fail',
                result: JSON.stringify(data)
            };
        }

        let resText = '';
        let thinking = false;
        for (const content of contents) {
            if (content.type === 'text') {
                if (thinking) {
                    resText += "</Thoughts>\n\n";
                    thinking = false;
                }
                resText += content.text;
            }
            if (content.type === 'thinking') {
                if (!thinking) {
                    resText += "<Thoughts>\n";
                    thinking = true;
                }
                resText += content.thinking ?? '';
            }
            if (content.type === 'redacted_thinking') {
                if (!thinking) {
                    resText += "<Thoughts>\n";
                    thinking = true;
                }
                resText += '\n{{redacted_thinking}}\n';
            }
        }

        if (arg.extractJson && database.jsonSchemaEnabled) {
            return {
                type: 'success',
                result: extractJSON(resText, arg.extractJson, undefined)
            };
        }
        return {
            type: 'success',
            result: resText
        };
    }

    // Headers 구성
    let headers: { [key: string]: string } = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "accept": "application/json",
    };

    let betas: string[] = [];

    if (body.max_tokens > 8192) {
        betas.push('output-128k-2025-02-19');
    }

    if (database.claude1HourCaching) {
        betas.push('extended-cache-ttl-2025-04-11');
    }

    if (betas.length > 0) {
        headers['anthropic-beta'] = betas.join(',');
    }

    if (database.usePlainFetch) {
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    // Tools 처리
    if (arg.tools && arg.tools.length > 0) {
        body.tools = arg.tools.map((v) => {
            return {
                name: v.name,
                description: v.description,
                input_schema: simplifySchema(v.inputSchema)
            };
        });
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

    // Batching 지원
    if (database.claudeBatching) {
        if (body.stream !== undefined) {
            delete body.stream;
        }
        const id = uuidv4();
        const resp = await fetch(replacerURL + '/batches', {
            body: JSON.stringify({
                requests: [{
                    custom_id: id,
                    params: body,
                }]
            }),
            method: 'POST',
            signal: arg.abortSignal || undefined,
            headers: headers
        });

        if (resp.status !== 200) {
            const errorText = await resp.text();
            return {
                type: 'fail',
                result: errorText
            };
        }

        const r = await resp.json();

        if (!r.id) {
            return {
                type: 'fail',
                result: 'No results URL returned from Claude batch request'
            };
        }

        const resultsUrl = replacerURL + `/batches/${r.id}/results`;
        const statusUrl = replacerURL + `/batches/${r.id}`;

        let received = false;
        while (!received) {
            try {
                await sleep(3000);
                if (arg?.abortSignal?.aborted) {
                    return {
                        type: 'fail',
                        result: 'Request aborted'
                    };
                }

                const statusRes = await fetch(statusUrl, {
                    method: 'GET',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    signal: arg.abortSignal || undefined,
                });

                if (statusRes.status !== 200) {
                    const errorText = await statusRes.text();
                    return {
                        type: 'fail',
                        result: errorText
                    };
                }

                const statusData = await statusRes.json();

                if (statusData.processing_status !== 'ended') {
                    continue;
                }

                const batchRes = await fetch(resultsUrl, {
                    method: 'GET',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    signal: arg.abortSignal || undefined,
                });

                if (batchRes.status !== 200) {
                    const errorText = await batchRes.text();
                    return {
                        type: 'fail',
                        result: errorText
                    };
                }

                // JSONL 파싱
                const batchTextData = (await batchRes.text())
                    .split('\n')
                    .filter((v) => v.trim() !== '')
                    .map((v) => {
                        try {
                            return JSON.parse(v);
                        } catch (error) {
                            return null;
                        }
                    })
                    .filter((v) => v !== null);

                for (const batchData of batchTextData) {
                    const type = batchData?.result?.type;
                    console.log('Claude batch result type:', type);
                    if (batchData?.result?.type === 'succeeded') {
                        const batchContents = batchData.result.output.content;
                        let batchResText = '';
                        let batchThinking = false;
                        for (const content of batchContents) {
                            if (content.type === 'text') {
                                if (batchThinking) {
                                    batchResText += "</Thoughts>\n\n";
                                    batchThinking = false;
                                }
                                batchResText += content.text;
                            }
                            if (content.type === 'thinking') {
                                if (!batchThinking) {
                                    batchResText += "<Thoughts>\n";
                                    batchThinking = true;
                                }
                                batchResText += content.thinking ?? '';
                            }
                            if (content.type === 'redacted_thinking') {
                                if (!batchThinking) {
                                    batchResText += "<Thoughts>\n";
                                    batchThinking = true;
                                }
                                batchResText += '\n{{redacted_thinking}}\n';
                            }
                        }

                        arg.additionalOutput ??= "";
                        if (arg.extractJson && database.jsonSchemaEnabled) {
                            return {
                                type: 'success',
                                result: arg.additionalOutput + extractJSON(batchResText, arg.extractJson, undefined)
                            };
                        }
                        return {
                            type: 'success',
                            result: arg.additionalOutput + batchResText
                        };
                    } else if (batchData?.result?.type === 'error') {
                        return {
                            type: 'fail',
                            result: JSON.stringify(batchData.result.error)
                        };
                    }
                }

                return {
                    type: 'fail',
                    result: 'No successful batch result found'
                };
            } catch (error) {
                console.error('Error in Claude batching:', error);
                return {
                    type: 'fail',
                    result: `Batching error: ${error}`
                };
            }
        }
    }

    // 스트리밍 처리
    if (useStreaming) {
        body.stream = true;

        const res = await fetch(replacerURL, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
            signal: arg.abortSignal || undefined,
        });

        if (!res.ok) {
            const errorText = await res.text();
            return {
                type: 'fail',
                result: errorText,
                failByServerError: errorText.toLowerCase().includes('overload')
            };
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            const errorText = await res.text();
            return {
                type: 'fail',
                result: errorText
            };
        }

        const stream = getTranStream(arg, database);
        if (res.body) {
            res.body.pipeTo(stream.writable);
            return {
                type: 'streaming',
                result: stream.readable
            };
        }

        return {
            type: 'fail',
            result: 'No response body'
        };
    }

    // 비스트리밍 처리
    const res = await fetch(replacerURL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
        signal: arg.abortSignal || undefined,
    });

    if (!res.ok) {
        const stringlified = JSON.stringify(await res.json());
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLowerCase()?.includes('overload')
        };
    }

    const data = await res.json();
    if (data.error) {
        const stringlified = JSON.stringify(data.error);
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLowerCase()?.includes('overload')
        };
    }

    const contents = data?.content;
    if (!contents || contents.length === 0) {
        return {
            type: 'fail',
            result: JSON.stringify(data)
        };
    }

    // Tool use 처리 (MCP 제외)
    const hasToolUse = (contents as any[]).some((v) => v.type === 'tool_use');
    if (hasToolUse) {
        const messages: Claude3ExtendedChat[] = body.messages as Claude3ExtendedChat[];
        const response: Claude3Chat = {
            role: 'user',
            content: []
        };
        
        for (const content of (contents as Claude3ContentBlock[])) {
            if (messages[messages.length - 1]?.role !== 'assistant') {
                messages.push({
                    role: 'assistant',
                    content: []
                });
            }
            if (typeof messages[messages.length - 1].content === 'string') {
                messages[messages.length - 1].content = [{
                    type: 'text',
                    text: messages[messages.length - 1].content as string
                }];
            }

            if (content.type === 'tool_use') {
                // Tool 실행 (MCP 제외 - 기본 구조만 제공)
                // 원본에서는 callTool을 호출하지만, 서버 사이드에서는 MCP를 제외
                const tool = arg.tools?.find((t) => t.name === content.name);
                let toolResults: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> = [];
                
                if (tool) {
                    // TODO: Tool 실행 로직 구현 (MCP 제외)
                    // 현재는 기본 구조만 제공
                    console.warn(`Tool ${content.name} execution is not yet fully implemented in server-side (MCP excluded)`);
                    toolResults.push({
                        type: 'text',
                        text: `Tool ${content.name} execution not yet implemented`
                    });
                } else {
                    toolResults.push({
                        type: 'text',
                        text: `Tool ${content.name} not found`
                    });
                }
                
                const r: Claude3ToolResponseBlock = {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: toolResults
                };
                response.content.push(r);
                
                if (arg.rememberToolUsage) {
                    // TODO: encodeToolCall 구현 (MCP 제외)
                    arg.additionalOutput ??= '';
                    arg.additionalOutput += `\n<tool_call>${JSON.stringify({ call: { id: content.id, name: content.name, arg: content.input }, response: toolResults })}</tool_call>\n`;
                }
            }

            (messages[messages.length - 1] as Claude3Chat).content.push(content);
        }

        messages.push(response);

        body.messages = messages;
        body.stream = false;

        // 재귀 호출
        return requestClaude(arg, database, userId);
    }

    let resText = '';
    let thinking = false;
    for (const content of contents) {
        if (content.type === 'text') {
            if (thinking) {
                resText += "</Thoughts>\n\n";
                thinking = false;
            }
            resText += content.text;
        }
        if (content.type === 'thinking') {
            if (!thinking) {
                resText += "<Thoughts>\n";
                thinking = true;
            }
            resText += content.thinking ?? '';
        }
        if (content.type === 'redacted_thinking') {
            if (!thinking) {
                resText += "<Thoughts>\n";
                thinking = true;
            }
            resText += '\n{{redacted_thinking}}\n';
        }
    }

    arg.additionalOutput ??= "";
    if (arg.extractJson && database.jsonSchemaEnabled) {
        return {
            type: 'success',
            result: arg.additionalOutput + extractJSON(resText, arg.extractJson, undefined)
        };
    }
    return {
        type: 'success',
        result: arg.additionalOutput + resText
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
                            if (reasoningContent) {
                                reasoningContent = reasoningContent.replace(/\<think\>/gm, '');
                            }
                            control.enqueue({
                                "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"] || ''}`
                            });
                            return;
                        }
                            const parsedData = JSON.parse(rawChunk);

                            if (parsedData?.type === 'content_block_delta') {
                                if (parsedData?.delta?.type === 'text' || parsedData.delta?.type === 'text_delta') {
                                    if (reasoningContent) {
                                        readed["0"] = (readed["0"] || "").replace(/(.*)\<\/think\>/gms, (m, p1) => {
                                            reasoningContent = p1;
                                            return "";
                                        });
                                        reasoningContent = reasoningContent.replace(/\<think\>/gm, '');
                                    }
                                    readed["0"] = (readed["0"] || "") + (parsedData.delta?.text ?? '');
                                }

                                if (parsedData?.delta?.type === 'thinking' || parsedData.delta?.type === 'thinking_delta') {
                                    if (!reasoningContent) {
                                        reasoningContent = "<Thoughts>\n";
                                    }
                                    reasoningContent += parsedData.delta?.thinking ?? '';
                                }

                                if (parsedData?.delta?.type === 'redacted_thinking') {
                                    if (!reasoningContent) {
                                        reasoningContent = "<Thoughts>\n";
                                    }
                                    reasoningContent += '\n{{redacted_thinking}}\n';
                                }
                            }

                            if (parsedData?.type === 'error') {
                                const errormsg: string = parsedData?.error?.message;
                                if (errormsg && errormsg.toLowerCase().includes('overload') && database.antiServerOverloads) {
                                    control.enqueue({
                                        "0": "Overload detected, retrying..."
                                    });
                                    // TODO: 재시도 로직 구현
                                } else {
                                    readed["0"] = (readed["0"] || "") + "Error:" + parsedData?.error?.message;
                                }
                            }
                        } catch (error) {
                            // Ignore parse errors
                        }
                    }
                }

                if (arg.extractJson && database.jsonSchemaEnabled) {
                    for (const key in readed) {
                        const extracted = extractJSON(readed[key], arg.extractJson || '', undefined);
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
