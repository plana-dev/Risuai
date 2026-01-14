/**
 * HypaMemory V2 서버 사이드 구현
 * 원본: src/ts/process/memory/hypav2.ts
 */

import { parseChatML } from '../../parser';
import type { Database, Chat, character, groupChat } from '../../database';
import type { OpenAIChat } from '../types';
import type { ChatTokenizer, TokenizerContext } from '../../tokenizer';
import { requestChatData } from '../request';
import { HypaProcessor } from './hypa-processor';
// runSummarizer는 서버 사이드에서 requestChatData를 사용하여 구현
import { stringlizeChat } from '../auxiliary/stringlize';

export interface HypaV2Data {
    lastMainChunkID: number;
    mainChunks: {
        id: number;
        text: string;
        chatMemos: Set<string>;
        lastChatMemo: string;
    }[];
    chunks: {
        mainChunkID: number;
        text: string;
    }[];
}

export interface SerializableHypaV2Data extends Omit<HypaV2Data, 'mainChunks'> {
    mainChunks: {
        id: number;
        text: string;
        chatMemos: string[];
        lastChatMemo: string;
    }[];
}

export interface OldHypaV2Data {
    chunks: {
        text: string;
        targetId: string;
    }[];
    mainChunks: {
        text: string;
        targetId: string;
    }[];
}

async function summary(
    stringlizedChat: string,
    database: Database,
    userId: string,
    chatId: string
): Promise<{ success: boolean; data: string }> {
    console.log("Summarizing");

    if (database.supaModelType === "distilbart") {
        try {
            // 서버 사이드에서는 LLM API를 사용하여 요약
            const summaryResponse = await requestChatData(
                {
                    formated: [
                        {
                            role: 'system',
                            content: 'Summarize the following conversation in a concise way, preserving important details and context.',
                        },
                        {
                            role: 'user',
                            content: stringlizedChat,
                        },
                    ],
                    useStreaming: false,
                    bias: {},
                },
                'memory',
                database,
                null,
                userId
            );
            
            if (summaryResponse.type === 'success') {
                return { success: true, data: summaryResponse.result };
            } else {
                throw new Error(typeof summaryResponse.result === 'string' ? summaryResponse.result : JSON.stringify(summaryResponse.result));
            }
        } catch (error) {
            return {
                success: false,
                data: "SupaMemory: Summarizer: " + `${error}`,
            };
        }
    }

    const supaPrompt =
        database.supaMemoryPrompt === ""
            ? "[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]\n"
            : database.supaMemoryPrompt;
    let result = "";

    if (database.supaModelType !== "subModel") {
        const promptbody = stringlizedChat + "\n\n" + supaPrompt + "\n\nOutput:";

        // 서버 사이드 fetch 사용
        const response = await fetch("https://api.openai.com/v1/completions", {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + database.supaMemoryKey,
            },
            method: "POST",
            body: JSON.stringify({
                model:
                    database.supaModelType === "curie"
                        ? "text-curie-001"
                        : database.supaModelType === "instruct35"
                            ? "gpt-3.5-turbo-instruct"
                            : "text-davinci-003",
                prompt: promptbody,
                max_tokens: 600,
                temperature: 0,
            }),
        });
        console.log("Using openAI instruct 3.5 for SupaMemory");

        try {
            if (!response.ok) {
                return {
                    success: false,
                    data: "SupaMemory: HTTP: " + JSON.stringify(response),
                };
            }

            const da = await response.json();
            result = da?.choices[0]?.text?.trim();

            if (!result) {
                return {
                    success: false,
                    data: "SupaMemory: HTTP: " + JSON.stringify(da),
                };
            }

            return { success: true, data: result };
        } catch (error) {
            return {
                success: false,
                data: "SupaMemory: HTTP: " + error,
            };
        }
    } else {
        let parsedPrompt = parseChatML(
            supaPrompt.replaceAll("{{slot}}", stringlizedChat),
            {
                parser: {
                    getDatabase: () => database,
                    getSelectedCharID: () => 0,
                    findCharacterbyId: () => null,
                },
                matcher: {
                    calcString: () => 0,
                    getMatcherMap: () => new Map(),
                    initMatcher: () => {},
                },
                block: {
                    getChatVar: () => '',
                    getGlobalChatVar: () => '',
                },
            }
        );

        const promptbody: OpenAIChat[] = (parsedPrompt ?? [
            {
                role: "user",
                content: stringlizedChat,
            },
            {
                role: "system",
                content: supaPrompt
            }
        ]).map(message => ({
            ...message,
            memo: "supaPrompt"
        }));
        console.log("Using submodel: ", database.subModel, "for supaMemory model");
        const da = await requestChatData(
            {
                formated: promptbody,
                bias: {},
                useStreaming: false,
                noMultiGen: true
            },
            'memory',
            database,
            null,
            userId
        );
        if (da.type === 'fail' || da.type === 'streaming' || da.type === 'multiline') {
            return {
                success: false,
                data: "SupaMemory: HTTP: " + da.result,
            };
        }
        result = da.result;
    }
    return { success: true, data: result };
}

