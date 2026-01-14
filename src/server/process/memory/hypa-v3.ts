/**
 * HypaMemory V3 서버 사이드 구현
 * 원본: src/ts/process/memory/hypav3.ts
 * 
 * 파일이 매우 크므로 핵심 로직만 먼저 구현하고, 나머지는 단계적으로 추가합니다.
 */

import type { Database, Chat, character, groupChat } from '../../database';
import type { OpenAIChat } from '../types';
import type { ChatTokenizer, TokenizerContext } from '../../tokenizer';
import type { HypaV3Result, HypaV3Data, HypaV3Settings, HypaV3Summary } from './types';
import { getCurrentHypaV3Preset } from './hypa-v3-preset';
import { summarize } from './hypa-v3-summarize';
import {
    toHypaV3Data,
    toSerializableHypaV3Data,
    cleanOrphanedSummary,
    wrapWithXml,
} from './hypa-v3-helpers';
import { TaskRateLimiter } from './task-rate-limiter';
import { HypaProcessor } from './hypa-processor';
import { HypaProcessorEx } from './hypa-processor-ex';
import { similarity } from './base';
import type { SummaryChunk } from './hypa-v3-helpers';
import {
    simpleCC,
    simpleRRF,
    childToParentRRF,
} from './hypa-v3-helpers';

const logPrefix = "[HypaV3]";
const memoryPromptTag = "Past Events Summary";
const minChatsForSimilarity = 3;
const summarySeparator = "\n\n";

/**
 * HypaMemory V3 메인 함수
 */
export async function hypaMemoryV3(
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
): Promise<HypaV3Result> {
    const preset = getCurrentHypaV3Preset(database);
    const settings = preset.settings;

    try {
        if (settings.useExperimentalImpl) {
            console.log(logPrefix, "Using experimental implementation.");

            return await hypaMemoryV3MainExp(
                chats,
                currentTokens,
                maxContextTokens,
                room,
                char,
                tokenizer,
                tokenizerContext,
                database,
                userId,
                chatId,
                settings
            );
        }

        return await hypaMemoryV3Main(
            chats,
            currentTokens,
            maxContextTokens,
            room,
            char,
            tokenizer,
            tokenizerContext,
            database,
            userId,
            chatId,
            settings
        );
    } catch (error) {
        if (error instanceof Error) {
            error.message = `${logPrefix} ${error.message}`;
            throw error;
        }

        let errorMessage: string;
        try {
            errorMessage = JSON.stringify(error);
        } catch {
            errorMessage = String(error);
        }

        throw new Error(`${logPrefix} ${errorMessage}`);
    }
    // Note: unloadEngine은 서버 사이드에서 필요 없음 (webllm 전용)
}

/**
 * HypaMemory V3 Main (Experimental) 구현
 * 배치 summarization과 EmbeddingText 기반 similarity search 사용
 */
