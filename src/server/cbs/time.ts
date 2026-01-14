/**
 * CBS 시간 관련 함수들
 * chatindex, firstmsgindex, blank, messagetime, messagedate, unixtime, time, isotime, isodate, messageidleduration, idleduration
 */

import type { CBSRegisterArg } from './types';

export function registerTimeFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getSelectedCharID, makeArray } = arg;

    registerFunction({
        name: 'chatindex',
        callback: (str, matcherArg, args, vars) => {
            return matcherArg.chatID.toString()
        },
        alias: ['chat_index'],
        description: 'Returns the current message index in the chat as a string. -1 indicates no specific message context.\n\nUsage:: {{chatindex}}',
    });

    registerFunction({
        name: 'firstmsgindex',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            return chat.fmIndex.toString()
        },
        alias: ['firstmessageindex', 'first_msg_index'],
        description: 'Returns the index of the selected first message/alternate greeting as a string. -1 indicates the default first message is used.\n\nUsage:: {{firstmsgindex}}',
    });

    registerFunction({
        name: 'blank',
        callback: (str, matcherArg, args, vars) => {
            return ''
        },
        alias: ['none'],
        description: 'Returns an empty string. Useful for clearing variables or creating conditional empty outputs.\n\nUsage:: {{blank}}',
    });

    registerFunction({
        name: 'messagetime',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.tokenizeAccurate){
                return `00:00:00`
            }
            if(matcherArg.chatID === -1){
                return "[Cannot get time]"
            }

            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            const message = chat.message[matcherArg.chatID]
            if(!message.time){
                return "[Cannot get time, message was sent in older version]"
            }
            const date = new Date(message.time)
            return date.toLocaleTimeString()
        },
        alias: ['message_time'],
        description: 'Returns the time when the current message was sent in local time format (HH:MM:SS). Returns "00:00:00" in tokenization mode or error messages for old/invalid messages.\n\nUsage:: {{messagetime}}',
    });

    registerFunction({
        name: 'messagedate',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.tokenizeAccurate){
                return `00:00:00`
            }
            if(matcherArg.chatID === -1){
                return "[Cannot get time]"
            }
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            const message = chat.message[matcherArg.chatID]
            if(!message.time){
                return "[Cannot get time, message was sent in older version]"
            }
            const date = new Date(message.time)
            return date.toLocaleDateString()
        },
        alias: ['message_date'],
        description: 'Returns the date when the current message was sent in local date format. Returns "00:00:00" in tokenization mode or error messages for old/invalid messages.\n\nUsage:: {{messagedate}}',
    });

    registerFunction({
        name: 'messageunixtimearray',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            return makeArray(chat.message.map((f) => {
                return `${f.time ?? 0}`
            }))
        },
        alias: ['message_unixtime_array'],
        description: 'Returns all message timestamps as a JSON array of unix timestamps (in milliseconds). Messages without timestamps show as 0.\n\nUsage:: {{messageunixtimearray}}',
    });

    registerFunction({
        name: 'unixtime',
        callback: (str, matcherArg, args, vars) => {
            const now = new Date()
            return (now.getTime() / 1000).toFixed(0)
        },
        alias: [],
        description: 'Returns the current unix timestamp in seconds as a string. Useful for time-based calculations and logging.\n\nUsage:: {{unixtime}}',
    });

    registerFunction({
        name: 'time',
        callback: (str, matcherArg, args, vars) => {
            const now = new Date()
            return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
        },
        alias: [],
        description: 'Returns the current local time in HH:MM:SS format. Updates in real-time when the function is called.\n\nUsage:: {{time}}',
    });

    registerFunction({
        name: 'isotime',
        callback: (str, matcherArg, args, vars) => {
            const now = new Date()
            return `${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()}`
        },
        alias: [],
        description: 'Returns the current UTC time in HH:MM:SS format. Useful for timezone-independent time references.\n\nUsage:: {{isotime}}',
    });

    registerFunction({
        name: 'isodate',
        callback: (str, matcherArg, args, vars) => {
            const now = new Date()
            return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`
        },
        alias: [],
        description: 'Returns the current UTC date in YYYY-MM-DD format (month not zero-padded). Useful for timezone-independent date references.\n\nUsage:: {{isodate}}',
    });

    registerFunction({
        name: 'messageidleduration',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.tokenizeAccurate){
                return `00:00:00`
            }
            if(matcherArg.chatID === -1){
                return "[Cannot get time]"
            }
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            
            let pointer = matcherArg.chatID
            let pointerMode: 'findLast'|'findSecondLast' = 'findLast'
            let message:any
            let previous_message:any
            while(pointer >= 0){
                if(chat.message[pointer].role === 'user'){
                    if(pointerMode === 'findLast'){
                        message = chat.message[pointer]
                        pointerMode = 'findSecondLast'
                    }
                    else{
                        previous_message = chat.message[pointer]
                        break
                    }
                }
                pointer--
            }

            if(!message){
                return '[No user message found]'
            }

            if(!previous_message){
                return '[No previous user message found]'
            }
            if(!message.time){
                return "[Cannot get time, message was sent in older version]"
            }
            if(!previous_message.time){
                return "[Cannot get time, previous message was sent in older version]"
            }

            let duration = message.time - previous_message.time
            let seconds = Math.floor(duration / 1000)
            let minutes = Math.floor(seconds / 60)
            let hours = Math.floor(minutes / 60)
            seconds = seconds % 60
            minutes = minutes % 60
            return hours.toString() + ':' + minutes.toString().padStart(2,'0') + ':' + seconds.toString().padStart(2,'0')
        },
        alias: ['message_idle_duration'],
        description: 'Returns time duration between the current and previous user messages in HH:MM:SS format. Requires valid message times. Returns error messages if no messages found or timestamps missing.\n\nUsage:: {{messageidleduration}}',
    });

    registerFunction({
        name: 'idleduration',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.tokenizeAccurate){
                return `00:00:00`
            }
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            const messages = chat.message
            if(messages.length === 0){
                return `00:00:00`
            }

            const lastMessage = messages[messages.length - 1]

            if(!lastMessage.time){
                return "[Cannot get time, message was sent in older version]"
            }

            const now = new Date()

            let duration = now.getTime() - lastMessage.time

            let seconds = Math.floor(duration / 1000)
            let minutes = Math.floor(seconds / 60)
            let hours = Math.floor(minutes / 60)

            seconds = seconds % 60
            minutes = minutes % 60
            
            return hours.toString() + ':' + minutes.toString().padStart(2,'0') + ':' + seconds.toString().padStart(2,'0')
        },
        alias: ['idle_duration'],
        description: 'Returns time duration since the last message in the chat in HH:MM:SS format. Calculates from current time to last message timestamp. Returns "00:00:00" in tokenization mode or error for missing timestamps.\n\nUsage:: {{idleduration}}',
    });
}
