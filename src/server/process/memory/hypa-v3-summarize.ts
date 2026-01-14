/**
 * HypaV3 Summarization 함수
 * 원본: src/ts/process/memory/hypav3.ts
 */

import type { OpenAIChat } from '../types';
import type { Database } from '../../database';
import type { HypaV3Settings } from './types';
import { parseChatML } from '../../parser';
import { requestChatData } from '../request';
// TODO: webllm 모듈을 서버 사이드로 마이그레이션 필요
// import { chatCompletion } from '../webllm';

const logPrefix = "[HypaV3]";

/**
 * 메시지들을 요약
 */
export async function summarize(
    oaiMessages: OpenAIChat[],
    settings: HypaV3Settings,
    database: Database,
    userId: string,
    chatId: string,
    isResummarize: boolean = false
): Promise<string> {
    const strMessages = oaiMessages
        .map((chat) => `${chat.role}: ${chat.content}`)
        .join("\n");

    const summarizationPrompt = isResummarize
        ? (settings.reSummarizationPrompt.trim() === "" ? "Re-summarize this summaries." : settings.reSummarizationPrompt)
        : settings.summarizationPrompt.trim() === ""
            ? "[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]"
            : settings.summarizationPrompt;

    const formated: OpenAIChat[] = parseChatML(
        summarizationPrompt.replaceAll("{{slot}}", strMessages),
        {
            parser: {
                getDatabase: () => database,
                getSelectedCharID: () => 0,
                findCharacterbyId: () => null,
            },
            matcher: {
                calcString: () => '',
                getMatcherMap: () => ({}),
                initMatcher: () => {},
            },
            block: {
                getChatVar: () => '',
                getGlobalChatVar: () => '',
            },
        }
    ) ?? [
        {
            role: "user",
            content: strMessages,
        },
        {
            role: "system",
            content: summarizationPrompt,
        },
    ];

    // API
    if (settings.summarizationModel === "subModel") {
        console.log(logPrefix, `Using ax model ${database.subModel} for summarization.`);

        const response = await requestChatData(
            {
                formated,
                bias: {},
                useStreaming: false,
                noMultiGen: true,
            },
            "memory",
            database,
            null,
            userId,
            chatId
        );

        if (response.type === "streaming" || response.type === "multiline") {
            throw new Error("Unexpected response type");
        }

        if (response.type === "fail") {
            throw new Error(response.result);
        }

        if (!response.result || response.result.trim().length === 0) {
            throw new Error("Empty summary returned");
        }

        // Remove thoughts content for API
        const thoughtsRegex = /<Thoughts>[\s\S]*?<\/Thoughts>/g;

        return response.result.replace(thoughtsRegex, "").trim();
    }

    // Local model - TODO: webllm 모듈을 서버 사이드로 마이그레이션 필요
    // const content = await chatCompletion(formated, settings.summarizationModel, {
    //     max_tokens: 8192,
    //     temperature: 0,
    //     extra_body: {
    //         enable_thinking: false,
    //     },
    // });

    // if (!content || content.trim().length === 0) {
    //     throw new Error("Empty summary returned");
    // }

    // // Remove think content
    // const thinkRegex = /<think>[\s\S]*?<\/think>/g;

    // return content.replace(thinkRegex, "").trim();

    // 임시로 subModel 사용
    throw new Error("Local model summarization not yet implemented on server side. Please use subModel.");
}
