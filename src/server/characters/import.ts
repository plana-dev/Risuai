/**
 * 캐릭터 카드 임포트 관련 함수들
 * 
 * 주의: 이 파일은 서버 사이드에서 사용하기 위해 클라이언트 전용 기능(alert, UI 등)을 제거했습니다.
 * 실제 사용 시에는 적절한 에러 처리 및 로깅을 추가해야 합니다.
 */

import { v4 as uuidv4 } from 'uuid';
import type { character, loreBook, loreSettings, customscript, triggerscript } from '../database';
import { defaultSdDataFunc } from '../database';
import type { CharacterCardV2Risu, CharacterCardV3 } from './types';
import type { OnnxModelFiles } from './types';
import { convertCharbook } from './utils';
import type { ImportCharacterProcessArg } from './types';

/**
 * 안전한 구조화된 클론을 수행합니다.
 * 서버 사이드에서는 structuredClone 또는 JSON 기반 클론을 사용합니다.
 */
function safeStructuredClone<T>(obj: T): T {
    if (typeof structuredClone !== 'undefined') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}

/**
 * 캐릭터 카드 스펙을 임포트합니다.
 * 
 * @param card - 임포트할 캐릭터 카드 (V2 또는 V3)
 * @param img - 이미지 데이터 (선택사항)
 * @param mode - 임포트 모드 ('hub' | 'normal')
 * @param assetDict - 에셋 딕셔너리
 * @param overrideLorebook - 오버라이드할 Lorebook (선택사항)
 * @param saveAssetFn - 에셋 저장 함수 (서버 사이드에서 주입)
 * @param getHubResourcesFn - Hub 리소스 가져오기 함수 (서버 사이드에서 주입)
 * @param getDatabaseFn - 데이터베이스 가져오기 함수
 * @param setDatabaseFn - 데이터베이스 설정 함수
 * @returns 성공 여부
 */
