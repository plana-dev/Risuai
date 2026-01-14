/**
 * 캐릭터 관련 유틸리티 함수들
 */

import type { character, groupChat, loreBook, loreSettings } from '../database';
import type { CharacterBook, charBookEntry } from './types';
import { checkNullish } from '../util';
import { defaultSdDataFunc } from '../database';

export interface ConvertCharbookArg {
    lorebook: loreBook[]
    charbook: CharacterBook
    loresettings: loreSettings
    loreExt: any
}

export interface ConvertCharbookResult {
    lorebook: loreBook[]
    loresettings: loreSettings
    loreExt: any
}

export function convertCharbook(arg: ConvertCharbookArg): ConvertCharbookResult {
    let { lorebook, loresettings, loreExt, charbook } = arg
    if ((!checkNullish(charbook.recursive_scanning)) &&
        (!checkNullish(charbook.scan_depth)) &&
        (!checkNullish(charbook.token_budget))) {
        loresettings = {
            tokenBudget: charbook.token_budget,
            scanDepth: charbook.scan_depth,
            recursiveScanning: charbook.recursive_scanning,
            fullWordMatching: charbook?.extensions?.risu_fullWordMatching ?? false,
        }
    }

    loreExt = charbook.extensions

    for (const book of charbook.entries) {
        let content = book.content

        if (book.use_regex && !book.keys?.[0]?.startsWith('/')) {
            book.use_regex = false
        }

        //extention migration
        const extensions = book.extensions ?? {}

        if (extensions.useProbability && extensions.probability !== undefined && extensions.probability !== 100) {
            content = `@@probability ${extensions.probability}\n` + content
            delete extensions.useProbability
            delete extensions.probability
        }
        if (extensions.position === 4 && typeof extensions.depth === 'number' && typeof (extensions.role) === 'number') {
            content = `@@depth ${extensions.depth}\n@@role ${['system', 'user', 'assistant'][extensions.role]}\n` + content
            delete extensions.position
            delete extensions.depth
            delete extensions.role
        }
        if (typeof (extensions.selectiveLogic) === 'number' && book.secondary_keys && book.secondary_keys.length > 0) {
            switch (extensions.selectiveLogic) {
                case 0: {
                    if (!book.secondary_keys || book.secondary_keys.length === 0) {
                        book.selective = false
                    }
                    break
                }
                case 1: {
                    book.selective = false
                    content = `@@exclude_keys_all ${book.secondary_keys.join(',')}\n` + content
                    break
                }
                case 2: {
                    book.selective = false
                    for (const secKey of book.secondary_keys) {
                        content = `@@exclude_keys ${secKey}\n` + content
                    }
                    break
                }
                case 3: {
                    book.selective = false
                    for (const secKey of book.secondary_keys) {
                        content = `@@additional_keys ${secKey}\n` + content
                    }
                    break
                }
            }
        }
        if (typeof extensions.delay === 'number' && extensions.delay > 0) {
            content = `@@activate_only_after ${extensions.delay}\n` + content
            delete extensions.delay
        }
        if (extensions.match_whole_words === true) {
            content = `@@match_full_word\n` + content
            delete extensions.match_whole_words
        }
        if (extensions.match_whole_words === false) {
            content = `@@match_partial_word\n` + content
            delete extensions.match_whole_words
        }

        lorebook.push({
            key: book.keys.join(', '),
            secondkey: book.secondary_keys?.join(', ') ?? '',
            insertorder: book.insertion_order,
            comment: book.name ?? book.comment ?? "",
            content: content,
            mode: (book.mode as any) ?? "normal",
            alwaysActive: book.constant ?? false,
            selective: book.selective ?? false,
            extentions: { ...extensions, risu_case_sensitive: book.case_sensitive },
            activationPercent: book.extensions?.risu_activationPercent,
            loreCache: book.extensions?.risu_loreCache ?? null,
            useRegex: book.use_regex ?? false,
            folder: book.folder
        })
    }

    return {
        lorebook,
        loresettings,
        loreExt
    }
}

export function updateLorebooks(book: loreBook[]): loreBook[] {
    return book.map((v) => {
        v.bookVersion ??= 1
        if (v.bookVersion >= 2) {
            return v
        }
        if (v.activationPercent) {
            const perc = v.activationPercent
            v.activationPercent = null

            v.content = `@@probability ${perc}\n${v.content}`
        }
        v.content = v.content.replace(/@@@?end/g, '@@depth 0').replace(/\<(char|bot)\>/g, '{{char}}').replace(/\<(user)\>/g, '{{user}}')
        v.bookVersion = 2
        return v
    })
}

export function isCharacterHasAssets(char: character | groupChat): boolean {
    if (char.type === 'group') {
        return false
    }

    if (char.additionalAssets && char.additionalAssets.length > 0) {
        return true
    }

    if (char.emotionImages && char.emotionImages.length > 0) {
        return true
    }

    if (char.ccAssets && char.ccAssets.length > 0) {
        return true
    }

    return false
}

/**
 * 오프스펙 캐릭터 카드를 character 타입으로 변환합니다.
 */
export function convertOffSpecCards(
    charaData: any, // OldTavernChar | CharacterCardV2Risu
    imgp: string | undefined = undefined
): character {
    const { v4: uuidv4 } = require('uuid');
    const { convertCharbook } = require('./utils');
    
    const data = charaData.spec_version === '2.0' ? charaData.data : charaData
    const charbook = charaData.spec_version === '2.0' ? charaData.data.character_book : null
    let lorebook: loreBook[] = []
    let loresettings: undefined | loreSettings = undefined
    let loreExt: undefined | any = undefined
    if (charbook) {
        const a = convertCharbook({
            lorebook,
            charbook,
            loresettings,
            loreExt
        })

        lorebook = a.lorebook
        loresettings = a.loresettings
        loreExt = a.loreExt
    }

    return {
        name: data.name ?? 'unknown name',
        firstMessage: data.first_mes ?? 'unknown first message',
        desc: data.description ?? '',
        notes: '',
        chats: [{
            message: [],
            note: '',
            name: 'Chat 1',
            localLore: []
        }],
        chatPage: 0,
        image: imgp,
        emotionImages: [],
        bias: [],
        globalLore: lorebook,
        viewScreen: 'none',
        chaId: uuidv4(),
        sdData: defaultSdDataFunc(),
        utilityBot: false,
        customscript: [],
        exampleMessage: data.mes_example,
        creatorNotes: '',
        systemPrompt: (charaData.spec_version === '2.0' ? charaData.data.system_prompt : '') ?? '',
        postHistoryInstructions: (charaData.spec_version === '2.0' ? charaData.data.post_history_instructions : '') ?? '',
        alternateGreetings: [],
        tags: [],
        creator: "",
        characterVersion: '',
        personality: data.personality ?? '',
        scenario: data.scenario ?? '',
        firstMsgIndex: -1,
        replaceGlobalNote: "",
        triggerscript: [],
        additionalText: '',
        loreExt: loreExt,
        loreSettings: loresettings,
        chatFolders: []
    }
}
