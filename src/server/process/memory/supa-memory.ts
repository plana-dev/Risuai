/**
 * SupaMemory 구현
 * 원본: src/ts/process/memory/supaMemory.ts
 * 
 * TODO: 전체 구현 필요 - 현재는 기본 구조만 제공
 */

import type { OpenAIChat } from '../types';
import type { Chat, character, groupChat, Database } from '../../database';
import type { ChatTokenizer } from '../../tokenizer';
import type { SupaMemoryResult, SupaMemoryArg, HypaData } from './types';
import { tokenize } from '../../tokenizer';
import type { TokenizerContext } from '../../tokenizer';
import { HypaProcessor } from './hypa-processor';
import { stringlizeChat } from '../auxiliary/stringlize';
import { parseChatML } from '../../parser';
import { requestChatData } from '../request';
import { getUserName } from '../../util/database';
import { getUserName } from '../../util/database';

/**
 * SupaMemory 처리
 */
export async function supaMemory(
    chats: OpenAIChat[],
    currentTokens: number,
    maxContextTokens: number,
    room: Chat,
    char: character | groupChat,
    tokenizer: ChatTokenizer,
    database: Database,
    tokenizerContext: TokenizerContext,
    userId: string,
    arg: SupaMemoryArg = {}
): Promise<SupaMemoryResult> {
    currentTokens += 10;

    if (currentTokens > maxContextTokens) {
        let coIndex = -1;
        for (let i = 0; i < chats.length; i++) {
            if (chats[i].memo === 'NewChat') {
                coIndex = i;
                break;
            }
        }
        if (coIndex !== -1) {
            for (let i = 0; i < coIndex; i++) {
                currentTokens -= await tokenizer.tokenizeChat(chats[0]);
                chats.splice(0, 1);
            }
        }

        let supaMemory = '';
        let hypaChunks: string[] = [];
        let lastId = '';
        let HypaData: HypaData[] = [];

        if (room.supaMemoryData && room.supaMemoryData.length > 4) {
            const splited = room.supaMemoryData.split('\n');
            let id = splited.splice(0, 1)[0];
            const data = splited.join('\n');

            if (arg.asHyper && !id.startsWith('hypa:')) {
                supaMemory = '';
            } else {
                if (id.startsWith('hypa:')) {
                    if (!arg.asHyper) {
                        return {
                            currentTokens: currentTokens,
                            chats: chats,
                            error: 'SupaMemory: Data saved in hypaMemory, loaded as SupaMemory.',
                        };
                    }
                    HypaData = JSON.parse(data.trim());
                    if (!Array.isArray(HypaData)) {
                        return {
                            currentTokens: currentTokens,
                            chats: chats,
                            error: 'hypaMemory: hypaMemory isn\'t Array',
                        };
                    }

                    let indexSelected = -1;
                    for (let j = 0; j < HypaData.length; j++) {
                        let i = 0;
                        let countTokens = currentTokens;
                        let countChats = JSON.parse(JSON.stringify(chats)); // safeStructuredClone 대체
                        while (true) {
                            if (countChats.length === 0) {
                                break;
                            }
                            if (countChats[0].memo === HypaData[j].id) {
                                lastId = HypaData[j].id;
                                currentTokens = countTokens;
                                chats = countChats;
                                indexSelected = j;
                                break;
                            }
                            countTokens -= await tokenizer.tokenizeChat(countChats[0]);
                            countChats.splice(0, 1);
                            i += 1;
                        }
                        if (indexSelected !== -1) {
                            break;
                        }
                    }
                    if (indexSelected === -1) {
                        return {
                            currentTokens: currentTokens,
                            chats: chats,
                            error: 'hypaMemory: chat ID not found',
                        };
                    }

                    supaMemory = HypaData[indexSelected].supa;
                    hypaChunks = HypaData[indexSelected].hypa;
                } else {
                    let i = 0;
                    while (true) {
                        if (chats.length === 0) {
                            return {
                                currentTokens: currentTokens,
                                chats: chats,
                                error: 'SupaMemory: chat ID not found',
                            };
                        }
                        if (chats[0].memo === id) {
                            lastId = id;
                            break;
                        }
                        currentTokens -= await tokenizer.tokenizeChat(chats[0]);
                        chats.splice(0, 1);
                        i += 1;
                    }

                    supaMemory = data;
                    if (database.removePunctuationHypa) {
                        supaMemory = supaMemory.replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                    }
                    currentTokens += await tokenize(supaMemory, tokenizerContext);
                }
            }
        }

        let hypaResult = '';

        if (arg.asHyper) {
            const hypa = new HypaProcessor(database.hypaModel, database.hypaCustomSettings?.url, userId, room.chatId, database);
            hypa.oaikey = database.supaMemoryKey;
            hypa.vectors = [];
            hypaChunks = hypaChunks.filter(value => value.length > 1);
            if (hypaChunks.length > 0) {
                await hypa.addText(
                    hypaChunks
                        .filter((value, index, self) => {
                            return self.indexOf(value) === index;
                        })
                        .map(value => {
                            if (database.removePunctuationHypa) {
                                value = value.replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                            }
                            return value;
                        })
                        .filter(v => {
                            return !supaMemory.replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').includes(v.replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, ''));
                        }),
                    database
                );
                const filteredChat = chats.filter(r => r.role !== 'system' && r.role !== 'function');
                const s = await hypa.similaritySearch(stringlizeChat(filteredChat.slice(0, 4), char?.name ?? '', false));
                hypaResult = '';
                if (s.length > 0) {
                    hypaResult = 'past events: ' + s.slice(0, 3);
                    currentTokens += await tokenizer.tokenizeChat({
                        role: 'assistant',
                        content: hypaResult,
                        memo: 'hypaMemory',
                    });
                    currentTokens += 10;
                }
            }
        }

        if (currentTokens < maxContextTokens) {
            chats.unshift({
                role: 'system',
                content: supaMemory + '\n\n' + hypaResult,
                memo: 'supaMemory',
            });
            return {
                currentTokens: currentTokens,
                chats: chats,
            };
        }

        // 요약 함수
        async function summarize(stringlizedChat: string): Promise<string | SupaMemoryResult> {
            if (database.supaModelType === 'distilbart') {
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
                        return summaryResponse.result;
                    } else {
                        throw new Error(summaryResponse.result);
                    }
                } catch (error) {
                    return {
                        currentTokens: currentTokens,
                        chats: chats,
                        error: 'SupaMemory: Summarizer: ' + `${error}`,
                    };
                }
            }

            const supaPrompt =
                database.supaMemoryPrompt === ''
                    ? '[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output to reduce tokens for gpt3 and other sublanguage models]\n'
                    : database.supaMemoryPrompt;

            let result = '';

            if (database.supaModelType !== 'subModel') {
                const promptbody = stringlizedChat + '\n\n' + supaPrompt + '\n\nOutput:';

                const da = await fetch('https://api.openai.com/v1/completions', {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + database.supaMemoryKey,
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        model:
                            database.supaModelType === 'curie'
                                ? 'text-curie-001'
                                : database.supaModelType === 'instruct35'
                                  ? 'gpt-3.5-turbo-instruct'
                                  : 'text-davinci-003',
                        prompt: promptbody,
                        max_tokens: 600,
                        temperature: 0,
                    }),
                });

                try {
                    if (!da.ok) {
                        const errorData = await da.json();
                        return {
                            currentTokens: currentTokens,
                            chats: chats,
                            error: 'SupaMemory: HTTP: ' + JSON.stringify(errorData),
                        };
                    }

                    const data = await da.json();
                    result = data?.choices[0]?.text?.trim();

                    if (!result) {
                        return {
                            currentTokens: currentTokens,
                            chats: chats,
                            error: 'SupaMemory: HTTP: ' + JSON.stringify(errorData),
                        };
                    }

                    return result;
                } catch (error) {
                    return {
                        currentTokens: currentTokens,
                        chats: chats,
                        error: 'SupaMemory: HTTP: ' + error,
                    };
                }
            } else {
                let parsedPrompt = parseChatML(supaPrompt.replaceAll('{{slot}}', stringlizedChat));
                const promptbody: OpenAIChat[] =
                    parsedPrompt ?? [
                        {
                            role: 'user',
                            content: stringlizedChat,
                        },
                        {
                            role: 'system',
                            content: supaPrompt,
                        },
                    ];
                const da = await requestChatData(
                    {
                        formated: promptbody,
                        bias: {},
                        useStreaming: false,
                        noMultiGen: true,
                    },
                    'memory',
                    database,
                    null,
                    userId
                );
                if (da.type === 'fail' || da.type === 'streaming' || da.type === 'multiline') {
                    return {
                        currentTokens: currentTokens,
                        chats: chats,
                        error: 'SupaMemory: HTTP: ' + da.result,
                    };
                }
                result = da.result;
            }
            return result;
        }

        // 요약 루프
        while (currentTokens > maxContextTokens) {
            const beforeToken = currentTokens;
            let maxChunkSize = Math.floor(maxContextTokens / 3);
            if (database.maxSupaChunkSize < maxChunkSize) {
                maxChunkSize = database.maxSupaChunkSize;
            }
            let summarized = false;
            let chunkSize = 0;
            let stringlizedChat = '';
            let spiceLen = 0;
            while (true) {
                const cont = chats[spiceLen];
                if (!cont) {
                    currentTokens = beforeToken;
                    stringlizedChat = '';
                    chunkSize = 0;
                    spiceLen = 0;
                    if (summarized) {
                        if (maxChunkSize < 500) {
                            return {
                                currentTokens: currentTokens,
                                chats: chats,
                                error: 'Not Enough Tokens to summarize in SupaMemory',
                            };
                        }
                        maxChunkSize = maxChunkSize * 0.7;
                    } else {
                        const result = await summarize(supaMemory);
                        if (typeof result !== 'string') {
                            return result;
                        }

                        currentTokens -= await tokenize(supaMemory, tokenizerContext);
                        currentTokens += await tokenize(result + '\n\n', tokenizerContext);

                        supaMemory = result + '\n\n';
                        summarized = true;
                        if (currentTokens <= maxContextTokens) {
                            break;
                        }
                    }
                    continue;
                }
                const tokens = await tokenizer.tokenizeChat(cont);
                if (chunkSize + tokens > maxChunkSize) {
                    if (stringlizedChat === '') {
                        if (cont.role !== 'function' && cont.role !== 'system') {
                            const userName = await getUserName(userId, room.id, database);
                            stringlizedChat += `${cont.role === 'assistant' ? (char.type === 'group' ? '' : char.name) : userName}: ${cont.content}\n\n`;
                            spiceLen += 1;
                            currentTokens -= tokens;
                            chunkSize += tokens;
                        }
                    }
                    lastId = cont.memo || '';
                    break;
                }
                const userName = await getUserName(userId, room.id, database);
                stringlizedChat += `${cont.role === 'assistant' ? (char.type === 'group' ? '' : char.name) : userName}: ${cont.content}\n\n`;
                spiceLen += 1;
                currentTokens -= tokens;
                chunkSize += tokens;
            }
            chats.splice(0, spiceLen);

            if (stringlizedChat !== '') {
                const result = await summarize(stringlizedChat);

                if (typeof result !== 'string') {
                    return result;
                }

                const tokenz = await tokenize(result + '\n\n', tokenizerContext);
                hypaChunks.push(result.replace(/\n+/g, '\n'));

                let SupaMemoryList = supaMemory.split('\n\n').filter(value => value.length > 1);
                if (SupaMemoryList.length >= (arg.asHyper ? 3 : 4)) {
                    const oldSupaMemory = supaMemory;
                    const result = await summarize(supaMemory);
                    if (typeof result !== 'string') {
                        return result;
                    }
                    supaMemory = result;
                    currentTokens -= await tokenize(oldSupaMemory, tokenizerContext);
                    currentTokens += await tokenize(supaMemory, tokenizerContext);
                }
                SupaMemoryList = supaMemory.split('\n\n').filter(value => value.length > 1);
                SupaMemoryList.push(result.replace(/\n+/g, '\n'));
                currentTokens += tokenz;
                supaMemory = SupaMemoryList.join('\n\n');
            }
        }

        chats.unshift({
            role: 'system',
            content: supaMemory,
            memo: 'supaMemory',
        });

        if (arg.asHyper) {
            if (hypaResult !== '') {
                chats.unshift({
                    role: 'system',
                    content: hypaResult,
                    memo: 'hypaMemory',
                });
            }

            if (HypaData[0] && HypaData[0].id === lastId) {
                HypaData[0].hypa = hypaChunks;
                HypaData[0].supa = supaMemory;
            } else {
                HypaData.unshift({
                    id: lastId,
                    hypa: hypaChunks,
                    supa: supaMemory,
                });
            }

            return {
                currentTokens: currentTokens,
                chats: chats,
                memory: 'hypa:\n' + JSON.stringify(HypaData, null, 2),
                lastId: lastId,
            };
        }

        return {
            currentTokens: currentTokens,
            chats: chats,
            memory: lastId + '\n' + supaMemory,
            lastId: lastId,
        };
    }
    return {
        currentTokens: currentTokens,
        chats: chats,
    };
}