function isSubset<T>(subset: Set<T>, superset: Set<T>): boolean {
    for (const item of subset) {
        if (!superset.has(item)) {
            return false;
        }
    }
    return true;
}

function isOldHypaV2Data(obj: any): obj is OldHypaV2Data {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        Array.isArray(obj.chunks) &&
        Array.isArray(obj.mainChunks) &&
        obj.chunks.every(chunk =>
            typeof chunk === 'object' &&
            chunk !== null &&
            typeof chunk.text === 'string' &&
            typeof chunk.targetId === 'string'
        ) &&
        obj.mainChunks.every(mainChunk =>
            typeof mainChunk === 'object' &&
            mainChunk !== null &&
            typeof mainChunk.text === 'string' &&
            typeof mainChunk.targetId === 'string'
        )
    );
}

function convertOldToNewHypaV2Data(oldData: OldHypaV2Data, chats: OpenAIChat[]): HypaV2Data {
    const oldMainChunks = oldData.mainChunks.slice().reverse();
    const oldChunks = oldData.chunks.slice();
    const newData: HypaV2Data = {
        lastMainChunkID: 0,
        mainChunks: [],
        chunks: [],
    };

    const mainChunkTargetIds = new Set<string>();
    for (const mc of oldMainChunks) {
        if (mc.targetId) {
            mainChunkTargetIds.add(mc.targetId);
        }
    }

    const chatMemoToIndex = new Map<string, number>();
    for (const tid of mainChunkTargetIds) {
        const idx = chats.findIndex(c => c.memo === tid);
        if (idx !== -1) {
            chatMemoToIndex.set(tid, idx);
        } else {
            chatMemoToIndex.set(tid, -1);
        }
    }

    for (let i = 0; i < oldMainChunks.length; i++) {
        const oldMainChunk = oldMainChunks[i];
        const targetId = oldMainChunk.targetId;
        const mainChunkText = oldMainChunk.text;

        const previousMainChunk = i > 0 ? oldMainChunks[i - 1] : null;
        const previousMainChunkTarget = previousMainChunk ? previousMainChunk.targetId : null;

        let chatMemos = new Set<string>();

        if (previousMainChunkTarget && targetId) {
            const startIndex = chatMemoToIndex.get(previousMainChunkTarget) ?? -1;
            const endIndex = chatMemoToIndex.get(targetId) ?? -1;

            if (startIndex !== -1 && endIndex !== -1) {
                const lowerIndex = Math.min(startIndex, endIndex);
                const upperIndex = Math.max(startIndex, endIndex);

                for (let j = lowerIndex; j <= upperIndex; j++) {
                    chatMemos.add(chats[j].memo);
                }
            } else {
                continue;
            }
        } else {
            if (targetId) {
                const targetIndex = chatMemoToIndex.get(targetId) ?? -1;
                if (targetIndex !== -1) {
                    for (let j = 0; j <= targetIndex; j++) {
                        chatMemos.add(chats[j].memo);
                    }
                } else {
                    continue;
                }
            }
        }
        const newMainChunk = {
            id: newData.lastMainChunkID,
            text: mainChunkText,
            chatMemos: chatMemos,
            lastChatMemo: targetId,
        }
        newData.mainChunks.push(newMainChunk);
        newData.lastMainChunkID++;

        const matchingOldChunks = oldChunks.filter((oldChunk) => oldChunk.targetId === targetId);
        for (const oldChunk of matchingOldChunks) {
            newData.chunks.push({
                mainChunkID: newMainChunk.id,
                text: oldChunk.text,
            });
        }
    }

    return newData;
}

