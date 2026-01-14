/**
 * Parser 타입 정의
 */

import type { Database, character, customscript, groupChat, triggerscript } from '../database';

export type CbsConditions = {
    firstmsg?: boolean
    chatRole?: string
}

export interface simpleCharacterArgument {
    type: 'simple'
    additionalAssets?: [string, string, string][]
    customscript: customscript[]
    chaId: string,
    virtualscript?: string
    emotionImages?: [string, string][]
    triggerscript?: triggerscript[]
}

export type ImageType = 'JPEG' | 'PNG' | 'GIF' | 'BMP' | 'AVIF' | 'WEBP' | 'Unknown';

export type AssetPaths = {
    [key: string]: {
        srcPaths: string[]
        ext?: string
    }
}

export type blockMatch = 'ignore' | 'parse' | 'nothing' | 'ifpure' | 'pure' | 'each' | 'function' | 'pure-display' | 'normalize' | 'escape' | 'newif' | 'newif-falsy'

export interface RisuChatParserArg {
    chatID?: number
    db?: Database
    chara?: string | character | groupChat
    rmVar?: boolean,
    var?: { [key: string]: string }
    tokenizeAccurate?: boolean
    consistantChar?: boolean
    visualize?: boolean,
    role?: string
    runVar?: boolean
    functions?: Map<string, { data: string, arg: string[] }>
    callStack?: number
    cbsConditions?: CbsConditions
}
