/**
 * 에셋 파싱 관련 함수들
 * parseAdditionalAssets, parseInlayAssets, getClosestMatch
 */

import type { AssetPaths, simpleCharacterArgument } from './types';
import type { character } from '../database';
import { getDistance, trimmer } from './utility';

export const assetRegex = /{{(raw|path|img|image|video|audio|bgm|bg|emotion|asset|video-img|source)::(.+?)}}/gms

function getAssetSrc(assetArr: string[][], assetPaths: AssetPaths) {
    for (const asset of assetArr) {
        const key = asset[0].toLocaleLowerCase()
        assetPaths[key] ??= {
            srcPaths: [],
            ext: asset[2]
        }
        if (assetPaths[key].ext === asset[2]) {
            assetPaths[key].srcPaths.push(asset[1])
        }
    }
}

function getEmoSrc(emoArr: string[][], emoPaths: AssetPaths) {
    for (const emo of emoArr) {
        emoPaths[emo[0].toLocaleLowerCase()] = {
            srcPaths: [emo[1]]
        }
    }
}

export interface AssetContext {
    getFileSrc: (path: string) => Promise<string>;
    getFileSrcCached: (path: string) => Promise<string>;
    getModuleAssets: () => string[][];
    getCurrentCharacter: () => character;
    getUserIcon: () => string | null;
    pickHashRand: (seed: number, hash: string) => number;
    hideAllImages?: boolean;
    assetWidth?: number;
    legacyMediaFindings?: boolean;
    assetMaxDifference?: number;
}

export async function parseAdditionalAssets(
    data: string,
    char: simpleCharacterArgument | character,
    mode: 'normal' | 'back',
    arg: { ch: number },
    context: AssetContext
): Promise<string> {
    const assetWidthString = (context.assetWidth && context.assetWidth !== -1 || context.assetWidth === 0) ? `max-width:${context.assetWidth}rem;` : ''

    let assetPaths: AssetPaths = {}
    let emoPaths: AssetPaths = {}

    if (char.emotionImages) getEmoSrc(char.emotionImages, emoPaths)

    const videoExtention = ['mp4', 'webm', 'avi', 'm4p', 'm4v']
    let needsSourceAccess = false

    const moduleAssets = context.getModuleAssets()

    if (char.additionalAssets) {
        getAssetSrc(char.additionalAssets, assetPaths)
    }
    if (moduleAssets.length > 0) {
        getAssetSrc(moduleAssets, assetPaths)
    }

    let cx: number | null = null

    // replaceAsync를 사용하는 대신 직접 처리
    const matches = Array.from(data.matchAll(assetRegex))
    for (const match of matches) {
        const [full, type, name] = match
        const lowerName = name.toLocaleLowerCase()

        // Skip image-related assets when hideAllImages is enabled
        const imageTypes = ['img', 'image', 'emotion', 'asset', 'bg', 'raw', 'path']
        if (context.hideAllImages && imageTypes.includes(type)) {
            data = data.replace(full, '')
            continue
        }

        if (type === 'emotion') {
            const srcPath = emoPaths[lowerName]?.srcPaths?.[0]
            const path = srcPath ? await context.getFileSrcCached(srcPath) : null
            if (!path) {
                data = data.replace(full, '')
                continue
            }
            data = data.replace(full, `<img src="${path}" alt="${path}" style="${assetWidthString} "/>`)
            continue
        }

        if (type === 'source') {
            needsSourceAccess = true
            switch (lowerName) {
                case 'char': {
                    data = data.replace(full, '\uE9b4CHAR\uE9b4')
                    continue
                }
                case 'user': {
                    data = data.replace(full, '\uE9b4USER\uE9b4')
                    continue
                }
            }
        }

        let match = assetPaths[lowerName]

        if (!match) {
            if (context.legacyMediaFindings) {
                data = data.replace(full, '')
                continue
            }

            match = getClosestMatch(char, lowerName, assetPaths, context.assetMaxDifference ?? 999999)

            if (!match) {
                data = data.replace(full, '')
                continue
            }
        }

        let pSrc = match.srcPaths[0]

        if (match.srcPaths.length > 1) {
            if (cx === null) {
                const chatID = arg.ch
                cx = context.pickHashRand(chatID, (char.chaId || 'global') + chatID)
            }
            const selIndex = Math.floor(cx * match.srcPaths.length)
            pSrc = match.srcPaths[selIndex]
        }

        const p = await context.getFileSrcCached(pSrc)
        let replacement = ''
        switch (type) {
            case 'raw':
            case 'path':
                replacement = p
                break
            case 'img':
                replacement = `<img src="${p}" alt="${p}" style="${assetWidthString} "/>`
                break
            case 'image':
                replacement = `<div class="risu-inlay-image"><img src="${p}" alt="${p}" style="${assetWidthString}"/></div>\n`
                break
            case 'video':
                replacement = `<video controls autoplay loop><source src="${p}" type="video/mp4"></video>\n`
                break
            case 'video-img':
                replacement = `<video autoplay muted loop><source src="${p}" type="video/mp4"></video>\n`
                break
            case 'audio':
                replacement = `<audio controls autoplay loop><source src="${p}" type="audio/mpeg"></audio>\n`
                break
            case 'bg':
                if (mode === 'back') {
                    replacement = `<div style="width:100%;height:100%;background: linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)),url(${p}); background-size: cover;"></div>`
                }
                break
            case 'asset': {
                if (match.ext && videoExtention.includes(match.ext)) {
                    replacement = `<video autoplay muted loop><source src="${p}" type="video/mp4"></video>\n`
                }
                else {
                    replacement = `<img src="${p}" alt="${p}" style="${assetWidthString} "/>\n`
                }
                break
            }
            case 'bgm':
                replacement = `<div risu-ctrl="bgm___auto___${p}" style="display:none;"></div>\n`
                break
        }
        data = data.replace(full, replacement)
    }

    if (needsSourceAccess) {
        const chara = context.getCurrentCharacter()
        data = data.replace(/\uE9b4CHAR\uE9b4/g,
            chara.image ? (await context.getFileSrc(chara.image)) : ''
        )

        data = data.replace(/\uE9b4USER\uE9b4/g,
            context.getUserIcon() ? (await context.getFileSrc(context.getUserIcon())) : ''
        )
    }

    return data
}