function cleanInvalidChunks(
    chats: OpenAIChat[],
    data: HypaV2Data,
): void {
    const currentChatMemos = new Set(chats.map((chat) => chat.memo));

    data.mainChunks = data.mainChunks.filter((mainChunk) => {
        return isSubset(mainChunk.chatMemos, currentChatMemos);
    });

    const validMainChunkIds = new Set(data.mainChunks.map((mainChunk) => mainChunk.id));
    data.chunks = data.chunks.filter((chunk) =>
        validMainChunkIds.has(chunk.mainChunkID)
    );
    if (data.mainChunks.length > 0) {
        data.lastMainChunkID = data.mainChunks[data.mainChunks.length - 1].id;
    } else {
        data.lastMainChunkID = 0;
    }
}

function toSerializableHypaV2Data(data: HypaV2Data): SerializableHypaV2Data {
    return {
        ...data,
        mainChunks: data.mainChunks.map(mainChunk => ({
            ...mainChunk,
            chatMemos: Array.from(mainChunk.chatMemos),
        })),
    };
}

function toHypaV2Data(data: SerializableHypaV2Data): HypaV2Data {
    data.mainChunks.forEach((mainChunk) => {
        if (!Array.isArray(mainChunk.chatMemos)) {
            mainChunk.chatMemos = [];
        }
    });

    return {
        ...data,
        mainChunks: data.mainChunks.map(mainChunk => ({
            ...mainChunk,
            chatMemos: new Set(mainChunk.chatMemos),
        })),
    };
}

