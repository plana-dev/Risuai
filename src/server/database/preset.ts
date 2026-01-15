/**
 * Preset 관련 함수들
 * 
 * 원본: src/ts/storage/database.svelte.ts
 * 서버 사이드에서는 데이터베이스 어댑터를 통해 동작합니다.
 */

import type { Database, botPreset } from './types';
import { getDatabase, setDatabase } from './access';
import { LLMFormat } from '../model/types';
import { prebuiltPresets } from './defaults';
import { presetTemplate } from './defaults';

/**
 * 안전한 구조화된 클론 함수
 */
function safeStructuredClone<T>(obj: T): T {
    if (typeof structuredClone !== 'undefined') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}

/**
 * 현재 Preset을 저장합니다.
 * 
 * @param userId - 사용자 ID
 * @returns 저장된 Preset
 */
export async function saveCurrentPreset(userId: string): Promise<botPreset> {
    const db = await getDatabase(userId);
    let pres = db.botPresets;
    const savedPreset: botPreset = {
        name: pres[db.botPresetsId].name,
        apiType: db.apiType,
        openAIKey: db.openAIKey,
        mainPrompt: db.mainPrompt,
        jailbreak: db.jailbreak,
        globalNote: db.globalNote,
        temperature: db.temperature,
        maxContext: db.maxContext,
        maxResponse: db.maxResponse,
        frequencyPenalty: db.frequencyPenalty,
        PresensePenalty: db.PresensePenalty,
        formatingOrder: db.formatingOrder,
        aiModel: db.aiModel,
        subModel: db.subModel,
        currentPluginProvider: db.currentPluginProvider,
        textgenWebUIStreamURL: db.textgenWebUIStreamURL,
        textgenWebUIBlockingURL: db.textgenWebUIBlockingURL,
        forceReplaceUrl: db.forceReplaceUrl,
        forceReplaceUrl2: db.forceReplaceUrl2,
        promptPreprocess: db.promptPreprocess,
        bias: db.bias,
        koboldURL: db.koboldURL,
        proxyKey: db.proxyKey,
        ooba: safeStructuredClone(db.ooba),
        ainconfig: safeStructuredClone(db.ainconfig),
        proxyRequestModel: db.proxyRequestModel,
        openrouterRequestModel: db.openrouterRequestModel,
        NAISettings: safeStructuredClone(db.NAIsettings),
        promptTemplate: db.promptTemplate ?? null,
        NAIadventure: db.NAIadventure ?? false,
        NAIappendName: db.NAIappendName ?? false,
        localStopStrings: db.localStopStrings,
        autoSuggestPrompt: db.autoSuggestPrompt,
        customProxyRequestModel: db.customProxyRequestModel,
        reverseProxyOobaArgs: safeStructuredClone(db.reverseProxyOobaArgs) ?? null,
        top_p: db.top_p ?? 1,
        promptSettings: safeStructuredClone(db.promptSettings) ?? null,
        repetition_penalty: db.repetition_penalty,
        min_p: db.min_p,
        top_a: db.top_a,
        openrouterProvider: db.openrouterProvider,
        useInstructPrompt: db.useInstructPrompt,
        customPromptTemplateToggle: db.customPromptTemplateToggle ?? "",
        templateDefaultVariables: db.templateDefaultVariables ?? "",
        moduleIntergration: db.moduleIntergration ?? "",
        top_k: db.top_k,
        instructChatTemplate: db.instructChatTemplate,
        JinjaTemplate: db.JinjaTemplate ?? '',
        jsonSchemaEnabled: db.jsonSchemaEnabled ?? false,
        jsonSchema: db.jsonSchema ?? '',
        strictJsonSchema: db.strictJsonSchema ?? true,
        extractJson: db.extractJson ?? '',
        groupOtherBotRole: db.groupOtherBotRole ?? 'user',
        groupTemplate: db.groupTemplate ?? '',
        seperateParametersEnabled: db.seperateParametersEnabled ?? false,
        seperateParameters: safeStructuredClone(db.seperateParameters),
        openAIPrediction: db.OAIPrediction,
        customAPIFormat: safeStructuredClone(db.customAPIFormat),
        systemContentReplacement: db.systemContentReplacement,
        systemRoleReplacement: db.systemRoleReplacement,
        customFlags: safeStructuredClone(db.customFlags),
        enableCustomFlags: db.enableCustomFlags,
        regex: db.presetRegex,
        image: pres?.[db.botPresetsId]?.image ?? '',
        reasonEffort: db.reasoningEffort ?? 0,
        thinkingTokens: db.thinkingTokens ?? null,
        outputImageModal: db.outputImageModal ?? false,
        seperateModelsForAxModels: db.doNotChangeSeperateModels ? false : db.seperateModelsForAxModels ?? false,
        seperateModels: db.doNotChangeSeperateModels ? null : safeStructuredClone(db.seperateModels),
        modelTools: safeStructuredClone(db.modelTools),
        fallbackModels: safeStructuredClone(db.fallbackModels),
        fallbackWhenBlankResponse: db.fallbackWhenBlankResponse ?? false,
        verbosity: db.verbosity ?? 1,
        dynamicOutput: db.dynamicOutput ?? null
    }

    if (!Array.isArray(pres)) {
        pres = []
    }
    //if out of bounds, create a new preset
    if (db.botPresetsId >= pres.length) {
        pres.push(savedPreset)
    }
    else {
        pres[db.botPresetsId] = savedPreset
    }
    db.botPresets = pres
    await setDatabase(userId, db)

    return savedPreset
}