export async function importCharacterCardSpec(
    card: CharacterCardV2Risu | CharacterCardV3,
    img?: Uint8Array,
    mode: 'hub' | 'normal' = 'normal',
    assetDict: { [key: string]: string } = {},
    overrideLorebook: loreBook[] | null = null,
    saveAssetFn: (data: Uint8Array, customId?: string, fileName?: string) => Promise<string>,
    getHubResourcesFn?: (id: string) => Promise<Uint8Array>,
    getDatabaseFn: () => any,
    setDatabaseFn: (db: any) => void
): Promise<boolean> {
    if (!card || (card.spec !== 'chara_card_v2' && card.spec !== 'chara_card_v3')) {
        return false
    }

    const data = card.data
    let im = img ? await saveAssetFn(img) : undefined
    let db = getDatabaseFn()

    const risuext = safeStructuredClone(data.extensions?.risuai || {})
    let emotions: [string, string][] = []
    let bias: [string, number][] = []
    let viewScreen: "none" | "emotion" | "imggen" = 'none'
    let customScripts: customscript[] = []
    let utilityBot = false
    let sdData = defaultSdDataFunc()
    let extAssets: [string, string, string][] = []
    let ccAssets: {
        type: string
        uri: string
        name: string
        ext: string
    }[] = []

    let vits: null | OnnxModelFiles = null

    // V2 카드 처리
    if (risuext && card.spec === 'chara_card_v2') {
        if (risuext.emotions) {
            for (let i = 0; i < risuext.emotions.length; i++) {
                if (risuext.emotions[i][1].startsWith('__asset:')) {
                    const key = risuext.emotions[i][1].replace('__asset:', '')
                    const imgp = assetDict[key]
                    if (!imgp) {
                        throw new Error('Error while importing, asset ' + key + ' not found')
                    }
                    emotions.push([risuext.emotions[i][0], imgp])
                    continue
                }
                const imgData = mode === 'hub' && getHubResourcesFn
                    ? await getHubResourcesFn(risuext.emotions[i][1])
                    : Buffer.from(risuext.emotions[i][1], 'base64')
                const imgp = await saveAssetFn(imgData)
                emotions.push([risuext.emotions[i][0], imgp])
            }
        }

        if (risuext.additionalAssets) {
            for (let i = 0; i < risuext.additionalAssets.length; i++) {
                let fileName = ''
                if (risuext.additionalAssets[i].length >= 3)
                    fileName = risuext.additionalAssets[i][2]
                if (risuext.additionalAssets[i][1].startsWith('__asset:')) {
                    const key = risuext.additionalAssets[i][1].replace('__asset:', '')
                    const imgp = assetDict[key]
                    if (!imgp) {
                        throw new Error('Error while importing, asset ' + key + ' not found')
                    }
                    extAssets.push([risuext.additionalAssets[i][0], imgp, fileName])
                    continue
                }
                const imgData = mode === 'hub' && getHubResourcesFn
                    ? await getHubResourcesFn(risuext.additionalAssets[i][1])
                    : Buffer.from(risuext.additionalAssets[i][1], 'base64')
                const imgp = await saveAssetFn(imgData, '', fileName)
                extAssets.push([risuext.additionalAssets[i][0], imgp, fileName])
            }
        }

        if (risuext.vits) {
            const keys = Object.keys(risuext.vits)
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]
                if (risuext.vits[key].startsWith('__asset:')) {
                    const rkey = risuext.vits[key].replace('__asset:', '')
                    const imgp = assetDict[rkey]
                    if (!imgp) {
                        throw new Error('Error while importing, asset ' + rkey + ' not found')
                    }
                    risuext.vits[key] = imgp
                    continue
                }
                const imgData = mode === 'hub' && getHubResourcesFn
                    ? await getHubResourcesFn(risuext.vits[key])
                    : Buffer.from(risuext.vits[key], 'base64')
                const imgp = await saveAssetFn(imgData)
                risuext.vits[key] = imgp
            }

            if (keys.length > 0) {
                vits = {
                    name: "Imported VITS",
                    files: risuext.vits,
                    id: uuidv4().replace(/-/g, '')
                }
            }
        }

        if (risuext) {
            bias = risuext.bias ?? bias
            viewScreen = risuext.viewScreen ?? viewScreen
            customScripts = risuext.customScripts ?? customScripts
            utilityBot = risuext.utilityBot ?? utilityBot
            sdData = risuext.sdData ?? sdData
        }
    }

    // V3 카드 처리
    if (card.spec === 'chara_card_v3') {
        if (data.assets) {
            for (let i = 0; i < data.assets.length; i++) {
                let fileName = ''
                let imgp = ''
                if (data.assets[i].name) {
                    fileName = data.assets[i].name
                }
                if (data.assets[i].uri.startsWith('__asset:')) {
                    const key = data.assets[i].uri.replace('__asset:', '')
                    imgp = assetDict[key]
                    if (!imgp) {
                        throw new Error('Error while importing, asset ' + key + ' not found')
                    }
                }
                else if (data.assets[i].uri === 'ccdefault:') {
                    imgp = im || ''
                }
                else if (data.assets[i].uri.startsWith('embeded://')) {
                    const key = data.assets[i].uri.replace('embeded://', '')
                    imgp = assetDict[key]
                    if (!imgp) {
                        throw new Error('Error while importing, asset ' + key + ' not found')
                    }
                }
                else if (data.assets[i].uri.startsWith('data:')) {
                    const b64 = data.assets[i].uri.split(',')[1]
                    if (b64.length < 50 * 1024 * 1024) {
                        imgp = await saveAssetFn(Buffer.from(b64, 'base64'))
                    }
                    else {
                        throw new Error('Data URI too large')
                    }
                }
                else {
                    continue
                }
                if (data.assets[i].type === 'emotion') {
                    emotions.push([fileName, imgp])
                }
                else if (data.assets[i].type === 'x-risu-asset') {
                    extAssets.push([fileName, imgp, data.assets[i].ext ?? 'unknown'])
                }
                else if (data.assets[i].type === 'icon' && data.assets[i].name === 'main') {
                    im = imgp
                }
                else {
                    ccAssets.push({
                        type: data.assets[i].type ?? 'asset',
                        uri: imgp,
                        name: fileName,
                        ext: data.assets[i].ext ?? 'unknown'
                    })
                }
            }
        }

        if (risuext) {
            bias = risuext.bias ?? bias
            viewScreen = risuext.viewScreen ?? viewScreen
            customScripts = risuext.customScripts ?? customScripts
            utilityBot = risuext.utilityBot ?? utilityBot
            sdData = risuext.sdData ?? sdData
        }
    }

    // Lorebook 처리
    const charbook = data.character_book
    let lorebook: loreBook[] = overrideLorebook ?? []
    let loresettings: undefined | loreSettings = undefined
    let loreExt: undefined | any = undefined
    if (charbook) {
        const a = convertCharbook({
            lorebook: overrideLorebook ? [] : lorebook,
            charbook,
            loresettings,
            loreExt
        })

        if (!overrideLorebook) {
            lorebook = a.lorebook
        }
        loresettings = a.loresettings
        loreExt = a.loreExt
    }

    // Extensions 정리
    let ext = safeStructuredClone(data?.extensions ?? {})
    for (const key in ext) {
        if (key === 'risuai') {
            delete ext[key]
        }
        if (key === 'depth_prompt') {
            delete ext[key]
        }
    }

    // Character 객체 생성
    let char: character = {
        name: data.name ?? '',
        firstMessage: data.first_mes ?? '',
        desc: data.description ?? '',
        notes: '',
        chats: [{
            message: [],
            note: '',
            name: 'Chat 1',
            localLore: []
        }],
        chatPage: 0,
        image: im,
        emotionImages: emotions,
        bias: bias,
        globalLore: lorebook,
        viewScreen: viewScreen,
        chaId: uuidv4(),
        sdData: sdData,
        utilityBot: utilityBot,
        customscript: customScripts,
        exampleMessage: data.mes_example ?? '',
        creatorNotes: data.creator_notes ?? '',
        systemPrompt: data.system_prompt ?? '',
        postHistoryInstructions: '',
        alternateGreetings: data.alternate_greetings ?? [],
        tags: data.tags ?? [],
        creator: data.creator ?? '',
        characterVersion: `${data.character_version}` || '',
        personality: data.personality ?? '',
        scenario: data.scenario ?? '',
        firstMsgIndex: -1,
        removedQuotes: false,
        loreSettings: loresettings,
        loreExt: loreExt,
        additionalData: {
            tag: data.tags ?? [],
            creator: data.creator,
            character_version: data.character_version
        },
        additionalAssets: extAssets,
        replaceGlobalNote: data.post_history_instructions ?? '',
        backgroundHTML: data?.extensions?.risuai?.backgroundHTML,
        license: data?.extensions?.risuai?.license,
        triggerscript: data?.extensions?.risuai?.triggerscript ?? [],
        private: data?.extensions?.risuai?.private ?? false,
        additionalText: data?.extensions?.risuai?.additionalText ?? '',
        virtualscript: '', // removed due to security issue
        extentions: ext ?? {},
        largePortrait: data?.extensions?.risuai?.largePortrait ?? (!data?.extensions?.risuai),
        lorePlus: data?.extensions?.risuai?.lorePlus ?? false,
        inlayViewScreen: data?.extensions?.risuai?.inlayViewScreen ?? false,
        newGenData: data?.extensions?.risuai?.newGenData ?? undefined,
        vits: vits,
        ttsMode: vits ? 'vits' : 'normal',
        imported: true,
        source: card?.data?.extensions?.risuai?.source ?? [],
        ccAssets: ccAssets,
        lowLevelAccess: risuext?.lowLevelAccess ?? false,
        defaultVariables: data?.extensions?.risuai?.defaultVariables ?? '',
        chatFolders: [],
        prebuiltAssetCommand: data?.extensions?.risuai?.prebuiltAssetCommand ?? '',
        prebuiltAssetExclude: data?.extensions?.risuai?.prebuiltAssetExclude ?? [],
        prebuiltAssetStyle: data?.extensions?.risuai?.prebuiltAssetStyle ?? '',
    }

    // V3 전용 필드
    if (card.spec === 'chara_card_v3') {
        char.group_only_greetings = card.data.group_only_greetings ?? []
        char.nickname = card.data.nickname ?? ''
        char.source = card.data.source ?? card.data?.extensions?.risuai?.source ?? []
        char.creation_date = card.data.creation_date ?? 0
        char.modification_date = card.data.modification_date ?? 0
    }

    db.characters.push(char)
    setDatabaseFn(db)

    return true
}
