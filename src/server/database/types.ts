/**
 * 데이터베이스 관련 타입 정의
 * 
 * 원본: src/ts/storage/database.svelte.ts
 */

import type { triggerscript as triggerscriptMain } from '../../ts/process/triggers';
import type { OnnxModelFiles } from '../../ts/process/transformers';
import type { RisuModule } from '../../ts/process/modules';
import type { SerializableHypaV2Data } from '../../ts/process/memory/hypav2';
import type { SerializableHypaV3Data } from '../../ts/process/memory/hypav3';
import type { LLMFlags, LLMFormat, LLMTokenizer } from '../../ts/model/modellist';
import type { HypaModel } from '../../ts/process/memory/hypamemory';
import type { HypaV3Settings, HypaV3Preset } from '../../ts/process/memory/hypav3';
import type { RisuPlugin } from '../../ts/plugins/plugins';
import type { NAISettings } from '../../ts/process/models/nai';
import type { ColorScheme } from '../../ts/gui/colorscheme';
import type { PromptItem, PromptSettings } from '../../ts/process/prompt';
import type { OobaChatCompletionRequestParams } from '../../ts/model/ooba';
import type { OpenAIChat } from '../../ts/process/index.svelte';
import type { Hotkey } from '../../ts/defaulthotkeys';

export interface DynamicOutput {
    autoAdjustSchema: boolean
    dynamicMessages: boolean
    dynamicMemory: boolean
    dynamicResponseTiming: boolean
    dynamicOutputPrompt: boolean
    showTypingEffect: boolean
    dynamicRequest: boolean
}

export interface customscript {
    comment: string;
    in: string
    out: string
    type: string
    flag?: string
    ableFlag?: boolean
}

export type triggerscript = triggerscriptMain

export interface loreBook {
    key: string
    secondkey: string
    insertorder: number
    comment: string
    content: string
    mode: 'multiple' | 'constant' | 'normal' | 'child' | 'folder',
    alwaysActive: boolean
    selective: boolean
    extentions?: {
        risu_case_sensitive: boolean
    }
    activationPercent?: number
    loreCache?: {
        key: string
        data: string[]
    },
    useRegex?: boolean
    bookVersion?: number
    id?: string
    folder?: string
}

export interface loreSettings {
    tokenBudget: number
    scanDepth: number
    recursiveScanning: boolean
    fullWordMatching?: boolean
}

export interface character {
    type?: "character"
    name: string
    image?: string
    firstMessage: string
    desc: string
    notes: string
    chats: Chat[]
    chatFolders: ChatFolder[]
    chatPage: number
    viewScreen: 'emotion' | 'none' | 'imggen' | 'vn',
    bias: [string, number][]
    emotionImages: [string, string][]
    globalLore: loreBook[]
    chaId: string
    sdData: [string, string][]
    newGenData?: {
        prompt: string,
        negative: string,
        instructions: string,
        emotionInstructions: string,
    }
    customscript: customscript[]
    triggerscript: triggerscript[]
    utilityBot: boolean
    exampleMessage: string
    removedQuotes?: boolean
    creatorNotes: string
    systemPrompt: string
    postHistoryInstructions: string
    alternateGreetings: string[]
    tags: string[]
    creator: string
    characterVersion: string
    personality: string
    scenario: string
    firstMsgIndex: number
    loreSettings?: loreSettings
    loreExt?: any
    additionalData?: {
        tag?: string[]
        creator?: string
        character_version?: string
    }
    ttsMode?: string
    ttsSpeech?: string
    voicevoxConfig?: {
        speaker?: string
        SPEED_SCALE?: number
        PITCH_SCALE?: number
        INTONATION_SCALE?: number
        VOLUME_SCALE?: number
    }
    naittsConfig?: {
        customvoice?: boolean
        voice?: string
        version?: string
    }
    gptSoVitsConfig?: {
        url?: string
        use_auto_path?: boolean
        ref_audio_path?: string
        use_long_audio?: boolean
        ref_audio_data?: {
            fileName: string
            assetId: string
        }
        volume?: number
        text_lang?: "auto" | "auto_yue" | "en" | "zh" | "ja" | "yue" | "ko" | "all_zh" | "all_ja" | "all_yue" | "all_ko"
        text?: string
        use_prompt?: boolean
        prompt?: string | null
        prompt_lang?: "auto" | "auto_yue" | "en" | "zh" | "ja" | "yue" | "ko" | "all_zh" | "all_ja" | "all_yue" | "all_ko"
        top_p?: number
        temperature?: number
        speed?: number
        top_k?: number
        text_split_method?: "cut0" | "cut1" | "cut2" | "cut3" | "cut4" | "cut5"
    }
    fishSpeechConfig?: {
        model?: {
            _id: string
            title: string
            description: string
        },
        chunk_length: number,
        normalize: boolean,
    }
    supaMemory?: boolean
    additionalAssets?: [string, string, string][]
    ttsReadOnlyQuoted?: boolean
    replaceGlobalNote: string
    backgroundHTML?: string
    reloadKeys?: number
    backgroundCSS?: string
    license?: string
    private?: boolean
    additionalText: string
    oaiVoice?: string
    virtualscript?: string
    scriptstate?: { [key: string]: string | number | boolean }
    depth_prompt?: { depth: number, prompt: string }
    extentions?: { [key: string]: any }
    largePortrait?: boolean
    lorePlus?: boolean
    inlayViewScreen?: boolean
    hfTTS?: {
        model: string
        language: string
    },
    vits?: OnnxModelFiles
    realmId?: string
    imported?: boolean
    trashTime?: number
    nickname?: string
    source?: string[]
    group_only_greetings?: string[]
    creation_date?: number
    modification_date?: number
    ccAssets?: Array<{
        type: string
        uri: string
        name: string
        ext: string
    }>
    defaultVariables?: string
    lowLevelAccess?: boolean
    hideChatIcon?: boolean
    lastInteraction?: number
    translatorNote?: string
    doNotChangeSeperateModels?: boolean
    escapeOutput?: boolean
    prebuiltAssetCommand?: boolean
    prebuiltAssetStyle?: string
    prebuiltAssetExclude?: string[]
    modules?: string[]
}

