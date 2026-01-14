/**
 * CBS 메타데이터 및 모델 관련 함수들
 * br, model, axmodel, role, isfirstmsg, jbtoggled, maxcontext, lastmessage, lastmessageid, emotionlist, assetlist, prefillsupported, screenwidth, screenheight, metadata
 */

import type { CBSRegisterArg } from './types';

export function registerMetadataFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getSelectedCharID, makeArray, getModelInfo, isTauri, isNodeServer, isMobile, appVer } = arg;

    registerFunction({
        name: 'br',
        callback: (str, matcherArg, args, vars) => {
            return '\n'
        },
        alias: ['newline'],
        description: 'Returns a literal newline character (\\n). Useful for formatting text with line breaks in templates.\n\nUsage:: {{br}}',
    });

    registerFunction({
        name: 'model',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return db.aiModel
        },
        alias: [],
        description: 'Returns the ID/name of the currently selected AI model (e.g., "gpt-4", "claude-3-opus").\n\nUsage:: {{model}}',
    });

    registerFunction({
        name: 'axmodel',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return db.subModel
        },
        alias: [],
        description: 'Returns the currently selected sub/auxiliary model ID. Used for specialized tasks like embedding or secondary processing.\n\nUsage:: {{axmodel}}',
    });

    registerFunction({
        name: 'role',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.cbsConditions.chatRole){
                return matcherArg.cbsConditions.chatRole
            }
            if(matcherArg.cbsConditions.firstmsg){
                return 'char'
            }
            if (matcherArg.chatID !== -1) {
                const db = getDatabase()
                const selchar = db.characters[getSelectedCharID()]
                return selchar.chats[selchar.chatPage].message[matcherArg.chatID].role;
            }
            return matcherArg.role ?? 'null'
        },
        alias: [],
        description: 'Returns the role of the current message ("user", "char", "system"). Uses chatRole from conditions if available, "char" for first messages, or actual message role.\n\nUsage:: {{role}}',
    });

    registerFunction({
        name: 'isfirstmsg',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.cbsConditions.firstmsg){
                return '1'
            }
            return '0'
        },
        alias: ['isfirstmsg', 'isfirstmessage'],
        description: 'Returns "1" if the current context is the first message/greeting, "0" otherwise. Checks the firstmsg condition flag.\n\nUsage:: {{isfirstmsg}}',
    });

    registerFunction({
        name: 'jbtoggled',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return db.jailbreakToggle ? '1' : '0'
        },
        alias: [],
        description: 'Returns "1" if the jailbreak prompt is currently enabled/toggled on, "0" if disabled. Reflects the global jailbreak toggle state.\n\nUsage:: {{jbtoggled}}',
    });

    registerFunction({
        name: 'maxcontext',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return db.maxContext.toString()
        },
        alias: [],
        description: 'Returns the maximum context length setting as a string (e.g., "4096", "8192"). This is the token limit for the current model configuration.\n\nUsage:: {{maxcontext}}',
    });

    registerFunction({
        name: 'lastmessage',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            if(!selchar){
                return ''
            }
            const chat = selchar.chats[selchar.chatPage]
            return chat.message[chat.message.length - 1].data
        },
        alias: [],
        description: 'Returns the content/data of the last message in the current chat, regardless of role (user/char). Returns empty string if no character selected.\n\nUsage:: {{lastmessage}}',
    });

    registerFunction({
        name: 'lastmessageid',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            if(!selchar){
                return ''
            }
            const chat = selchar.chats[selchar.chatPage]
            return (chat.message.length - 1).toString()
        },
        alias: ['lastmessageindex'],
        description: 'Returns the index of the last message in the chat as a string (0-based indexing). Returns empty string if no character selected.\n\nUsage:: {{lastmessageid}}',
    });

    registerFunction({
        name: 'emotionlist',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            if(!selchar){
                return ''
            }
            return makeArray(selchar.emotionImages?.map((f) => {
                return f[0]
            }) ?? [])
        },
        alias: [],
        description: 'Returns a JSON array of emotion image names available for the current character. Only includes the names, not the actual image data. Returns empty string if no character or no emotions.\n\nUsage:: {{emotionlist}}',
    });

    registerFunction({
        name: 'assetlist',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            if(!selchar || selchar.type === 'group'){
                return ''
            }
            return makeArray(selchar.additionalAssets?.map((f) => {
                return f[0]
            }) ?? [])
        },
        alias: [],
        description: 'Returns a JSON array of additional asset names for the current character. These are extra images/files beyond the main avatar. Returns empty string for groups or characters without assets.\n\nUsage:: {{assetlist}}',
    });

    registerFunction({
        name: 'prefillsupported',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            return db.aiModel.startsWith('claude') ? '1' : '0'
        },
        alias: ['prefill_supported', 'prefill'],
        description: 'Returns "1" if the current AI model supports prefill functionality (like Claude models), "0" otherwise. Prefill allows pre-filling the assistant\'s response start.\n\nUsage:: {{prefillsupported}}',
    });

    registerFunction({
        name: 'screenwidth',
        callback: (str, matcherArg, args, vars) => {
            // 서버 사이드에서는 기본값 반환 (브라우저 API 사용 불가)
            return '1920'
        },
        alias: ['screen_width'],
        description: 'Returns the current screen/viewport width in pixels as a string. Updates dynamically with window resizing. Useful for responsive layouts.\n\nUsage:: {{screenwidth}}',
    });

    registerFunction({
        name: 'screenheight',
        callback: (str, matcherArg, args, vars) => {
            // 서버 사이드에서는 기본값 반환 (브라우저 API 사용 불가)
            return '1080'
        },
        alias: ['screen_height'],
        description: 'Returns the current screen/viewport height in pixels as a string. Updates dynamically with window resizing. Useful for responsive layouts.\n\nUsage:: {{screenheight}}',
    });

    registerFunction({
        name: 'metadata',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            switch(args[0]?.toLocaleLowerCase()){
                case 'mobile':{
                    return isMobile ? '1' : '0'
                }
                case 'local':{
                    return isTauri ? '1' : '0'
                }
                case 'node':{
                    return isNodeServer ? '1' : '0'
                }
                case 'version':{
                    return appVer
                }
                case 'majorversion':
                case 'majorver':
                case 'major':{
                    return appVer.split('.')[0]
                }
                case 'language':
                case 'locale':
                case 'lang':{
                    return db.language
                }
                case 'browserlanguage':
                case 'browserlocale':
                case 'browserlang':{
                    // 서버 사이드에서는 기본값 반환
                    return 'en-US'
                }
                case 'modelshortname':{
                    const modelInfo = getModelInfo(db.aiModel)
                    return modelInfo.shortName ?? modelInfo.name ?? modelInfo.id
                }
                case 'modelname':{
                    const modelInfo = getModelInfo(db.aiModel)
                    return modelInfo.name ?? modelInfo.id
                }
                case 'modelinternalid':{
                    const modelInfo = getModelInfo(db.aiModel)
                    return modelInfo.internalID ?? modelInfo.id
                }
                case 'modelformat':{
                    const modelInfo = getModelInfo(db.aiModel)
                    return modelInfo.format.toString()
                }
                case 'modelprovider':{
                    const modelInfo = getModelInfo(db.aiModel)
                    return modelInfo.provider.toString()
                }
                case 'modeltokenizer':{
                    const modelInfo = getModelInfo(db.aiModel)
                    return modelInfo.tokenizer.toString()
                }
                case 'imateapot':{
                    return '🫖'
                }
                case 'risutype':{
                    return isTauri ? 'local' : isNodeServer ? 'node' : 'web'
                }
                case 'maxcontext':{
                    return db.maxContext.toString()
                }
                default:{
                    return `Error: ${args[0]} is not a valid metadata key.`
                }
            }
        },
        alias: [],
        description: 'Returns various system and application metadata. Supported keys: mobile, local, node, version, language, modelname, etc. Returns error message for invalid keys.\n\nUsage:: {{metadata::version}}',
    });
}
