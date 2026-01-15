/**
 * 캐릭터 관련 타입 정의
 */

import type { character, customscript, loreBook, loreSettings, triggerscript, groupChat } from '../database';
import type { CharacterCardV3, LorebookEntry } from '@risuai/ccardlib';

/**
 * OnnxModelFiles 타입
 * 원본: src/ts/process/transformers.ts
 * 서버 사이드에서는 transformers 모듈이 제한적이므로 타입만 정의
 */
export interface OnnxModelFiles {
    tokenizer?: string;
    tokenizer_config?: string;
    config?: string;
    model?: string;
    [key: string]: string | undefined;
}

export interface CharacterCardV2Risu {
    spec: 'chara_card_v2'
    spec_version: '2.0'
    data: {
        name: string
        description: string
        personality: string
        scenario: string
        first_mes: string
        mes_example: string
        creator_notes: string
        system_prompt: string
        post_history_instructions: string
        alternate_greetings: string[]
        character_book?: CharacterBook
        tags: string[]
        creator: string
        character_version: string
        extensions: {
            risuai?: {
                emotions?: [string, string][]
                bias?: [string, number][],
                viewScreen?: any,
                customScripts?: customscript[]
                utilityBot?: boolean,
                sdData?: [string, string][],
                additionalAssets?: [string, string, string][],
                backgroundHTML?: string,
                license?: string,
                triggerscript?: triggerscript[]
                private?: boolean
                additionalText?: string
                virtualscript?: string
                largePortrait?: boolean
                lorePlus?: boolean
                inlayViewScreen?: boolean
                newGenData?: {
                    prompt: string,
                    negative: string,
                    instructions: string,
                    emotionInstructions: string,
                },
                vits?: { [key: string]: string }
            }
            depth_prompt?: { depth: number, prompt: string }
        }
    }
}

export interface OldTavernChar {
    avatar: "none"
    chat: string
    create_date: string
    description: string
    first_mes: string
    mes_example: string
    name: string
    personality: string
    scenario: string
    talkativeness: "0.5"
    spec_version?: '1.0'
}

export interface CharacterBook {
    name?: string
    description?: string
    scan_depth?: number
    token_budget?: number
    recursive_scanning?: boolean
    extensions: Record<string, any>
    entries: Array<charBookEntry>
}

export interface charBookEntry {
    keys: Array<string>
    content: string
    extensions: Record<string, any>
    enabled: boolean
    insertion_order: number
    name?: string
    priority?: number
    id?: number
    comment?: string
    selective?: boolean
    secondary_keys?: Array<string>
    constant?: boolean
    position?: 'before_char' | 'after_char'
    case_sensitive?: boolean
    use_regex?: boolean
    mode?: string
    folder?: string
}

export interface RccCardMetaData {
    usePassword?: boolean
}

export interface hubType {
    name: string
    desc: string
    download: string,
    id: string,
    img: string
    tags: string[],
    viewScreen: "none" | "emotion" | "imggen"
    hasLore: boolean
    hasEmotion: boolean
    hasAsset: boolean
    creator?: string
    creatorName?: string
    hot: number
    license: string
    authorname?: string
    original?: string
    type: string
    hidden?: boolean
}

export interface RisuLorebookEntry extends LorebookEntry {
    mode?: string;
    folder?: string;
}

export interface ImportCharacterProcessArg {
    name: string;
    data: Uint8Array | File | ReadableStream<Uint8Array>
    lightningRealmImport?: boolean
}

export interface ExportCharacterCardArg {
    password?: string
    writer?: any // LocalWriter | VirtualWriter
    spec?: 'v2' | 'v3'
}

export interface ShareRisuHubArg {
    nsfw: boolean,
    tag: string
    license: string
    anon: boolean,
    update: boolean
}

export interface GetRisuHubArg {
    search: string,
    page: number,
    nsfw: boolean
    sort: string
}

export interface DownloadRisuHubArg {
    forceRedirect?: boolean
}

export interface CharacterFormatUpdateArg {
    updateInteraction?: boolean,
}

export interface AddCharacterArg {
    reseter?: () => any,
}

export interface ChangeCharArg {
    reseter?: () => any,
}

export interface RemoveCharArg {
    index: number,
    name: string,
    type?: 'normal' | 'permanent' | 'permanentForce'
}