async function hypaMemoryV3MainExp(
    chats: OpenAIChat[],
    currentTokens: number,
    maxContextTokens: number,
    room: Chat,
    char: character | groupChat,
    tokenizer: ChatTokenizer,
    tokenizerContext: TokenizerContext,
    database: Database,
    userId: string,
    chatId: string,
    settings: HypaV3Settings
): Promise<HypaV3Result> {
    // Validate settings
    if (settings.recentMemoryRatio + settings.similarMemoryRatio > 1) {
        return {
            currentTokens,
            chats,
            error: `${logPrefix} The sum of Recent Memory Ratio and Similar Memory Ratio is greater than 1.`,
        };
    }

    // Initial token correction
    currentTokens -= database.maxResponse;

    // Load existing hypa data if available
    const data: HypaV3Data = room.hypaV3Data
        ? toHypaV3Data(room.hypaV3Data)
        : {
            summaries: [],
        };

    // Clean orphaned summaries
    if (!settings.preserveOrphanedMemory) {
        cleanOrphanedSummary(chats, data);
    }

    // Determine starting index
    let startIdx = 0;

    if (data.summaries.length > 0) {
        const lastSummary = data.summaries.at(-1);
        const lastChatIndex = chats.findIndex(
            (chat) => chat.memo === [...lastSummary.chatMemos].at(-1)
        );

        if (lastChatIndex !== -1) {
            startIdx = lastChatIndex + 1;

            // Exclude tokens from summarized chats
            const summarizedChats = chats.slice(0, lastChatIndex + 1);
            for (const chat of summarizedChats) {
                currentTokens -= await tokenizer.tokenizeChat(chat, tokenizerContext);
            }
        }
    }

    console.log(logPrefix, "Starting index:", startIdx);

    // Reserve memory tokens
    const emptyMemoryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: wrapWithXml(memoryPromptTag, ""),
    }, tokenizerContext);
    const memoryTokens = Math.floor(
        maxContextTokens * settings.memoryTokensRatio
    );
    const shouldReserveMemoryTokens =
        data.summaries.length > 0 || currentTokens > maxContextTokens;
    let availableMemoryTokens = shouldReserveMemoryTokens
        ? memoryTokens - emptyMemoryTokens
        : 0;

    if (shouldReserveMemoryTokens) {
        currentTokens += memoryTokens;
        console.log(logPrefix, "Reserved memory tokens:", memoryTokens);
    }

    // If summarization is needed
    const summarizationMode = currentTokens > maxContextTokens;
    const targetTokens =
        maxContextTokens * (1 - settings.extraSummarizationRatio);
    const toSummarizeArray: OpenAIChat[][] = [];

    while (summarizationMode) {
        if (currentTokens <= targetTokens) {
            break;
        }

        if (chats.length - startIdx <= minChatsForSimilarity) {
            if (currentTokens <= maxContextTokens) {
                break;
            } else {
                return {
                    currentTokens,
                    chats,
                    error: `${logPrefix} Cannot summarize further: input token count (${currentTokens}) exceeds max context size (${maxContextTokens}), but minimum ${minChatsForSimilarity} messages required.`,
                    memory: toSerializableHypaV3Data(data),
                };
            }
        }

        const toSummarize: OpenAIChat[] = [];
        let toSummarizeTokens = 0;
        let currentIndex = startIdx;

        console.log(
            logPrefix,
            "Evaluating summarization batch:",
            "\nCurrent Tokens:",
            currentTokens,
            "\nMax Context Tokens:",
            maxContextTokens,
            "\nStart Index:",
            startIdx,
            "\nMax Chats Per Summary:",
            settings.maxChatsPerSummary
        );

        while (
            toSummarize.length < settings.maxChatsPerSummary &&
            currentIndex < chats.length - minChatsForSimilarity
        ) {
            const chat = chats[currentIndex];
            const chatTokens = await tokenizer.tokenizeChat(chat, tokenizerContext);

            console.log(
                logPrefix,
                "Evaluating chat:",
                "\nIndex:",
                currentIndex,
                "\nRole:",
                chat.role,
                "\nContent:",
                "\n" + chat.content,
                "\nTokens:",
                chatTokens
            );

            toSummarizeTokens += chatTokens;

            let shouldSummarize = true;

            if (
                chat.name === "example_user" ||
                chat.name === "example_assistant" ||
                chat.memo === "NewChatExample"
            ) {
                console.log(
                    logPrefix,
                    `Skipping example chat at index ${currentIndex}`
                );
                shouldSummarize = false;
            }

            if (chat.memo === "NewChat") {
                console.log(logPrefix, `Skipping new chat at index ${currentIndex}`);
                shouldSummarize = false;
            }

            if (chat.content.trim().length === 0) {
                console.log(logPrefix, `Skipping empty chat at index ${currentIndex}`);
                shouldSummarize = false;
            }

            if (settings.doNotSummarizeUserMessage && chat.role === "user") {
                console.log(logPrefix, `Skipping user role at index ${currentIndex}`);
                shouldSummarize = false;
            }

            if (shouldSummarize) {
                toSummarize.push(chat);
            }

            currentIndex++;
        }

        // Stop summarization if further reduction would go below target tokens (unless we're over max tokens)
        if (
            currentTokens <= maxContextTokens &&
            currentTokens - toSummarizeTokens < targetTokens
        ) {
            console.log(
                logPrefix,
                "Stopping summarization:",
                `\ncurrentTokens(${currentTokens}) - toSummarizeTokens(${toSummarizeTokens}) < targetTokens(${targetTokens})`
            );
            break;
        }

        // Collect summarization batch
        if (toSummarize.length > 0) {
            console.log(
                logPrefix,
                "Collecting summarization batch:",
                "\nTarget:",
                toSummarize
            );

            toSummarizeArray.push([...toSummarize]);
        }

        currentTokens -= toSummarizeTokens;
        startIdx = currentIndex;
    }

    // Process all collected summarization tasks
    if (toSummarizeArray.length > 0) {
        // Initialize rate limiter
        // Local model must be processed sequentially
        const rateLimiter = new TaskRateLimiter({
            tasksPerMinute:
                settings.summarizationModel === "subModel"
                    ? settings.summarizationRequestsPerMinute
                    : 1000,
            maxConcurrentTasks:
                settings.summarizationModel === "subModel"
                    ? settings.summarizationMaxConcurrent
                    : 1,
        });

        // Progress callback (서버에서는 로깅으로 대체)
        rateLimiter.taskQueueChangeCallback = (queuedCount) => {
            console.log(
                logPrefix,
                `Summarizing... ${rateLimiter.queuedTaskCount} queued`
            );
        };

        const summarizationTasks = toSummarizeArray.map(
            (item) => () => summarize(item, settings, database, userId, chatId, false)
        );

        // Start of performance measurement: summarize
        console.log(
            logPrefix,
            `Starting ${toSummarizeArray.length} summarization.`
        );
        const summarizeStartTime = Date.now();

        const batchResult = await rateLimiter.executeBatch<string>(
            summarizationTasks
        );

        const summarizeEndTime = Date.now();
        console.debug(
            `${logPrefix} summarization completed in ${
                summarizeEndTime - summarizeStartTime
            }ms`
        );
        // End of performance measurement: summarize

        // Note:
        // We can't save some successful summaries to the DB temporarily
        // because don't know the actual summarization model name.
        // It is possible that the user can change the summarization model.
        for (let i = 0; i < batchResult.results.length; i++) {
            const result = batchResult.results[i];

            // Push consecutive successes
            if (!result.success || !result.data) {
                const errorMessage = !result.success
                    ? result.error
                    : "Empty summary returned";

                console.log(logPrefix, "Summarization failed:", `\n${errorMessage}`);

                return {
                    currentTokens,
                    chats,
                    error: `${logPrefix} Summarization failed: ${errorMessage}`,
                    memory: toSerializableHypaV3Data(data),
                };
            }

            const summaryText = result.data;

            data.summaries.push({
                text: summaryText,
                chatMemos: new Set(toSummarizeArray[i].map((chat) => chat.memo)),
                isImportant: false,
                categoryId: undefined,
                tags: [],
            });
        }
    }

    console.log(
        logPrefix,
        `${summarizationMode ? "Completed" : "Skipped"} summarization phase:`,
        "\nCurrent Tokens:",
        currentTokens,
        "\nMax Context Tokens:",
        maxContextTokens,
        "\nAvailable Memory Tokens:",
        availableMemoryTokens
    );

    // Early return if no summaries
    if (data.summaries.length === 0) {
        const newChats: OpenAIChat[] = chats.slice(startIdx);

        console.log(
            logPrefix,
            "Exiting function:",
            "\nCurrent Tokens:",
            currentTokens,
            "\nAll chats, including memory prompt:",
            newChats,
            "\nMemory Data:",
            data
        );

        return {
            currentTokens,
            chats: newChats,
            memory: toSerializableHypaV3Data(data),
        };
    }

    const selectedSummaries: HypaV3Summary[] = [];
    const randomMemoryRatio =
        1 - settings.recentMemoryRatio - settings.similarMemoryRatio;
    const selectedImportantSummaries: HypaV3Summary[] = [];

    // Select important summaries
    {
        for (const summary of data.summaries) {
            if (summary.isImportant) {
                const summaryTokens = await tokenizer.tokenizeChat({
                    role: "system",
                    content: summary.text + summarySeparator,
                }, tokenizerContext);

                if (summaryTokens > availableMemoryTokens) {
                    break;
                }

                selectedImportantSummaries.push(summary);

                availableMemoryTokens -= summaryTokens;
            }
        }

        selectedSummaries.push(...selectedImportantSummaries);

        console.log(
            logPrefix,
            "After important memory selection:",
            "\nSummary Count:",
            selectedImportantSummaries.length,
            "\nSummaries:",
            selectedImportantSummaries,
            "\nAvailable Memory Tokens:",
            availableMemoryTokens
        );
    }

    // Select recent summaries
    const reservedRecentMemoryTokens = Math.floor(
        availableMemoryTokens * settings.recentMemoryRatio
    );
    let consumedRecentMemoryTokens = 0;
    const selectedRecentSummaries: HypaV3Summary[] = [];

    if (settings.recentMemoryRatio > 0) {
        // Target only summaries that haven't been selected yet
        const unusedSummaries = data.summaries.filter(
            (e) => !selectedSummaries.includes(e)
        );

        // Add one by one from the end
        for (let i = unusedSummaries.length - 1; i >= 0; i--) {
            const summary = unusedSummaries[i];
            const summaryTokens = await tokenizer.tokenizeChat({
                role: "system",
                content: summary.text + summarySeparator,
            }, tokenizerContext);

            if (
                summaryTokens + consumedRecentMemoryTokens >
                reservedRecentMemoryTokens
            ) {
                break;
            }

            selectedRecentSummaries.push(summary);
            consumedRecentMemoryTokens += summaryTokens;
        }

        selectedSummaries.push(...selectedRecentSummaries);

        console.log(
            logPrefix,
            "After recent memory selection:",
            "\nSummary Count:",
            selectedRecentSummaries.length,
            "\nSummaries:",
            selectedRecentSummaries,
            "\nReserved Tokens:",
            reservedRecentMemoryTokens,
            "\nConsumed Tokens:",
            consumedRecentMemoryTokens
        );
    }

    // Select similar summaries
    let reservedSimilarMemoryTokens = Math.floor(
        availableMemoryTokens * settings.similarMemoryRatio
    );
    let consumedSimilarMemoryTokens = 0;
    const selectedSimilarSummaries: HypaV3Summary[] = [];

    if (settings.similarMemoryRatio > 0) {
        // Utilize unused token space from recent selection
        if (randomMemoryRatio <= 0) {
            const unusedRecentTokens =
                reservedRecentMemoryTokens - consumedRecentMemoryTokens;

            reservedSimilarMemoryTokens += unusedRecentTokens;
            console.log(
                logPrefix,
                "Additional available token space for similar memory:",
                "\nFrom recent:",
                unusedRecentTokens
            );
        }

        // Target only summaries that haven't been selected yet
        const unusedSummaries = data.summaries.filter(
            (e) => !selectedSummaries.includes(e)
        );

        // Dynamically generate summary chunks (SummaryChunk 사용)
        const summaryChunks: SummaryChunk[] = [];

        unusedSummaries.forEach((summary) => {
            const splitted = summary.text
                .split("\n\n")
                .filter((e) => e.trim().length > 0);

            summaryChunks.push(
                ...splitted.map((e) => ({
                    text: e.trim(),
                    summary,
                }))
            );
        });

        // Initialize embedding processor (HypaProcessorEx 사용)
        const processor = new HypaProcessorEx(
            database.hypaModel,
            undefined,
            userId,
            chatId,
            database
        );
        processor.oaikey = database.supaMemoryKey;

        // Progress callback (서버에서는 로깅으로 대체)
        // processor.progressCallback은 HypaProcessorEx에 없으므로 로깅으로 대체

        try {
            // Start of performance measurement: addTexts
            console.log(
                `${logPrefix} Starting addTexts with ${summaryChunks.length} chunks`
            );
            const addStartTime = Date.now();

            // Add SummaryChunks to processor for similarity search
            await processor.addSummaryChunks(summaryChunks, database);

            const addEndTime = Date.now();
            console.debug(
                `${logPrefix} addTexts completed in ${addEndTime - addStartTime}ms`
            );
            // End of performance measurement: addTexts
        } catch (error) {
            return {
                currentTokens,
                chats,
                error: `${logPrefix} Similarity search failed: ${error}`,
                memory: toSerializableHypaV3Data(data),
            };
        }

        const recentChats = chats
            .slice(-minChatsForSimilarity)
            .filter((chat) => chat.content.trim().length > 0);

        const queries = recentChats
            .map((chat, index) => {
                const subQueries = chat.content
                    .split("\n\n")
                    .filter((e) => e.trim().length > 0);
                const weight =
                    (index + 1) /
                    ((recentChats.length * (recentChats.length + 1)) / 2) /
                    subQueries.length;

                return subQueries.map((content) => ({
                    content,
                    weight,
                }));
            })
            .flat();

        if (queries.length > 0) {
            try {
                // Start of performance measurement: similarity search
                console.log(
                    `${logPrefix} Starting similarity search with ${recentChats.length} queries`
                );
                const searchStartTime = Date.now();

                // Batch similarity search using SummaryChunk
                const batchScoredResults: [SummaryChunk, number][][] = [];

                for (let i = 0; i < queries.length; i++) {
                    const query = queries[i];
                    const scoredChunks = await processor.similaritySearchScoredEx(
                        query.content,
                        database
                    );

                    // Apply weight to scores
                    const weightedChunks = scoredChunks.map(([chunk, score]) => [
                        chunk,
                        score * query.weight,
                    ]) as [SummaryChunk, number][];

                    batchScoredResults.push(weightedChunks);
                }

                const searchEndTime = Date.now();
                console.debug(
                    `${logPrefix} Similarity search completed in ${
                        searchEndTime - searchStartTime
                    }ms`
                );
                // End of performance measurement: similarity search

                const rankedChunks = simpleCC<SummaryChunk>(
                    batchScoredResults,
                    (listIndex) => queries[listIndex].weight
                );

                const rankedSummaries = childToParentRRF<SummaryChunk, HypaV3Summary>(
                    rankedChunks,
                    (chunk) => chunk.summary
                );

                while (rankedSummaries.length > 0) {
                    const summary = rankedSummaries.shift()!;
                    const summaryTokens = await tokenizer.tokenizeChat({
                        role: "system",
                        content: summary.text + summarySeparator,
                    }, tokenizerContext);

                    if (
                        summaryTokens + consumedSimilarMemoryTokens >
                        reservedSimilarMemoryTokens
                    ) {
                        console.log(
                            logPrefix,
                            "Stopping similar memory selection:",
                            `\nconsumedSimilarMemoryTokens(${consumedSimilarMemoryTokens}) + summaryTokens(${summaryTokens}) > reservedSimilarMemoryTokens(${reservedSimilarMemoryTokens})`
                        );
                        break;
                    }

                    selectedSimilarSummaries.push(summary);
                    consumedSimilarMemoryTokens += summaryTokens;
                }

                selectedSummaries.push(...selectedSimilarSummaries);
            } catch (error) {
                return {
                    currentTokens,
                    chats,
                    error: `${logPrefix} Similarity search failed: ${error}`,
                    memory: toSerializableHypaV3Data(data),
                };
            }
        }

        console.log(
            logPrefix,
            "After similar memory selection:",
            "\nSummary Count:",
            selectedSimilarSummaries.length,
            "\nSummaries:",
            selectedSimilarSummaries,
            "\nReserved Tokens:",
            reservedSimilarMemoryTokens,
            "\nConsumed Tokens:",
            consumedSimilarMemoryTokens
        );
    }

    // Select random summaries
    let reservedRandomMemoryTokens = Math.floor(
        availableMemoryTokens * randomMemoryRatio
    );
    let consumedRandomMemoryTokens = 0;
    const selectedRandomSummaries: HypaV3Summary[] = [];

    if (randomMemoryRatio > 0) {
        // Utilize unused token space from recent and similar selection
        const unusedRecentTokens =
            reservedRecentMemoryTokens - consumedRecentMemoryTokens;
        const unusedSimilarTokens =
            reservedSimilarMemoryTokens - consumedSimilarMemoryTokens;

        reservedRandomMemoryTokens += unusedRecentTokens + unusedSimilarTokens;
        console.log(
            logPrefix,
            "Additional available token space for random memory:",
            "\nFrom recent:",
            unusedRecentTokens,
            "\nFrom similar:",
            unusedSimilarTokens,
            "\nTotal added:",
            unusedRecentTokens + unusedSimilarTokens
        );

        // Target only summaries that haven't been selected yet
        const unusedSummaries = data.summaries
            .filter((e) => !selectedSummaries.includes(e))
            .sort(() => Math.random() - 0.5); // Random shuffle

        for (const summary of unusedSummaries) {
            const summaryTokens = await tokenizer.tokenizeChat({
                role: "system",
                content: summary.text + summarySeparator,
            }, tokenizerContext);

            if (
                summaryTokens + consumedRandomMemoryTokens >
                reservedRandomMemoryTokens
            ) {
                // Trying to select more random memory
                continue;
            }

            selectedRandomSummaries.push(summary);
            consumedRandomMemoryTokens += summaryTokens;
        }

        selectedSummaries.push(...selectedRandomSummaries);

        console.log(
            logPrefix,
            "After random memory selection:",
            "\nSummary Count:",
            selectedRandomSummaries.length,
            "\nSummaries:",
            selectedRandomSummaries,
            "\nReserved Tokens:",
            reservedRandomMemoryTokens,
            "\nConsumed Tokens:",
            consumedRandomMemoryTokens
        );
    }

    // Sort selected summaries chronologically (by index)
    selectedSummaries.sort(
        (a, b) => data.summaries.indexOf(a) - data.summaries.indexOf(b)
    );

    // Generate final memory prompt
    const memory = wrapWithXml(
        memoryPromptTag,
        selectedSummaries.map((e) => e.text).join(summarySeparator)
    );
    const realMemoryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: memory,
    }, tokenizerContext);

    // Release reserved memory tokens
    if (shouldReserveMemoryTokens) {
        currentTokens -= memoryTokens;
    }

    currentTokens += realMemoryTokens;

    console.log(
        logPrefix,
        "Final memory selection:",
        "\nSummary Count:",
        selectedSummaries.length,
        "\nSummaries:",
        selectedSummaries,
        "\nReal Memory Tokens:",
        realMemoryTokens,
        "\nAvailable Memory Tokens:",
        availableMemoryTokens
    );

    if (currentTokens > maxContextTokens) {
        throw new Error(
            `Unexpected error: input token count (${currentTokens}) exceeds max context size (${maxContextTokens})`
        );
    }

    // Save last selected summaries
    data.metrics = {
        lastImportantSummaries: selectedImportantSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
        lastRecentSummaries: selectedRecentSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
        lastSimilarSummaries: selectedSimilarSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
        lastRandomSummaries: selectedRandomSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
    };

    const newChats: OpenAIChat[] = [
        {
            role: "system",
            content: memory,
            memo: "supaMemory",
        },
        ...chats.slice(startIdx),
    ];

    console.log(
        logPrefix,
        "Exiting function:",
        "\nCurrent Tokens:",
        currentTokens,
        "\nAll chats, including memory prompt:",
        newChats,
        "\nMemory Data:",
        data
    );

    return {
        currentTokens,
        chats: newChats,
        memory: toSerializableHypaV3Data(data),
    };
}