export interface groupChat {
    type: 'group'
    image?: string
    firstMessage: string
    chats: Chat[]
    chatFolders: ChatFolder[]
    chatPage: number
    name: string
    viewScreen: 'single' | 'multiple' | 'none' | 'emp',
    characters: string[]
    characterTalks: number[]
    characterActive: boolean[]
    globalLore: loreBook[]
    autoMode: boolean
    useCharacterLore: boolean
    emotionImages: [string, string][]
    customscript: customscript[],
    chaId: string
    alternateGreetings?: string[]
    creatorNotes?: string,
    removedQuotes?: boolean
    firstMsgIndex?: number,
    loreSettings?: loreSettings
    supaMemory?: boolean
    ttsMode?: string
    suggestMessages?: string[]
    orderByOrder?: boolean
    backgroundHTML?: string,
    reloadKeys?: number
    backgroundCSS?: string
    oneAtTime?: boolean
    virtualscript?: string
    lorePlus?: boolean
    trashTime?: number
    nickname?: string
    defaultVariables?: string
    lowLevelAccess?: boolean
    hideChatIcon?: boolean
    lastInteraction?: number

    //lazy hack for typechecking
    voicevoxConfig?: any
    ttsSpeech?: string
    naittsConfig?: any
    oaiVoice?: string
    hfTTS?: any
    vits?: OnnxModelFiles
    gptSoVitsConfig?: any
    fishSpeechConfig?: any
    ttsReadOnlyQuoted?: boolean
    exampleMessage?: string
    systemPrompt?: string
    replaceGlobalNote?: string
    additionalText?: string
    personality?: string
    scenario?: string
    translatorNote?: string
    additionalData?: any
    depth_prompt?: { depth: number, prompt: string }
    additionalAssets?: [string, string, string][]
    utilityBot?: boolean
    license?: string
    realmId: string
    prebuiltAssetCommand?: boolean
    prebuiltAssetStyle?: string
    prebuiltAssetExclude?: string[]
    modules?: string[]
}

export interface Chat {
    message: Message[]
    note: string
    name: string
    localLore: loreBook[]
    sdData?: string
    supaMemoryData?: string
    hypaV2Data?: SerializableHypaV2Data
    lastMemory?: string
    suggestMessages?: string[]
    isStreaming?: boolean
    scriptstate?: { [key: string]: string | number | boolean }
    modules?: string[]
    id?: string
    bindedPersona?: string
    fmIndex?: number
    hypaV3Data?: SerializableHypaV3Data
    folderId?: string
    lastDate?: number
    bookmarks?: string[];
    bookmarkNames?: { [chatId: string]: string };
}

