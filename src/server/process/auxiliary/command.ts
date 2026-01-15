/**
 * 명령어 처리 함수
 * 원본: src/ts/process/command.ts의 processMultiCommand
 * 서버 사이드에서 사용할 수 있도록 개선
 * 
 * 주의: 일부 명령어는 클라이언트 전용 기능(alert, UI 등)이므로 서버에서는 제한적으로 동작합니다.
 */

import type { character, Chat, Database } from '../../database';
import type { ProcessContext } from '../context';
import { risuChatParser } from '../../parser';
import { createParserContexts } from '../parser-context';
import { setChat } from '../../database/access';
import { sendChat } from '../chat/send-chat';
import { runTrigger } from '../trigger';
import { loadLoreBookV3Prompt } from '../lorebook';

/**
 * 파이프(|)로 구분된 여러 명령어 처리
 */
export async function processMultiCommand(
    command: string,
    context: ProcessContext
): Promise<string | false> {
    let pipe = '';
    const splited: string[] = [];
    let lastIndex = 0;
    let quoteDepth = false;

    for (let i = 0; i < command.length; i++) {
        const char = command[i];
        if (char === '"') {
            quoteDepth = !quoteDepth;
        } else if (char === '|' && quoteDepth === false) {
            splited.push(command.slice(lastIndex, i));
            lastIndex = i + 1;
        }
    }
    splited.push(command.slice(lastIndex));

    for (let i = 0; i < splited.length; i++) {
        const result = await processCommand(splited[i].trim(), pipe, context);
        if (result === false) {
            return false;
        } else {
            pipe = result;
        }
    }
    return pipe;
}

/**
 * 단일 명령어 처리
 */
