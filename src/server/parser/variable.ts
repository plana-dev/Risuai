/**
 * 변수 관련 함수들
 * getChatVar, setChatVar, getGlobalChatVar, setGlobalChatVar
 */

import type { Database } from '../database';

export interface VariableContext {
    getDatabase: () => Database;
    getSelectedCharID: () => number;
    parseKeyValue: (str: string) => [string, string][];
}

export function getChatVar(
    key: string,
    context: VariableContext
): string {
    const db = context.getDatabase();
    const selectedChar = context.getSelectedCharID();
    const char = db.characters[selectedChar];
    if (!char) {
        return 'null'
    }
    const chat = char.chats[char.chatPage]
    chat.scriptstate ??= {}
    const state = (chat.scriptstate['$' + key])
    if (state === undefined || state === null) {
        const defaultVariables = context.parseKeyValue(char.defaultVariables).concat(context.parseKeyValue(db.templateDefaultVariables))
        const findResult = defaultVariables.find((f) => {
            return f[0] === key
        })
        if (findResult) {
            return findResult[1]
        }
        return 'null'
    }
    return state.toString()
}

export function getGlobalChatVar(
    key: string,
    context: VariableContext
): string {
    const db = context.getDatabase();
    return db.globalChatVariables[key] ?? 'null'
}

export function setGlobalChatVar(
    key: string,
    value: string,
    context: VariableContext
) {
    const db = context.getDatabase();
    db.globalChatVariables[key] = value // String to String Map(dictionary)
}

export function setChatVar(
    key: string,
    value: string,
    context: VariableContext
) {
    const db = context.getDatabase();
    const selectedChar = context.getSelectedCharID();
    if (!db.characters[selectedChar].chats[db.characters[selectedChar].chatPage].scriptstate) {
        db.characters[selectedChar].chats[db.characters[selectedChar].chatPage].scriptstate = {}
    }
    db.characters[selectedChar].chats[db.characters[selectedChar].chatPage].scriptstate['$' + key] = value
}