export interface ChatFolder {
    id: string
    name?: string
    color?: string
    folded: boolean
}

export interface Message {
    role: 'user' | 'char'
    data: string
    saying?: string
    chatId?: string
    time?: number
    generationInfo?: MessageGenerationInfo
    promptInfo?: MessagePresetInfo
    name?: string
    otherUser?: boolean
    disabled?: false | true | 'allBefore'
    isComment?: boolean
}

export interface MessageGenerationInfo {
    model?: string
    generationId?: string
    inputTokens?: number
    outputTokens?: number
    maxContext?: number
    stageTiming?: {
        stage1?: number
        stage2?: number
        stage3?: number
        stage4?: number
    }
}

export interface MessagePresetInfo {
    promptName?: string,
    promptToggles?: { key: string, value: string }[],
    promptText?: OpenAIChat[],
}

export interface PromptDiffPrefs {
    diffStyle: 'line' | 'intraline'
    formatStyle: 'raw' | 'card'
    viewStyle: 'unified' | 'split'
    isGrouped: boolean
    showOnlyChanges: boolean
    contextRadius: number
}

export interface botPreset {
    name?: string
    apiType?: string
    openAIKey?: string
    mainPrompt: string
    jailbreak: string
    globalNote: string
    temperature: number
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    formatingOrder: FormatingOrderItem[]
    aiModel?: string
    subModel?: string
    currentPluginProvider?: string
    textgenWebUIStreamURL?: string
    textgenWebUIBlockingURL?: string
    forceReplaceUrl?: string
    forceReplaceUrl2?: string
    promptPreprocess: boolean,
    bias: [string, number][]
    proxyRequestModel?: string
    openrouterRequestModel?: string
    proxyKey?: string
    ooba: OobaSettings
    ainconfig: AINsettings
    koboldURL?: string
    NAISettings?: NAISettings
    autoSuggestPrompt?: string
    autoSuggestPrefix?: string
    autoSuggestClean?: boolean
    promptTemplate?: PromptItem[]
    NAIadventure?: boolean
    NAIappendName?: boolean
    localStopStrings?: string[]
    customProxyRequestModel?: string
    reverseProxyOobaArgs?: OobaChatCompletionRequestParams
    top_p?: number
    promptSettings?: PromptSettings
    repetition_penalty?: number
    min_p?: number
    top_a?: number
    openrouterProvider?: {
        order: string[]
        only: string[]
        ignore: string[]
    }
    useInstructPrompt?: boolean
    customPromptTemplateToggle?: string
    templateDefaultVariables?: string
    moduleIntergration?: string
    top_k?: number
    instructChatTemplate?: string
    JinjaTemplate?: string
    jsonSchemaEnabled?: boolean
    jsonSchema?: string
    strictJsonSchema?: boolean
    extractJson?: string
    groupTemplate?: string
    groupOtherBotRole?: string
    seperateParametersEnabled?: boolean
    seperateParameters?: {
        memory: SeparateParameters,
        emotion: SeparateParameters,
        translate: SeparateParameters,
        otherAx: SeparateParameters
    }
    customAPIFormat?: LLMFormat
    systemContentReplacement?: string
    systemRoleReplacement?: 'user' | 'assistant'
    openAIPrediction?: string
    enableCustomFlags?: boolean
    customFlags?: LLMFlags[]
    image?: string
    regex?: customscript[]
    reasonEffort?: number
    thinkingTokens?: number
    outputImageModal?: boolean
    seperateModelsForAxModels?: boolean
    seperateModels?: {
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
    modelTools?: string[]
    fallbackModels?: {
        memory: string[],
        emotion: string[],
        translate: string[],
        otherAx: string[]
        model: string[]
    }
    fallbackWhenBlankResponse?: boolean
    verbosity?: number
    dynamicOutput?: DynamicOutput
}

export interface folder {
    name: string
    data: string[]
    color: string
    id: string
    imgFile?: string
    img?: string
}

export interface sdConfig {
    width: number
    height: number
    sampler_name: string
    script_name: string
    denoising_strength: number
    enable_hr: boolean
    hr_scale: number
    hr_upscaler: string
}

export interface NAIImgConfig {
    width: number,
    height: number,
    sampler: string,
    noise_schedule: string,
    steps: number,
    scale: number,
    cfg_rescale: number,
    sm: boolean,
    sm_dyn: boolean,
    noise: number,
    strength: number,
    image: string,
    base64image: string,
    InfoExtracted: number,
    autoSmea: boolean,
    use_coords: boolean,
    legacy_uc: boolean,
    v4_prompt: NAIImgConfigV4Prompt,
    v4_negative_prompt: NAIImgConfigV4NegativePrompt,
    reference_image_multiple?: string[],
    reference_strength_multiple?: number[],
    vibe_data?: NAIVibeData,
    vibe_model_selection?: string
    variety_plus: boolean,
    decrisp: boolean,
    reference_mode: string,
    character_image: string,
    character_base64image: string,
    style_aware: boolean,
}

interface NAIImgConfigV4Prompt {
    caption: NAIImgConfigV4Caption,
    use_coords: boolean,
    use_order: boolean
}

interface NAIImgConfigV4NegativePrompt {
    caption: NAIImgConfigV4Caption,
    legacy_uc: boolean
}

interface NAIImgConfigV4Caption {
    base_caption: string,
    char_captions: NAIImgConfigV4CharCaption[]
}

interface NAIImgConfigV4CharCaption {
    char_caption: string,
    centers: {
        x: number,
        y: number
    }[]
}

interface NAIVibeData {
    identifier: string;
    version: number;
    type: string;
    image: string;
    id: string;
    encodings: {
        [key: string]: {
            [key: string]: NAIVibeEncoding;
        }
    };
    name: string;
    thumbnail: string;
    createdAt: number;
    importInfo: {
        model: string;
        information_extracted: number;
        strength: number;
    };
}

interface NAIVibeEncoding {
    encoding: string;
    params: {
        information_extracted: number;
    };
}

export interface ComfyConfig {
    workflow: string,
    posNodeID: string,
    posInputName: string,
    negNodeID: string,
    negInputName: string,
    timeout: number
}

export type FormatingOrderItem = 'main' | 'jailbreak' | 'chats' | 'lorebook' | 'globalNote' | 'authorNote' | 'lastChat' | 'description' | 'postEverything' | 'personaPrompt'

export interface AINsettings {
    top_p: number,
    rep_pen: number,
    top_a: number,
    rep_pen_slope: number,
    rep_pen_range: number,
    typical_p: number
    badwords: string
    stoptokens: string
    top_k: number
}

export interface OobaSettings {
    max_new_tokens: number,
    do_sample: boolean,
    temperature: number,
    top_p: number,
    typical_p: number,
    repetition_penalty: number,
    encoder_repetition_penalty: number,
    top_k: number,
    min_length: number,
    no_repeat_ngram_size: number,
    num_beams: number,
    penalty_alpha: number,
    length_penalty: number,
    early_stopping: boolean,
    seed: number,
    add_bos_token: boolean,
    truncation_length: number,
    ban_eos_token: boolean,
    skip_special_tokens: boolean,
    top_a: number,
    tfs: number,
    epsilon_cutoff: number,
    eta_cutoff: number,
    formating: {
        header: string,
        systemPrefix: string,
        userPrefix: string,
        assistantPrefix: string
        seperator: string
        useName: boolean
    }
}

export interface SeparateParameters {
    temperature?: number
    top_k?: number
    repetition_penalty?: number
    min_p?: number
    top_a?: number
    top_p?: number
    frequency_penalty?: number
    presence_penalty?: number
    reasoning_effort?: number
    thinking_tokens?: number
    outputImageModal?: boolean
    verbosity?: number
}

export interface hordeConfig {
    apiKey: string
    model: string
    softPrompt: string
}

/**
 * 안전한 구조화된 클론 함수
 */
function safeStructuredClone<T>(obj: T): T {
    if (typeof structuredClone !== 'undefined') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}

export interface getDatabaseOptions {
    snapshot?: boolean
}

// Database 인터페이스는 원본 파일에서 import합니다.
// 서버 사이드에서는 DatabaseAdapter를 통해 접근하므로 직접 사용하지 않습니다.
export type { Database } from '../../ts/storage/database.svelte';