export async function hypaMemoryV2(
    chats: OpenAIChat[],
    currentTokens: number,
    maxContextTokens: number,
    room: Chat,
    char: character | groupChat,
    tokenizer: ChatTokenizer,
    tokenizerContext: TokenizerContext,
    database: Database,
    userId: string,
    chatId: string
): Promise<{
    currentTokens: number;
    chats: OpenAIChat[];
    error?: string;
    memory?: SerializableHypaV2Data;
}> {
    let data: HypaV2Data = {
        lastMainChunkID: 0,
        chunks: [],
        mainChunks: [],
    };

    currentTokens -= database.maxResponse;

    if (room.hypaV2Data) {
        if (isOldHypaV2Data(room.hypaV2Data)) {
            console.log("Old HypaV2 data detected. Converting to new format...");
            data = convertOldToNewHypaV2Data(room.hypaV2Data, chats);
        } else {
            data = toHypaV2Data(room.hypaV2Data);
        }
    }

    cleanInvalidChunks(chats, data);

    let allocatedTokens = database.hypaAllocatedTokens;
    let chunkSize = database.hypaChunkSize;
    currentTokens += allocatedTokens;
    let mainPrompt = "";
    const lastTwoChats = chats.slice(-2);
    let summarizationFailures = 0;
    const maxSummarizationFailures = 3;

    let idx = 0;
    if (data.mainChunks.length > 0) {
        const lastMainChunk = data.mainChunks[data.mainChunks.length - 1];
        const lastChatMemo = lastMainChunk.lastChatMemo;
        const lastChatIndex = chats.findIndex(chat => chat.memo === lastChatMemo);
        if (lastChatIndex !== -1) {
            idx = lastChatIndex + 1;

            const summarizedChats = chats.slice(0, lastChatIndex + 1);
            for (const chat of summarizedChats) {
                currentTokens -= await tokenizer.tokenizeChat(chat, tokenizerContext);
            }
        }
    }

    while (currentTokens > maxContextTokens) {
        const halfData: OpenAIChat[] = [];
        let halfDataTokens = 0;

        const startIdx = idx;

        console.log(
            "[HypaV2] Starting summarization iteration:",
            "\nCurrent Tokens (before):", currentTokens,
            "\nMax Context Tokens:", maxContextTokens,
            "\nStartIdx:", startIdx,
            "\nchunkSize:", chunkSize
        );

        while (
            halfDataTokens < chunkSize &&
            (idx < chats.length - 4)
            ) {
            const chat = chats[idx];
            const chatTokens = await tokenizer.tokenizeChat(chat, tokenizerContext);

            console.log(
                "[HypaV2] Evaluating chat for summarization:",
                "\nIndex:", idx,
                "\nRole:", chat.role,
                "\nContent:", chat.content,
                "\nchatTokens:", chatTokens,
                "\nhalfDataTokens so far:", halfDataTokens,
                "\nWould adding this exceed chunkSize?", (halfDataTokens + chatTokens > chunkSize)
            );

            if (idx === 0) {
                console.log("[HypaV2] Skipping index 0");
                idx++;
                continue;
            }

            if (!chat.content.trim()) {
                console.log(`[HypaV2] Skipping empty content of index ${idx}`);
                idx++;
                continue;
            }

            if (halfDataTokens + chatTokens > chunkSize) {
                break;
            }

            halfData.push(chat);
            halfDataTokens += chatTokens;
            idx++;
        }

        const endIdx = idx - 1;
        console.log(
            "[HypaV2] Summarization batch chosen with this:",
            "\nStartIdx:", startIdx,
            "\nEndIdx:", endIdx,
            "\nNumber of chats in halfData:", halfData.length,
            "\nTotal tokens in halfData:", halfDataTokens,
            "\nChats selected:", halfData.map(h => ({role: h.role, content: h.content}))
        );

        if (halfData.length === 0) {
            if (idx >= chats.length - 4) {
                return {
                    currentTokens: currentTokens,
                    chats: chats,
                    error: `[HypaV2] Input tokens (${currentTokens}) exceeds max context size (${maxContextTokens}), but can't summarize last 4 messages. Please increase max context size to at least ${currentTokens}.`
                };
            }

            const chatTokens = await tokenizer.tokenizeChat(chats[idx], tokenizerContext);
            return {
                currentTokens: currentTokens,
                chats: chats,
                error: `[HypaV2] Message tokens (${chatTokens}) exceeds chunk size (${chunkSize}). Please increase chunk size to at least ${chatTokens}.`
            };
        }

        const stringlizedChat = halfData
            .map((e) => `${e.role}: ${e.content}`)
            .join("\n");

        const summaryData = await summary(stringlizedChat, database, userId, chatId);

        if (!summaryData.success) {
            console.log("Summarization failed:", summaryData.data);
            summarizationFailures++;
            if (summarizationFailures >= maxSummarizationFailures) {
                console.error("[HypaV2] Summarization failed multiple times. Aborting...");
                return {
                    currentTokens: currentTokens,
                    chats: chats,
                    error: "[HypaV2] Summarization failed multiple times. Aborting to prevent infinite loop.",
                };
            }
            continue;
        }

        summarizationFailures = 0;

        const summaryDataToken = await tokenizer.tokenizeChat({
            role: "system",
            content: summaryData.data,
        }, tokenizerContext);

        console.log(
            "[HypaV2] Summarization success:",
            "\nSummary Data:", summaryData.data,
            "\nSummary Token Count:", summaryDataToken
        );

        data.lastMainChunkID++;
        const newMainChunkId = data.lastMainChunkID;

        const chatMemos = new Set(halfData.map((chat) => chat.memo));
        const lastChatMemo = halfData[halfData.length - 1].memo;

        data.mainChunks.push({
            id: newMainChunkId,
            text: summaryData.data,
            chatMemos: chatMemos,
            lastChatMemo: lastChatMemo,
        });

        const splitted = summaryData.data
            .split("\n\n")
            .map((e) => e.trim())
            .filter((e) => e.length > 0);

        data.chunks.push(
            ...splitted.map((e) => ({
                mainChunkID: newMainChunkId,
                text: e,
            }))
        );

        console.log(
            "[HypaV2] Chunks added:",
            splitted,
            "\nUpdated mainChunks count:", data.mainChunks.length,
            "\nUpdated chunks count:", data.chunks.length
        );

        currentTokens -= halfDataTokens;
        console.log("[HypaV2] tokens after summarization deduction:", currentTokens);
    }

    mainPrompt = "";
    let mainPromptTokens = 0;
    for (const chunk of data.mainChunks) {
        const chunkTokens = await tokenizer.tokenizeChat({
            role: "system",
            content: chunk.text,
        }, tokenizerContext);
        if (mainPromptTokens + chunkTokens > allocatedTokens / 2) break;
        mainPrompt += `\n\n${chunk.text}`;
        mainPromptTokens += chunkTokens;
    }

    const processor = new HypaProcessor(database.hypaModel, undefined, userId, chatId, database);

    const searchDocumentPrefix = "search_document: ";
    const prefixLength = searchDocumentPrefix.length;

    await processor.addText(
        data.chunks
            .filter((v) => v.text.trim().length > 0)
            .map((v) => searchDocumentPrefix + v.text.trim())
    );

    let scoredResults: { [key: string]: number } = {};
    for (let i = 0; i < 3; i++) {
        const pop = chats[chats.length - i - 1];
        if (!pop) break;
        const searched = await processor.similaritySearchScored(
            `search_query: ${pop.content}`
        );
        for (const result of searched) {
            const score = result[1] / (i + 1);
            scoredResults[result[0]] = (scoredResults[result[0]] || 0) + score;
        }
    }

    const scoredArray = Object.entries(scoredResults).sort(
        (a, b) => b[1] - a[1]
    );
    let chunkResultPrompts = "";
    let chunkResultTokens = 0;
    while (
        allocatedTokens - mainPromptTokens - chunkResultTokens > 0 &&
        scoredArray.length > 0
        ) {
        const [text] = scoredArray.shift()!;
        const content = text.substring(prefixLength);
        const tokenized = await tokenizer.tokenizeChat({
            role: "system",
            content: content,
        }, tokenizerContext);
        if (
            tokenized >
            allocatedTokens - mainPromptTokens - chunkResultTokens
        )
            break;
        chunkResultPrompts += content + "\n\n";
        chunkResultTokens += tokenized;
    }

    const fullResult = `<Past Events Summary>${mainPrompt}</Past Events Summary>\n<Past Events Details>${chunkResultPrompts}</Past Events Details>`;
    const fullResultTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: fullResult,
    }, tokenizerContext);
    currentTokens += fullResultTokens;

    const unsummarizedChats: OpenAIChat[] = [
        {
            role: "system",
            content: fullResult,
            memo: "supaMemory",
        },
        ...chats.slice(idx)
    ];

    for (const chat of lastTwoChats) {
        if (!unsummarizedChats.find((c) => c.memo === chat.memo)) {
            unsummarizedChats.push(chat);
        }
    }

    currentTokens -= allocatedTokens;

    console.log(
        "[HypaV2] Model being used: ",
        database.hypaModel,
        database.supaModelType,
        "\nCurrent session tokens: ",
        currentTokens,
        "\nAll chats, including memory system prompt: ",
        unsummarizedChats,
        "\nMemory data, with all the chunks: ",
        data
    );

    return {
        currentTokens: currentTokens,
        chats: unsummarizedChats,
        memory: toSerializableHypaV2Data(data),
    };
}
