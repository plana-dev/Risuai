/**
 * CBS 프롬프트 및 시스템 함수들
 * persona, mainprompt, lorebook, userhistory, charhistory, jb, globalnote
 */

import type { CBSRegisterArg } from './types';

export function registerPromptFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getPersonaPrompt, getSelectedCharID, risuChatParser, makeArray, safeStructuredClone, getModuleLorebooks } = arg;

    registerFunction({
        name: 'persona',
        callback: (str, matcherArg, args, vars) => {
            return risuChatParser(getPersonaPrompt(), matcherArg)
        },
        alias: ['userpersona'],
        description: 'Returns the user persona prompt text. The text is processed through the chat parser for variable substitution. This contains the user\'s character description/personality.\n\nUsage:: {{persona}}',
    });

    registerFunction({
        name: 'mainprompt',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return risuChatParser(db.mainPrompt, matcherArg)
        },
        alias: ['systemprompt', 'main_prompt'],
        description: 'Returns the main system prompt that provides instructions to the AI model. The text is processed through the chat parser for variable substitution.\n\nUsage:: {{mainprompt}}',
    });

    registerFunction({
        name: 'lorebook',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const argChara = matcherArg.chara
            const achara = (argChara && typeof(argChara) !== 'string') ? argChara : (db.characters[getSelectedCharID()])
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            const characterLore = (achara.type === 'group') ? [] : (achara.globalLore ?? [])
            const chatLore = chat.localLore ?? []
            const fullLore = characterLore.concat(chatLore.concat(getModuleLorebooks()))
            return makeArray(fullLore.map((v) => {
                return JSON.stringify(v)
            }))
        },
        alias: ['worldinfo'],
        description: 'Returns all active lorebook entries as a JSON array. Combines character lorebook, chat-specific lorebook, and module lorebooks. Each entry is JSON.stringify\'d.\n\nUsage:: {{lorebook}}',
    });

    registerFunction({
        name: 'userhistory',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            return makeArray(chat.message.filter((v) => {
                return v.role === 'user'
            }).map((v) => {
                v = safeStructuredClone(v)
                v.data = risuChatParser(v.data, matcherArg)
                return JSON.stringify(v)
            }))
        },
        alias: ['usermessages', 'user_history'],
        description: 'Returns all user messages in the current chat as a JSON array. Each message object contains role, data, and other metadata. Data is processed through chat parser.\n\nUsage:: {{userhistory}}',
    });

    registerFunction({
        name: 'charhistory',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            return makeArray(chat.message.filter((v) => {
                return v.role === 'char'
            }).map((v) => {
                v = safeStructuredClone(v)
                v.data = risuChatParser(v.data, matcherArg)
                return JSON.stringify(v)
            }))
        },
        alias: ['charmessages', 'char_history'],
        description: 'Returns all character messages in the current chat as a JSON array. Each message object contains role, data, and other metadata. Data is processed through chat parser.\n\nUsage:: {{charhistory}}',
    });

    registerFunction({
        name: 'jb',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return risuChatParser(db.jailbreak, matcherArg)
        },
        alias: ['jailbreak'],
        description: 'Returns the jailbreak prompt text used to modify AI behavior. The text is processed through the chat parser for variable substitution.\n\nUsage:: {{jb}}',
    });

    registerFunction({
        name: 'globalnote',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return risuChatParser(db.globalNote, matcherArg)
        },
        alias: ['globalnote', 'systemnote', 'ujb'],
        description: 'Returns the global note (also called system note) that is appended to prompts. The text is processed through the chat parser for variable substitution.\n\nUsage:: {{globalnote}}',
    });
}