/**
 * Preset을 복사합니다.
 * 
 * @param userId - 사용자 ID
 * @param id - 복사할 Preset ID
 */
export async function copyPreset(userId: string, id: number): Promise<void> {
    await saveCurrentPreset(userId)
    const db = await getDatabase(userId)
    let pres = db.botPresets
    const newPres = safeStructuredClone(pres[id])
    newPres.name += " Copy"
    db.botPresets.push(newPres)
    await setDatabase(userId, db)
}

/**
 * Preset으로 변경합니다.
 * 
 * @param userId - 사용자 ID
 * @param id - 변경할 Preset ID
 * @param savecurrent - 현재 설정을 저장할지 여부
 */
export async function changeToPreset(
    userId: string,
    id: number = 0,
    savecurrent: boolean = true
): Promise<void> {
    if (savecurrent) {
        await saveCurrentPreset(userId)
    }
    const db = await getDatabase(userId)
    let pres = db.botPresets
    const newPres = pres[id]
    db.botPresetsId = id
    const updatedDb = setPreset(db, newPres)
    await setDatabase(userId, updatedDb)
}

/**
 * 데이터베이스에 Preset 설정을 적용합니다.
 * 
 * @param db - 데이터베이스 객체
 * @param newPres - 적용할 Preset
 * @returns 업데이트된 데이터베이스 객체
 */
