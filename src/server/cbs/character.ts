/**
 * CBS 캐릭터 데이터 함수들
 * personality, description, scenario, exampledialogue
 */

import type { CBSRegisterArg } from './types';

export function registerCharacterFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getSelectedCharID, risuChatParser } = arg;

    registerFunction({
        name: 'personality',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const argChara = matcherArg.chara
            const achara = (argChara && typeof(argChara) !== 'string') ? argChara : (db.characters[getSelectedCharID()])
            if(achara.type === 'group'){
                return ""
            }
            return risuChatParser(achara.personality, matcherArg)
        },
        alias: ['charpersona'],
        description: 'Returns the personality field of the current character. The text is processed through the chat parser for variable substitution. Returns empty string for group chats.\n\nUsage:: {{personality}}',
    });

    registerFunction({
        name: 'description',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const argChara = matcherArg.chara
            const achara = (argChara && typeof(argChara) !== 'string') ? argChara : (db.characters[getSelectedCharID()])
            if(achara.type === 'group'){
                return ""
            }
            return risuChatParser(achara.desc, matcherArg)
        },
        alias: ['chardesc'],
        description: 'Returns the description field of the current character. The text is processed through the chat parser for variable substitution. Returns empty string for group chats.\n\nUsage:: {{description}}',
    });

    registerFunction({
        name: 'scenario',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const argChara = matcherArg.chara
            const achara = (argChara && typeof(argChara) !== 'string') ? argChara : (db.characters[getSelectedCharID()])
            if(achara.type === 'group'){
                return ""
            }
            return risuChatParser(achara.scenario, matcherArg)
        },
        alias: [],
        description: 'Returns the scenario field of the current character. The text is processed through the chat parser for variable substitution. Returns empty string for group chats.\n\nUsage:: {{scenario}}',
    });

    registerFunction({
        name: 'exampledialogue',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const argChara = matcherArg.chara
            const achara = (argChara && typeof(argChara) !== 'string') ? argChara : (db.characters[getSelectedCharID()])
            if(achara.type === 'group'){
                return ""
            }
            return risuChatParser(achara.exampleMessage, matcherArg)
        },
        alias: ['examplemessage', 'example_dialogue'],
        description: 'Returns the example dialogue/message field of the current character. The text is processed through the chat parser for variable substitution. Returns empty string for group chats.\n\nUsage:: {{exampledialogue}}',
    });
}