export function getClosestMatch(
    char: simpleCharacterArgument | character,
    name: string,
    assetPaths: AssetPaths,
    assetMaxDifference: number
): AssetPaths[string] | null {
    if (!char.additionalAssets) return null

    let closest = ''
    let closestDist = 999999
    let targetPath = ''
    let targetExt = ''

    const trimmedName = trimmer(name)
    for (const asset of char.additionalAssets) {
        const key = asset[0].toLocaleLowerCase()
        const dist = getDistance(trimmedName, trimmer(key))
        if (dist < closestDist) {
            closest = key
            closestDist = dist
            targetPath = asset[1]
            targetExt = asset[2]
        }
    }

    if (closestDist > assetMaxDifference) {
        return null
    }

    assetPaths[closest] = {
        srcPaths: [targetPath],
        ext: targetExt
    }

    return assetPaths[closest]
}

export interface InlayContext {
    getInlayAssetBlob: (id: string) => Promise<{ type: 'image' | 'video' | 'audio', data: Blob } | null>;
    hideAllImages?: boolean;
}

export async function parseInlayAssets(data: string, context: InlayContext): Promise<string> {
    const inlayMatch = data.match(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g)
    if (inlayMatch) {
        const blobUrlCache = new Map<string, string>()
        for (const inlay of inlayMatch) {
            const inlayType = inlay.startsWith('{{inlayed') ? 'inlayed' : 'inlay'
            const id = inlay.substring(inlay.indexOf('::') + 2, inlay.length - 2)
            let prefix = inlayType !== 'inlay' ? `<div class="risu-inlay-image">` : ''
            let postfix = inlayType !== 'inlay' ? `</div>\n\n` : ''

            const asset = await context.getInlayAssetBlob(id)
            let url = blobUrlCache.get(id)
            if (!url && asset?.data) {
                // 서버 사이드에서는 Blob URL 대신 다른 방식 사용 필요
                // 예: Base64 인코딩 또는 직접 파일 경로
                url = URL.createObjectURL(asset.data)
                blobUrlCache.set(id, url)
            }
            switch (asset?.type) {
                case 'image':
                    // Hide inlay images when hideAllImages is enabled
                    if (context.hideAllImages) {
                        data = data.replace(inlay, '')
                        break
                    }
                    data = data.replace(inlay, `${prefix}<img src="${url}"/>${postfix}`)
                    break
                case 'video':
                    data = data.replace(inlay, `${prefix}<video controls><source src="${url}" type="video/mp4"></video>${postfix}`)
                    break
                case 'audio':
                    data = data.replace(inlay, `${prefix}<audio controls><source src="${url}" type="audio/mpeg"></audio>${postfix}`)
                    break
            }

        }
    }
    return data
}
