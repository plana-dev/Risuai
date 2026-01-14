/**
 * 캐릭터 생성 및 기본 관리 함수들
 */

import { v4 as uuidv4 } from 'uuid';
import type { character } from '../database';
import { defaultSdDataFunc } from '../database';
import { checkNullish } from '../../ts/util';
import { updateLorebooks } from './utils';

/**
 * 빈 캐릭터를 생성합니다.
 */
export function createBlankChar(): character {
    return {
        name: '',
        firstMessage: '',
        desc: '',
        notes: '',
        chats: [{
            message: [],
            note: '',
            name: 'Chat 1',
            localLore: []
        }],
        chatFolders: [],
        chatPage: 0,
        emotionImages: [],
        bias: [],
        viewScreen: 'none',
        globalLore: [],
        chaId: uuidv4(),
        type: 'character',
        sdData: defaultSdDataFunc(),
        utilityBot: false,
        customscript: [],
        exampleMessage: '',
        creatorNotes: '',
        systemPrompt: '',
        postHistoryInstructions: '',
        alternateGreetings: [],
        tags: [],
        creator: "",
        characterVersion: '',
        personality: "",
        scenario: "",
        firstMsgIndex: -1,
        replaceGlobalNote: "",
        triggerscript: [{
            comment: "",
            type: "manual",
            conditions: [],
            effect: [{
                type: "v2Header",
                code: "",
                indent: 0
            }]
        }, {
            comment: "New Event",
            type: 'manual',
            conditions: [],
            effect: []
        }],
        additionalText: ''
    }
}

/**
 * 캐릭터 포맷을 업데이트합니다.
 * 서버 사이드에서는 updateInlayScreen 의존성을 제거해야 합니다.
 */
export function characterFormatUpdate(
    cha: character,
    arg: {
        updateInteraction?: boolean,
    } = {}
): character {
    if (cha.chats.length === 0) {
        cha.chats = [{
            message: [],
            note: '',
            name: 'Chat 1',
            localLore: []
        }]
    }
    if (!cha.chats[cha.chatPage]) {
        cha.chatPage = 0
    }
    if (!cha.chats[cha.chatPage].message) {
        cha.chats[cha.chatPage].message = []
    }
    if (!cha.type) {
        cha.type = 'character'
    }
    if (!cha.chaId) {
        cha.chaId = uuidv4()
    }
    if (cha.type !== 'group') {
        if (checkNullish(cha.sdData)) {
            cha.sdData = defaultSdDataFunc()
        }
        if (checkNullish(cha.utilityBot)) {
            cha.utilityBot = false
        }
        cha.triggerscript = cha.triggerscript ?? []
        cha.alternateGreetings = cha.alternateGreetings ?? []
        cha.exampleMessage = cha.exampleMessage ?? ''
        cha.creatorNotes = cha.creatorNotes ?? ''
        cha.systemPrompt = cha.systemPrompt ?? ''
        cha.tags = cha.tags ?? []
        cha.creator = cha.creator ?? ''
        cha.characterVersion = cha.characterVersion ?? ''
        cha.personality = cha.personality ?? ''
        cha.scenario = cha.scenario ?? ''
        cha.firstMsgIndex = cha.firstMsgIndex ?? -1
        cha.additionalData = cha.additionalData ?? {
            tag: [],
            creator: '',
            character_version: ''
        }
        cha.voicevoxConfig = cha.voicevoxConfig ?? {
            SPEED_SCALE: 1,
            PITCH_SCALE: 0,
            INTONATION_SCALE: 1,
            VOLUME_SCALE: 1
        }
        if (cha.postHistoryInstructions) {
            cha.chats[cha.chatPage].note += "\n" + cha.postHistoryInstructions
            cha.chats[cha.chatPage].note = cha.chats[cha.chatPage].note.trim()
            cha.postHistoryInstructions = null
        }
        cha.additionalText ??= ''
        cha.depth_prompt ??= {
            depth: 0,
            prompt: ''
        }
        cha.hfTTS ??= {
            model: '',
            language: 'en'
        }
        cha.backgroundHTML ??= ''
        cha.backgroundCSS ??= ''
        cha.creation_date ??= Date.now()
        cha.globalLore = updateLorebooks(cha.globalLore)
        // TODO: updateInlayScreen 의존성 제거 필요
        // if(!cha.newGenData){
        //     cha = updateInlayScreen(cha)
        // }
        // Migrate legacy 'none' value to '' for UI dropdown compatibility
        if (cha.ttsMode === 'none') {
            cha.ttsMode = ''
        }
        cha.ttsMode ??= ''
    }
    else {
        if ((!cha.characterTalks) || cha.characterTalks.length !== cha.characters.length) {
            cha.characterTalks = []
            for (let i = 0; i < cha.characters.length; i++) {
                cha.characterTalks.push(1 / 6 * 4)
            }
        }
        if ((!cha.characterActive) || cha.characterActive.length !== cha.characters.length) {
            cha.characterActive = []
            for (let i = 0; i < cha.characters.length; i++) {
                cha.characterActive.push(true)
            }
        }
    }
    if (checkNullish(cha.customscript)) {
        cha.customscript = []
    }
    cha.lastInteraction = Date.now()
    for (let i = 0; i < cha.chats.length; i++) {
        const chat = cha.chats[i]
        chat.fmIndex ??= cha.firstMsgIndex ?? -1
        if (!chat.id) {
            chat.id = uuidv4()
        }
        if (!chat.localLore) {
            chat.localLore = []
        }
    }
    return cha
}

/**
 * 새 그룹 채팅을 생성합니다.
 */
export function createBlankGroup(): character {
    return {
        type: 'group',
        name: "",
        firstMessage: "",
        chats: [{
            message: [],
            note: '',
            name: 'Chat 1',
            localLore: []
        }],
        chatFolders: [],
        chatPage: 0,
        viewScreen: 'none',
        globalLore: [],
        characters: [],
        autoMode: false,
        useCharacterLore: true,
        emotionImages: [],
        customscript: [],
        chaId: uuidv4(),
        firstMsgIndex: -1,
        characterTalks: [],
        characterActive: [],
        realmId: ''
    }
}