async function processCommand(
    command: string,
    pipe: string,
    context: ProcessContext
): Promise<false | string> {
    const { database, character: currentChar, chat: currentChat } = context;
    const { commandName, arg, namedArg } = commandParser(command, pipe);

    let processedArg = arg || pipe;
    processedArg = risuChatParser(processedArg, {
        chara: currentChar.type === 'character' ? currentChar : null,
        chatID: -1,
        db: database,
        rmVar: false,
        cbsConditions: {}
    }, createParserContexts(context));

    const processedNamedArg: { [key: string]: string } = {};
    for (const key in namedArg) {
        processedNamedArg[key] = risuChatParser(namedArg[key], {
            chara: currentChar.type === 'character' ? currentChar : null,
            chatID: -1,
            db: database,
            rmVar: false,
            cbsConditions: {}
        }, createParserContexts(context));
    }

    switch (commandName) {
        // STScript compatibility commands
        case 'input': {
            // 서버에서는 입력을 받을 수 없으므로 파이프 반환
            console.warn('[Command] /input is not supported on server side');
            return processedArg;
        }
        case 'echo':
        case 'popup': {
            // 서버에서는 로그로 출력
            console.log('[Command]', processedArg);
            return pipe;
        }
        case 'pass': {
            pipe = processedArg;
            return pipe;
        }
        case 'buttons': {
            // 서버에서는 선택을 받을 수 없으므로 첫 번째 옵션 반환
            if (processedNamedArg.labels) {
                try {
                    const JSONLabels = JSON.parse(processedNamedArg.labels);
                    if (Array.isArray(JSONLabels) && JSONLabels.length > 0) {
                        console.warn('[Command] /buttons is not fully supported on server side, returning first option');
                        return JSONLabels[0];
                    }
                } catch (error) {
                    // JSON 파싱 실패
                }
            }
            return pipe;
        }
        case 'setinput': {
            // NOT IMPLEMENTED
            return false;
        }
        case 'speak': {
            // 서버에서는 TTS를 직접 실행할 수 없으므로 로그만 출력
            console.log('[Command] /speak:', processedArg);
            return pipe;
        }
        case 'send': {
            if (currentChat) {
                currentChat.message.push({
                    role: 'user',
                    data: processedArg
                });
                await setChat(context.userId, context.characterId, context.chatId, currentChat);
            }
            return pipe;
        }
        case 'sendas': {
            if (currentChat) {
                currentChat.message.push({
                    role: 'char',
                    data: processedArg
                });
                await setChat(context.userId, context.characterId, context.chatId, currentChat);
            }
            return pipe;
        }
        case 'comment': {
            if (currentChat && currentChat.message.length > 0) {
                const addition = `<Comment>\n${processedArg}\n</Comment>`;
                currentChat.message[currentChat.message.length - 1].data += addition;
                await setChat(context.userId, context.characterId, context.chatId, currentChat);
            }
            return pipe;
        }
        case 'cut': {
            if (currentChat) {
                if (processedArg.includes('-')) {
                    const [start, end] = processedArg.split('-');
                    currentChat.message = currentChat.message.slice(parseInt(start), parseInt(end));
                    await setChat(context.userId, context.characterId, context.chatId, currentChat);
                } else if (!isNaN(parseInt(processedArg))) {
                    const index = parseInt(processedArg);
                    currentChat.message.splice(index, 1);
                    await setChat(context.userId, context.characterId, context.chatId, currentChat);
                } else {
                    // For risu, doesn't work for STScript
                    const id = processedArg;
                    currentChat.message = currentChat.message.filter((e) => e.chatId !== id);
                    await setChat(context.userId, context.characterId, context.chatId, currentChat);
                }
            }
            return pipe;
        }
        case 'del': {
            if (currentChat) {
                const size = parseInt(processedArg);
                if (!isNaN(size)) {
                    currentChat.message = currentChat.message.slice(currentChat.message.length - size);
                    await setChat(context.userId, context.characterId, context.chatId, currentChat);
                }
            }
            return pipe;
        }
        case 'len': {
            try {
                const parsed = JSON.parse(processedArg);
                if (Array.isArray(parsed)) {
                    pipe = parsed.length.toString();
                }
            } catch (error) {
                // JSON 파싱 실패
            }
            return pipe;
        }
        case 'multisend': {
            if (currentChat) {
                const splited = processedArg.split('|||');
                let clearMode = false;
                if (splited[0] && splited[0].trim() === 'clear') {
                    clearMode = true;
                    splited.shift();
                }
                for (const e of splited) {
                    if (clearMode) {
                        currentChat.message = [];
                    }
                    currentChat.message.push({
                        role: 'user',
                        data: e
                    });
                    // sendChat 호출 (비동기이지만 await하지 않음)
                    sendChat(context).catch(err => {
                        console.error('[Command] Error in multisend sendChat:', err);
                    });
                }
            }
            return '';
        }
        case 'setvar': {
            if (currentChat) {
                currentChat.scriptstate = currentChat.scriptstate ?? {};
                currentChat.scriptstate['$' + processedNamedArg['key']] = processedArg;
                await setChat(context.userId, context.characterId, context.chatId, currentChat);
            }
            return '';
        }
        case 'addvar': {
            if (currentChat) {
                currentChat.scriptstate = currentChat.scriptstate ?? {};
                currentChat.scriptstate['$' + processedNamedArg['key']] = (
                    Number(currentChat.scriptstate['$' + processedNamedArg['key']]) + Number(processedArg)
                ).toString();
                await setChat(context.userId, context.characterId, context.chatId, currentChat);
            }
            return '';
        }
        case 'getvar': {
            if (currentChat) {
                currentChat.scriptstate = currentChat.scriptstate ?? {};
                pipe = (currentChat.scriptstate['$' + processedNamedArg['key']] ?? 'null').toString();
            }
            return pipe;
        }
        case 'test_lorebook': {
            const p = await loadLoreBookV3Prompt(context);
            console.log('[Command] Lorebook prompt:', p.actives.map((e) => e.prompt).join('§'));
            return JSON.stringify(p);
        }
        case 'trigger': {
            if (currentChar.type === 'group') {
                return pipe;
            }
            const triggerResult = await runTrigger(currentChar, 'manual', {
                chat: currentChat!,
                manualName: processedArg
            }, context);

            if (triggerResult && currentChat) {
                await setChat(context.userId, context.characterId, context.chatId, triggerResult.chat);
            }
            return pipe;
        }
        case '?': {
            // 도움말 반환
            return `Available commands:
/input [text] - Show input dialog (not supported on server)
/echo [text] - Show alert dialog (logs on server)
/popup [text] - Show alert dialog (logs on server)
/pass [text] - Return input text
/buttons [labels] - Show select dialog (returns first option on server)
/speak [text] - Speak text (logs on server)
/send [text] - Send text to chat
/sendas [text] - Send text to chat as character
/comment [text] - Add comment to chat
/cut [index] - Cut chat message
/del [size] - Delete chat message
/len [array] - Return length of array
/setvar key=[key] [value] - Set variable
/addvar key=[key] [value] - Add value to variable
/getvar key=[key] - Get variable
/trigger [name] - Run trigger
/? - Show help`;
        }
    }
    return false;
}

/**
 * 명령어 파싱
 */
function commandParser(command: string, pipe: string): {
    commandName: string;
    arg: string;
    namedArg: { [key: string]: string };
} {
    if (command.startsWith('/')) {
        command = command.slice(1);
    }
    const sliced = command.split(' ').filter((e) => e != '');
    const commandName = sliced[0];
    const argArray: string[] = [];
    const namedArg: { [key: string]: string } = {};
    for (let i = 1; i < sliced.length; i++) {
        if (sliced[i].includes('=')) {
            const [key, value] = sliced[i].split('=');
            namedArg[key] = value;
        } else {
            argArray.push(sliced[i]);
        }
    }
    const arg = argArray
        .join(' ')
        .replace('{{pipe}}', pipe) // STScript compatibility
        .replace('{{slot}}', pipe); // Risu default
    return { commandName, arg, namedArg };
}
