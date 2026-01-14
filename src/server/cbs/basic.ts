/**
 * CBS 기본 변수 함수들
 * char, user, trigger_id, previouscharchat, previoususerchat
 */

import type { CBSRegisterArg, matcherArg } from './types';

export function registerBasicFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getUserName, getSelectedCharID } = arg;

    registerFunction({
        name: 'char',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.consistantChar){
                return 'botname'
            }
            const db = getDatabase()
            let selectedChar = getSelectedCharID()
            let currentChar = db.characters[selectedChar]
            if(currentChar && currentChar.type !== 'group'){
                return currentChar.nickname || currentChar.name
            }
            if(matcherArg.chara){
                if(typeof(matcherArg.chara) === 'string'){
                    return matcherArg.chara
                }
                else{
                    return matcherArg.chara.name
                }
            }
            return currentChar.nickname || currentChar.name
        },
        alias: ['bot'],
        description: 'Returns the name or nickname of the current character/bot. In consistent character mode, returns "botname". For group chats, returns the group name.\n\nUsage:: {{char}}',
    });

    registerFunction({
        name: 'user',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.consistantChar){
                return 'username'
            }
            return getUserName()
        },
        alias: [],
        description: 'Returns the current user\'s name as set in user settings. In consistent character mode, returns "username".\n\nUsage:: {{user}}',
    });

    registerFunction({
        name: 'trigger_id',
        callback: (str, matcherArg, args, vars) => {
            // 서버 사이드에서는 matcherArg.triggerId 사용
            return matcherArg.triggerId ?? 'null'
        },
        alias: ['triggerid'],
        description: 'Returns the ID value from the risu-id attribute of the clicked element that triggered the manual trigger. Returns "null" if no ID was provided.\n\nUsage:: {{trigger_id}}',
    });

    registerFunction({
        name: 'previouscharchat',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            let pointer = matcherArg.chatID !== -1 ? matcherArg.chatID - 1 : chat.message.length - 1
            while(pointer >= 0){
                if(chat.message[pointer].role === 'char'){
                    return chat.message[pointer].data
                }
                pointer--
            }
            return chat.fmIndex === -1 ? selchar.firstMessage : selchar.alternateGreetings[chat.fmIndex]
        },
        alias: ['previouscharchat', 'lastcharmessage'],
        description: 'Returns the last message sent by the character in the current chat. Searches backwards from the current message position to find the most recent character message. If no character messages exist, returns the first message or selected alternate greeting.\n\nUsage:: {{previouscharchat}}',
    });
    
    registerFunction({
        name: 'previoususerchat',
        callback: (str, matcherArg, args, vars) => {
            const chatID = matcherArg.chatID
            if(chatID !== -1){
                const db = getDatabase()
                const selchar = db.characters[getSelectedCharID()]
                const chat = selchar.chats[selchar.chatPage]
                let pointer = chatID - 1
                while(pointer >= 0){
                    if(chat.message[pointer].role === 'user'){
                        return chat.message[pointer].data
                    }
                    pointer--
                }
                return chat.fmIndex === -1 ? selchar.firstMessage : selchar.alternateGreetings[chat.fmIndex]
            }
            return ''
        },
        alias: ['previoususerchat', 'lastusermessage'],
        description: 'Returns the last message sent by the user in the current chat. Searches backwards from the current message position to find the most recent user message. Only works when chatID is available (not -1). Returns empty string if no user messages found.\n\nUsage:: {{previoususerchat}}',
    });
}