export function setPreset(db: Database, newPres: botPreset): Database {
    db.apiType = newPres.apiType ?? db.apiType
    db.mainPrompt = newPres.mainPrompt ?? db.mainPrompt
    db.jailbreak = newPres.jailbreak ?? db.jailbreak
    db.globalNote = newPres.globalNote ?? db.globalNote
    db.temperature = newPres.temperature ?? db.temperature
    db.maxContext = newPres.maxContext ?? db.maxContext
    db.maxResponse = newPres.maxResponse ?? db.maxResponse
    db.frequencyPenalty = newPres.frequencyPenalty ?? db.frequencyPenalty
    db.PresensePenalty = newPres.PresensePenalty ?? db.PresensePenalty
    db.formatingOrder = newPres.formatingOrder ?? db.formatingOrder
    db.aiModel = newPres.aiModel ?? db.aiModel
    db.subModel = newPres.subModel ?? db.subModel
    db.currentPluginProvider = newPres.currentPluginProvider ?? db.currentPluginProvider
    db.textgenWebUIStreamURL = newPres.textgenWebUIStreamURL ?? db.textgenWebUIStreamURL
    db.textgenWebUIBlockingURL = newPres.textgenWebUIBlockingURL ?? db.textgenWebUIBlockingURL
    db.forceReplaceUrl = newPres.forceReplaceUrl ?? db.forceReplaceUrl
    db.promptPreprocess = newPres.promptPreprocess ?? db.promptPreprocess
    db.forceReplaceUrl2 = newPres.forceReplaceUrl2 ?? db.forceReplaceUrl2
    db.bias = newPres.bias ?? db.bias
    db.koboldURL = newPres.koboldURL ?? db.koboldURL
    db.proxyKey = newPres.proxyKey ?? db.proxyKey
    db.ooba = safeStructuredClone(newPres.ooba ?? db.ooba)
    db.ainconfig = safeStructuredClone(newPres.ainconfig ?? db.ainconfig)
    db.openrouterRequestModel = newPres.openrouterRequestModel ?? db.openrouterRequestModel
    db.proxyRequestModel = newPres.proxyRequestModel ?? db.proxyRequestModel
    db.NAIsettings = newPres.NAISettings ?? db.NAIsettings
    db.autoSuggestPrompt = newPres.autoSuggestPrompt ?? db.autoSuggestPrompt
    db.autoSuggestPrefix = newPres.autoSuggestPrefix ?? db.autoSuggestPrefix
    db.autoSuggestClean = newPres.autoSuggestClean ?? db.autoSuggestClean
    db.promptTemplate = newPres.promptTemplate
    db.NAIadventure = newPres.NAIadventure
    db.NAIappendName = newPres.NAIappendName
    db.NAIsettings.cfg_scale ??= 1
    db.NAIsettings.mirostat_tau ??= 0
    db.NAIsettings.mirostat_lr ??= 1
    db.localStopStrings = newPres.localStopStrings
    db.customProxyRequestModel = newPres.customProxyRequestModel ?? ''
    db.reverseProxyOobaArgs = safeStructuredClone(newPres.reverseProxyOobaArgs) ?? {
        mode: 'instruct'
    }
    db.top_p = newPres.top_p ?? 1
    db.promptSettings = safeStructuredClone(newPres.promptSettings) ?? {
        assistantPrefill: '',
        postEndInnerFormat: '',
        sendChatAsSystem: false,
        sendName: false,
        utilOverride: false,
    }
    db.promptSettings.maxThoughtTagDepth ??= -1
    db.repetition_penalty = newPres.repetition_penalty
    db.min_p = newPres.min_p
    db.top_a = newPres.top_a
    db.openrouterProvider = newPres.openrouterProvider
    db.useInstructPrompt = newPres.useInstructPrompt ?? false
    db.customPromptTemplateToggle = newPres.customPromptTemplateToggle ?? ''
    db.templateDefaultVariables = newPres.templateDefaultVariables ?? ''
    db.moduleIntergration = newPres.moduleIntergration ?? ''
    db.top_k = newPres.top_k ?? db.top_k
    db.instructChatTemplate = newPres.instructChatTemplate ?? db.instructChatTemplate
    db.JinjaTemplate = newPres.JinjaTemplate ?? db.JinjaTemplate
    db.jsonSchemaEnabled = newPres.jsonSchemaEnabled ?? false
    db.jsonSchema = newPres.jsonSchema ?? ''
    db.strictJsonSchema = newPres.strictJsonSchema ?? true
    db.extractJson = newPres.extractJson ?? ''
    db.groupOtherBotRole = newPres.groupOtherBotRole ?? 'user'
    db.groupTemplate = newPres.groupTemplate ?? ''
    db.seperateParametersEnabled = newPres.seperateParametersEnabled ?? false
    db.seperateParameters = newPres.seperateParameters ? safeStructuredClone(newPres.seperateParameters) : {
        memory: {},
        emotion: {},
        translate: {},
        otherAx: {}
    }
    db.OAIPrediction = newPres.openAIPrediction ?? ''
    db.customAPIFormat = safeStructuredClone(newPres.customAPIFormat) ?? LLMFormat.OpenAICompatible
    db.systemContentReplacement = newPres.systemContentReplacement ?? ''
    db.systemRoleReplacement = newPres.systemRoleReplacement ?? 'user'
    db.customFlags = safeStructuredClone(newPres.customFlags) ?? []
    db.enableCustomFlags = newPres.enableCustomFlags ?? false
    db.presetRegex = newPres.regex ?? []
    db.reasoningEffort = newPres.reasonEffort ?? 0
    db.thinkingTokens = newPres.thinkingTokens ?? null
    db.outputImageModal = newPres.outputImageModal ?? false
    if (!db.doNotChangeSeperateModels) {
        db.seperateModelsForAxModels = newPres.seperateModelsForAxModels ?? false
        db.seperateModels = safeStructuredClone(newPres.seperateModels) ?? {
            memory: '',
            emotion: '',
            translate: '',
            otherAx: ''
        }
    }
    if (!db.doNotChangeFallbackModels) {
        db.fallbackModels = safeStructuredClone(newPres.fallbackModels) ?? {
            memory: [],
            emotion: [],
            translate: [],
            otherAx: [],
            model: []
        }
        db.fallbackWhenBlankResponse = newPres.fallbackWhenBlankResponse ?? false
    }
    db.modelTools = safeStructuredClone(newPres.modelTools ?? [])
    db.verbosity = newPres.verbosity ?? 1
    db.dynamicOutput = newPres.dynamicOutput

    return db
}