/**
 * HypaMemory V3 Main 구현
 */
async function hypaMemoryV3Main(
    chats: OpenAIChat[],
    currentTokens: number,
    maxContextTokens: number,
    room: Chat,
    char: character | groupChat,
    tokenizer: ChatTokenizer,
    tokenizerContext: TokenizerContext,
    database: Database,
    userId: string,
    chatId: string,
    settings: HypaV3Settings
): Promise<HypaV3Result> {
    // Validate settings
    if (settings.recentMemoryRatio + settings.similarMemoryRatio > 1) {
        return {
            currentTokens,
            chats,
            error: `${logPrefix} The sum of Recent Memory Ratio and Similar Memory Ratio is greater than 1.`,
        };
    }

    // Initial token correction
    currentTokens -= database.maxResponse;

    // Load existing hypa data if available
    const data: HypaV3Data = room.hypaV3Data
        ? toHypaV3Data(room.hypaV3Data)
        : {
            summaries: [],
        };

    // Clean orphaned summaries
    if (!settings.preserveOrphanedMemory) {
        cleanOrphanedSummary(chats, data);
    }

    // Determine starting index
    let startIdx = 0;

    if (data.summaries.length > 0) {
        const lastSummary = data.summaries.at(-1);
        const lastChatIndex = chats.findIndex(
            (chat) => chat.memo === [...lastSummary.chatMemos].at(-1)
        );

        if (lastChatIndex !== -1) {
            startIdx = lastChatIndex + 1;

            // Exclude tokens from summarized chats
            const summarizedChats = chats.slice(0, lastChatIndex + 1);
            for (const chat of summarizedChats) {
                currentTokens -= await tokenizer.tokenizeChat(chat, tokenizerContext);
            }
        }
    }

    console.log(logPrefix, "Starting index:", startIdx);

    // Reserve memory tokens
    const emptyMemoryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: wrapWithXml(memoryPromptTag, ""),
    }, tokenizerContext);
    const memoryTokens = Math.floor(
        maxContextTokens * settings.memoryTokensRatio
    );
    const shouldReserveEmptyMemoryTokens =
        data.summaries.length === 0 &&
        currentTokens + emptyMemoryTokens <= maxContextTokens;
    let availableMemoryTokens = shouldReserveEmptyMemoryTokens
        ? 0
        : memoryTokens - emptyMemoryTokens;

    if (shouldReserveEmptyMemoryTokens) {
        currentTokens += emptyMemoryTokens;
        console.log(logPrefix, "Reserved empty memory tokens:", emptyMemoryTokens);
    } else {
        currentTokens += memoryTokens;
        console.log(logPrefix, "Reserved max memory tokens:", memoryTokens);
    }

    // If summarization is needed
    const summarizationMode = currentTokens > maxContextTokens;
    const targetTokens =
        maxContextTokens * (1 - settings.extraSummarizationRatio);

    while (summarizationMode) {
        if (currentTokens <= targetTokens) {
            break;
        }

        if (chats.length - startIdx <= minChatsForSimilarity) {
            if (currentTokens <= maxContextTokens) {
                break;
            } else {
                return {
                    currentTokens,
                    chats,
                    error: `${logPrefix} Cannot summarize further: input token count (${currentTokens}) exceeds max context size (${maxContextTokens}), but minimum ${minChatsForSimilarity} messages required.`,
                    memory: toSerializableHypaV3Data(data),
                };
            }
        }

        const toSummarize: OpenAIChat[] = [];
        const endIdx = Math.min(
            startIdx + settings.maxChatsPerSummary,
            chats.length - minChatsForSimilarity
        );
        let toSummarizeTokens = 0;

        console.log(
            logPrefix,
            "Evaluating summarization batch:",
            "\nCurrent Tokens:",
            currentTokens,
            "\nMax Context Tokens:",
            maxContextTokens,
            "\nStart Index:",
            startIdx,
            "\nEnd Index:",
            endIdx,
            "\nChat Count:",
            endIdx - startIdx,
            "\nMax Chats Per Summary:",
            settings.maxChatsPerSummary
        );

        for (let i = startIdx; i < endIdx; i++) {
            const chat = chats[i];
            const chatTokens = await tokenizer.tokenizeChat(chat, tokenizerContext);

            console.log(
                logPrefix,
                "Evaluating chat:",
                "\nIndex:",
                i,
                "\nRole:",
                chat.role,
                "\nContent:",
                "\n" + chat.content,
                "\nTokens:",
                chatTokens
            );

            toSummarizeTokens += chatTokens;

            if (
                chat.name === "example_user" ||
                chat.name === "example_assistant" ||
                chat.memo === "NewChatExample"
            ) {
                console.log(logPrefix, `Skipping example chat at index ${i}`);
                continue;
            }

            if (chat.memo === "NewChat") {
                console.log(logPrefix, `Skipping new chat at index ${i}`);
                continue;
            }

            if (chat.content.trim().length === 0) {
                console.log(logPrefix, `Skipping empty chat at index ${i}`);
                continue;
            }

            if (settings.doNotSummarizeUserMessage && chat.role === "user") {
                console.log(logPrefix, `Skipping user role at index ${i}`);
                continue;
            }

            toSummarize.push(chat);
        }

        // Stop summarization if further reduction would go below target tokens (unless we're over max tokens)
        if (
            currentTokens <= maxContextTokens &&
            currentTokens - toSummarizeTokens < targetTokens
        ) {
            console.log(
                logPrefix,
                "Stopping summarization:",
                `\ncurrentTokens(${currentTokens}) - toSummarizeTokens(${toSummarizeTokens}) < targetTokens(${targetTokens})`
            );
            break;
        }

        // Attempt summarization
        if (toSummarize.length > 0) {
            console.log(
                logPrefix,
                "Attempting summarization:",
                "\nTarget:",
                toSummarize
            );

            try {
                const summarizeResult = await summarize(
                    toSummarize,
                    settings,
                    database,
                    userId,
                    chatId,
                    false
                );

                data.summaries.push({
                    text: summarizeResult,
                    chatMemos: new Set(toSummarize.map((chat) => chat.memo)),
                    isImportant: false,
                    categoryId: undefined,
                    tags: [],
                });
            } catch (error) {
                console.log(logPrefix, "Summarization failed:", `\n${error}`);

                return {
                    currentTokens,
                    chats,
                    error: `${logPrefix} Summarization failed: ${error}`,
                    memory: toSerializableHypaV3Data(data),
                };
            }
        }

        currentTokens -= toSummarizeTokens;
        startIdx = endIdx;
    }

    console.log(
        logPrefix,
        `${summarizationMode ? "Completed" : "Skipped"} summarization phase:`,
        "\nCurrent Tokens:",
        currentTokens,
        "\nMax Context Tokens:",
        maxContextTokens,
        "\nAvailable Memory Tokens:",
        availableMemoryTokens
    );

    // Early return if no summaries
    if (data.summaries.length === 0) {
        // Generate final memory prompt
        const memory = wrapWithXml(memoryPromptTag, "");

        const newChats: OpenAIChat[] = [
            {
                role: "system",
                content: memory,
                memo: "supaMemory",
            },
            ...chats.slice(startIdx),
        ];

        console.log(
            logPrefix,
            "Exiting function:",
            "\nCurrent Tokens:",
            currentTokens,
            "\nAll chats, including memory prompt:",
            newChats,
            "\nMemory Data:",
            data
        );

        return {
            currentTokens,
            chats: newChats,
            memory: toSerializableHypaV3Data(data),
        };
    }

    const selectedSummaries: HypaV3Summary[] = [];
    const randomMemoryRatio =
        1 - settings.recentMemoryRatio - settings.similarMemoryRatio;
    const selectedImportantSummaries: HypaV3Summary[] = [];

    // Select important summaries
    {
        for (const summary of data.summaries) {
            if (summary.isImportant) {
                const summaryTokens = await tokenizer.tokenizeChat({
                    role: "system",
                    content: summary.text + summarySeparator,
                }, tokenizerContext);

                if (summaryTokens > availableMemoryTokens) {
                    break;
                }

                selectedImportantSummaries.push(summary);

                availableMemoryTokens -= summaryTokens;
            }
        }

        selectedSummaries.push(...selectedImportantSummaries);

        console.log(
            logPrefix,
            "After important memory selection:",
            "\nSummary Count:",
            selectedImportantSummaries.length,
            "\nSummaries:",
            selectedImportantSummaries,
            "\nAvailable Memory Tokens:",
            availableMemoryTokens
        );
    }

    // Select recent summaries
    const reservedRecentMemoryTokens = Math.floor(
        availableMemoryTokens * settings.recentMemoryRatio
    );
    let consumedRecentMemoryTokens = 0;
    const selectedRecentSummaries: HypaV3Summary[] = [];

    if (settings.recentMemoryRatio > 0) {
        // Target only summaries that haven't been selected yet
        const unusedSummaries = data.summaries.filter(
            (e) => !selectedSummaries.includes(e)
        );

        // Add one by one from the end
        for (let i = unusedSummaries.length - 1; i >= 0; i--) {
            const summary = unusedSummaries[i];
            const summaryTokens = await tokenizer.tokenizeChat({
                role: "system",
                content: summary.text + summarySeparator,
            }, tokenizerContext);

            if (
                summaryTokens + consumedRecentMemoryTokens >
                reservedRecentMemoryTokens
            ) {
                break;
            }

            selectedRecentSummaries.push(summary);
            consumedRecentMemoryTokens += summaryTokens;
        }

        selectedSummaries.push(...selectedRecentSummaries);

        console.log(
            logPrefix,
            "After recent memory selection:",
            "\nSummary Count:",
            selectedRecentSummaries.length,
            "\nSummaries:",
            selectedRecentSummaries,
            "\nReserved Tokens:",
            reservedRecentMemoryTokens,
            "\nConsumed Tokens:",
            consumedRecentMemoryTokens
        );
    }

    // Select similar summaries
    let reservedSimilarMemoryTokens = Math.floor(
        availableMemoryTokens * settings.similarMemoryRatio
    );
    let consumedSimilarMemoryTokens = 0;
    const selectedSimilarSummaries: HypaV3Summary[] = [];

    if (settings.similarMemoryRatio > 0) {
        // Utilize unused token space from recent selection
        if (randomMemoryRatio <= 0) {
            const unusedRecentTokens =
                reservedRecentMemoryTokens - consumedRecentMemoryTokens;

            reservedSimilarMemoryTokens += unusedRecentTokens;
            console.log(
                logPrefix,
                "Additional available token space for similar memory:",
                "\nFrom recent:",
                unusedRecentTokens
            );
        }

        // Target only summaries that haven't been selected yet
        const unusedSummaries = data.summaries.filter(
            (e) => !selectedSummaries.includes(e)
        );

        // Dynamically generate summary chunks
        const summaryChunks: SummaryChunk[] = [];

        unusedSummaries.forEach((summary) => {
            const splitted = summary.text
                .split("\n\n")
                .filter((e) => e.trim().length > 0);

            summaryChunks.push(
                ...splitted.map((e) => ({
                    text: e.trim(),
                    summary,
                }))
            );
        });

        // Initialize embedding processor
        const processor = new HypaProcessorEx(
            database.hypaModel,
            undefined,
            userId,
            chatId,
            database
        );
        processor.oaikey = database.supaMemoryKey;

        // Add summaryChunks to processor for similarity search
        try {
            await processor.addSummaryChunks(summaryChunks, database);
        } catch (error) {
            return {
                currentTokens,
                chats,
                error: `${logPrefix} Similarity search failed: ${error}`,
                memory: toSerializableHypaV3Data(data),
            };
        }

        const recentChats = chats
            .slice(-minChatsForSimilarity)
            .filter((chat) => chat.content.trim().length > 0);

        if (recentChats.length > 0) {
            // Raw recent chat search
            const queries = recentChats.map((chat) => chat.content);

            if (settings.enableSimilarityCorrection && recentChats.length > 1) {
                // Raw + Summarized recent chat search
                // Summarizing is meaningful when there are more than 2 recent chats

                // Attempt summarization
                console.log(
                    logPrefix,
                    "Attempting summarization for similarity search:",
                    "\nTarget:",
                    recentChats
                );

                try {
                    const summarizeResult = await summarize(
                        recentChats,
                        settings,
                        database,
                        userId,
                        chatId,
                        false
                    );

                    queries.push(summarizeResult);
                } catch (error) {
                    console.log(logPrefix, "Summarization failed:", `\n${error}`);

                    return {
                        currentTokens,
                        chats,
                        error: `${logPrefix} Summarization failed: ${error}`,
                        memory: toSerializableHypaV3Data(data),
                    };
                }
            }

            try {
                const scoredLists: [SummaryChunk, number][][] = [];

                for (let i = 0; i < queries.length; i++) {
                    const query = queries[i];
                    const scoredChunks = await processor.similaritySearchScoredEx(query, database);

                    scoredLists.push(scoredChunks);
                }

                const rankedChunks = simpleCC<SummaryChunk>(
                    scoredLists,
                    (listIndex, totalLists) => {
                        return (listIndex + 1) / ((totalLists * (totalLists + 1)) / 2);
                    }
                );

                const rankedSummaries = childToParentRRF<SummaryChunk, HypaV3Summary>(
                    rankedChunks,
                    (chunk) => chunk.summary
                );

                while (rankedSummaries.length > 0) {
                    const summary = rankedSummaries.shift()!;
                    const summaryTokens = await tokenizer.tokenizeChat({
                        role: "system",
                        content: summary.text + summarySeparator,
                    }, tokenizerContext);

                    if (
                        summaryTokens + consumedSimilarMemoryTokens >
                        reservedSimilarMemoryTokens
                    ) {
                        console.log(
                            logPrefix,
                            "Stopping similar memory selection:",
                            `\nconsumedSimilarMemoryTokens(${consumedSimilarMemoryTokens}) + summaryTokens(${summaryTokens}) > reservedSimilarMemoryTokens(${reservedSimilarMemoryTokens})`
                        );
                        break;
                    }

                    selectedSimilarSummaries.push(summary);
                    consumedSimilarMemoryTokens += summaryTokens;
                }

                selectedSummaries.push(...selectedSimilarSummaries);
            } catch (error) {
                return {
                    currentTokens,
                    chats,
                    error: `${logPrefix} Similarity search failed: ${error}`,
                    memory: toSerializableHypaV3Data(data),
                };
            }
        }

        console.log(
            logPrefix,
            "After similar memory selection:",
            "\nSummary Count:",
            selectedSimilarSummaries.length,
            "\nSummaries:",
            selectedSimilarSummaries,
            "\nReserved Tokens:",
            reservedSimilarMemoryTokens,
            "\nConsumed Tokens:",
            consumedSimilarMemoryTokens
        );
    }

    // Select random summaries
    let reservedRandomMemoryTokens = Math.floor(
        availableMemoryTokens * randomMemoryRatio
    );
    let consumedRandomMemoryTokens = 0;
    const selectedRandomSummaries: HypaV3Summary[] = [];

    if (randomMemoryRatio > 0) {
        // Utilize unused token space from recent and similar selection
        const unusedRecentTokens =
            reservedRecentMemoryTokens - consumedRecentMemoryTokens;
        const unusedSimilarTokens =
            reservedSimilarMemoryTokens - consumedSimilarMemoryTokens;

        reservedRandomMemoryTokens += unusedRecentTokens + unusedSimilarTokens;
        console.log(
            logPrefix,
            "Additional available token space for random memory:",
            "\nFrom recent:",
            unusedRecentTokens,
            "\nFrom similar:",
            unusedSimilarTokens,
            "\nTotal added:",
            unusedRecentTokens + unusedSimilarTokens
        );

        // Target only summaries that haven't been selected yet
        const unusedSummaries = data.summaries
            .filter((e) => !selectedSummaries.includes(e))
            .sort(() => Math.random() - 0.5); // Random shuffle

        for (const summary of unusedSummaries) {
            const summaryTokens = await tokenizer.tokenizeChat({
                role: "system",
                content: summary.text + summarySeparator,
            }, tokenizerContext);

            if (
                summaryTokens + consumedRandomMemoryTokens >
                reservedRandomMemoryTokens
            ) {
                // Trying to select more random memory
                continue;
            }

            selectedRandomSummaries.push(summary);
            consumedRandomMemoryTokens += summaryTokens;
        }

        selectedSummaries.push(...selectedRandomSummaries);

        console.log(
            logPrefix,
            "After random memory selection:",
            "\nSummary Count:",
            selectedRandomSummaries.length,
            "\nSummaries:",
            selectedRandomSummaries,
            "\nReserved Tokens:",
            reservedRandomMemoryTokens,
            "\nConsumed Tokens:",
            consumedRandomMemoryTokens
        );
    }

    // Sort selected summaries chronologically (by index)
    selectedSummaries.sort(
        (a, b) => data.summaries.indexOf(a) - data.summaries.indexOf(b)
    );

    // Generate final memory prompt
    const memory = wrapWithXml(
        memoryPromptTag,
        selectedSummaries.map((e) => e.text).join(summarySeparator)
    );
    const realMemoryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: memory,
    }, tokenizerContext);

    // Release reserved memory tokens
    if (shouldReserveEmptyMemoryTokens) {
        currentTokens -= emptyMemoryTokens;
    } else {
        currentTokens -= memoryTokens;
    }

    currentTokens += realMemoryTokens;

    console.log(
        logPrefix,
        "Final memory selection:",
        "\nSummary Count:",
        selectedSummaries.length,
        "\nSummaries:",
        selectedSummaries,
        "\nReal Memory Tokens:",
        realMemoryTokens,
        "\nAvailable Memory Tokens:",
        availableMemoryTokens
    );

    if (currentTokens > maxContextTokens) {
        throw new Error(
            `Unexpected error: input token count (${currentTokens}) exceeds max context size (${maxContextTokens})`
        );
    }

    // Save last selected summaries
    data.metrics = {
        lastImportantSummaries: selectedImportantSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
        lastRecentSummaries: selectedRecentSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
        lastSimilarSummaries: selectedSimilarSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
        lastRandomSummaries: selectedRandomSummaries.map((selected) =>
            data.summaries.findIndex((sum) => sum === selected)
        ),
    };

    const newChats: OpenAIChat[] = [
        {
            role: "system",
            content: memory,
            memo: "supaMemory",
        },
        ...chats.slice(startIdx),
    ];

    console.log(
        logPrefix,
        "Exiting function:",
        "\nCurrent Tokens:",
        currentTokens,
        "\nAll chats, including memory prompt:",
        newChats,
        "\nMemory Data:",
        data
    );

    return {
        currentTokens,
        chats: newChats,
        memory: toSerializableHypaV3Data(data),
    };
}