/**
 * Preset을 JSON 형식으로 익스포트합니다.
 * 
 * 서버 사이드에서는 데이터만 반환합니다.
 * 
 * @param userId - 사용자 ID
 * @param id - 익스포트할 Preset ID
 * @returns Preset 데이터와 버퍼 (risupreset 형식의 경우)
 */
export async function exportPreset(
    userId: string,
    id: number
): Promise<{ data: botPreset, buffer?: Uint8Array }> {
    await saveCurrentPreset(userId)
    const db = await getDatabase(userId)
    let pres = safeStructuredClone(db.botPresets[id])
    
    // 민감한 정보 제거
    pres.openAIKey = ''
    pres.forceReplaceUrl = ''
    pres.forceReplaceUrl2 = ''
    pres.proxyKey = ''
    pres.textgenWebUIStreamURL = ''
    pres.textgenWebUIBlockingURL = ''

    return {
        data: pres,
        buffer: undefined // 서버 사이드에서는 버퍼 생성은 필요시 별도로 처리
    }
}

/**
 * Preset을 임포트합니다.
 * 
 * @param userId - 사용자 ID
 * @param presetData - 임포트할 Preset 데이터 (JSON 또는 파싱된 객체)
 * @returns 임포트된 Preset
 */
export async function importPreset(
    userId: string,
    presetData: any
): Promise<botPreset> {
    let pre: any

    // risupreset 형식 처리 (TODO: 서버 사이드에서 msgpackr, fflate, rpack 처리 필요)
    if (presetData.presetVersion && presetData.presetVersion >= 3) {
        //NAI preset
        const pr = safeStructuredClone(prebuiltPresets.NAI2)
        pr.temperature = presetData.parameters.temperature * 100
        pr.maxResponse = presetData.parameters.max_length
        pr.NAISettings.topK = presetData.parameters.top_k
        pr.NAISettings.topP = presetData.parameters.top_p
        pr.NAISettings.topA = presetData.parameters.top_a
        pr.NAISettings.typicalp = presetData.parameters.typical_p
        pr.NAISettings.tailFreeSampling = presetData.parameters.tail_free_sampling
        pr.NAISettings.repetitionPenalty = presetData.parameters.repetition_penalty
        pr.NAISettings.repetitionPenaltyRange = presetData.parameters.repetition_penalty_range
        pr.NAISettings.repetitionPenaltySlope = presetData.parameters.repetition_penalty_slope
        pr.NAISettings.frequencyPenalty = presetData.parameters.repetition_penalty_frequency
        pr.NAISettings.repostitionPenaltyPresence = presetData.parameters.repetition_penalty_presence
        pr.PresensePenalty = presetData.parameters.repetition_penalty_presence * 100
        pr.NAISettings.cfg_scale = presetData.parameters.cfg_scale
        pr.NAISettings.mirostat_lr = presetData.parameters.mirostat_lr
        pr.NAISettings.mirostat_tau = presetData.parameters.mirostat_tau
        pr.name = presetData.name ?? "Imported"
        
        const db = await getDatabase(userId)
        db.botPresets.push(pr)
        await setDatabase(userId, db)
        return pr
    }

    // ST preset 형식 처리
    if (Array.isArray(presetData?.prompt_order?.[0]?.order) && Array.isArray(presetData?.prompts)) {
        const pr = safeStructuredClone(presetTemplate)
        pr.promptTemplate = []

        function findPrompt(identifier: number) {
            return presetData.prompts.find((p: any) => p.identifier === identifier)
        }
        pr.temperature = (presetData.temperature ?? 0.8) * 100
        pr.frequencyPenalty = (presetData.frequency_penalty ?? 0.7) * 100
        pr.PresensePenalty = (presetData.presence_penalty * 0.7) * 100
        pr.top_p = presetData.top_p ?? 1

        for (const prompt of presetData.prompt_order[0].order) {
            if (!prompt?.enabled) {
                continue
            }
            const p = findPrompt(prompt?.identifier ?? '')
            if (p) {
                switch (p.identifier) {
                    case 'main': {
                        pr.promptTemplate.push({
                            type: 'plain',
                            type2: 'main',
                            text: p.content ?? "",
                            role: p.role ?? "system"
                        })
                        break
                    }
                    case 'jailbreak':
                    case 'nsfw': {
                        pr.promptTemplate.push({
                            type: 'jailbreak',
                            type2: 'normal',
                            text: p.content ?? "",
                            role: p.role ?? "system"
                        })
                        break
                    }
                    case 'dialogueExamples':
                    case 'charPersonality':
                    case 'scenario': {
                        break //ignore
                    }
                    case 'chatHistory': {
                        pr.promptTemplate.push({
                            type: 'chat',
                            rangeEnd: 'end',
                            rangeStart: 0
                        })
                        break
                    }
                    case 'worldInfoBefore': {
                        pr.promptTemplate.push({
                            type: 'lorebook'
                        })
                        break
                    }
                    case 'worldInfoAfter': {
                        break
                    }
                    case 'charDescription': {
                        pr.promptTemplate.push({
                            type: 'description'
                        })
                        break
                    }
                    case 'personaDescription': {
                        pr.promptTemplate.push({
                            type: 'persona'
                        })
                        break
                    }
                    default: {
                        pr.promptTemplate.push({
                            type: 'plain',
                            type2: 'normal',
                            text: p.content ?? "",
                            role: p.role ?? "system"
                        })
                    }
                }
            }
        }
        if (presetData?.assistant_prefill) {
            pr.promptTemplate.push({
                type: 'postEverything'
            })
            pr.promptTemplate.push({
                type: 'plain',
                type2: 'main',
                text: `{{#if {{prefill_supported}}}}${presetData?.assistant_prefill}{{/if}}`,
                role: 'bot'
            })
        }
        pr.name = "Imported ST Preset"
        
        const db = await getDatabase(userId)
        db.botPresets.push(pr)
        await setDatabase(userId, db)
        return pr
    }

    // 일반 Preset 형식
    pre = { ...presetTemplate, ...presetData }
    pre.name ??= "Imported"
    
    const db = await getDatabase(userId)
    if (!Array.isArray(db.botPresets)) {
        db.botPresets = []
    }
    db.botPresets.push(pre)
    await setDatabase(userId, db)
    
    return pre
}
