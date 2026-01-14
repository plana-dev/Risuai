/**
 * 캐릭터 에셋 관리 함수들
 * 
 * 서버 사이드에서는 Supabase Storage를 사용하여 에셋을 관리합니다.
 */

import type { character } from '../database';

/**
 * 캐릭터 이미지 URL을 가져옵니다.
 * 
 * @param loc - 이미지 경로
 * @param type - 반환 타입 ('plain' | 'css' | 'contain' | 'lgcss')
 * @param getFileSrcFn - 파일 소스 URL 가져오기 함수 (Supabase Storage URL 생성)
 * @param hideAllImages - 모든 이미지 숨기기 여부
 * @returns 이미지 URL 또는 CSS 스타일
 */
export async function getCharImage(
    loc: string,
    type: 'plain' | 'css' | 'contain' | 'lgcss',
    getFileSrcFn: (loc: string) => Promise<string>,
    hideAllImages: boolean = false
): Promise<string | null> {
    // Return placeholder when hideAllImages is enabled
    if (hideAllImages) {
        if (type === 'plain') {
            return '/none.webp'
        }
        return ''  // For CSS types, return empty to show default ? icon
    }

    if (!loc || loc === '') {
        if (type === 'css') {
            return ''
        }
        return null
    }

    const filesrc = await getFileSrcFn(loc)

    if (type === 'plain') {
        return filesrc
    }
    else if (type === 'css') {
        return `background: url("${filesrc}");background-size: cover;`
    }
    else if (type === 'lgcss') {
        return `background: url("${filesrc}");background-size: cover;height: 10.66rem;`
    }
    else {
        return `background: url("${filesrc}");background-size: contain;background-repeat: no-repeat;background-position: center;`
    }
}

/**
 * 캐릭터 이미지를 ccAssets로 이동합니다.
 * 
 * @param char - 캐릭터 객체
 * @returns 업데이트된 캐릭터 객체
 */
export function dumpCharImage(char: character): character {
    if (!char.image || char.image === '') {
        return char
    }

    char.ccAssets ??= []
    char.ccAssets.push({
        type: 'icon',
        name: 'iconx',
        uri: char.image,
        ext: 'png'
    })
    char.image = ''

    return char
}

/**
 * 캐릭터 이미지를 변경합니다.
 * 
 * @param char - 캐릭터 객체
 * @param changeIndex - 변경할 ccAssets 인덱스
 * @returns 업데이트된 캐릭터 객체
 */
export function changeCharImage(
    char: character,
    changeIndex: number
): character {
    if (!char.ccAssets || changeIndex >= char.ccAssets.length) {
        return char
    }

    const image = char.ccAssets[changeIndex].uri
    char = dumpCharImage(char)
    char.image = image
    char.ccAssets.splice(changeIndex, 1)

    return char
}

/**
 * 감정 이미지를 추가합니다.
 * 
 * @param char - 캐릭터 객체
 * @param emotionName - 감정 이름
 * @param imagePath - 이미지 경로
 * @returns 업데이트된 캐릭터 객체
 */
export function addCharEmotion(
    char: character,
    emotionName: string,
    imagePath: string
): character {
    if (char.type === 'group') {
        return char
    }

    char.emotionImages ??= []
    char.emotionImages.push([emotionName, imagePath])

    return char
}

/**
 * 감정 이미지를 제거합니다.
 * 
 * @param char - 캐릭터 객체
 * @param emotionId - 감정 이미지 인덱스
 * @returns 업데이트된 캐릭터 객체
 */
export function rmCharEmotion(
    char: character,
    emotionId: number
): character {
    if (char.type === 'group') {
        return char
    }

    if (char.emotionImages && emotionId < char.emotionImages.length) {
        char.emotionImages.splice(emotionId, 1)
    }

    return char
}

/**
 * 그룹 채팅의 이미지를 생성합니다.
 * 
 * TODO: 서버 사이드에서는 이미지 생성 라이브러리(sharp, canvas 등)를 사용하여 구현
 * @param characters - 그룹에 속한 캐릭터 목록
 * @param getCharImageFn - 캐릭터 이미지 URL 가져오기 함수
 * @param saveImageFn - 이미지 저장 함수
 * @returns 생성된 이미지 경로
 */
export async function makeGroupImage(
    characters: character[],
    getCharImageFn: (char: character) => Promise<string | null>,
    saveImageFn: (data: Uint8Array) => Promise<string>
): Promise<string> {
    // TODO: 서버 사이드 이미지 생성 구현
    // 1. 각 캐릭터의 이미지 URL 가져오기
    // 2. 이미지 다운로드
    // 3. 그리드 레이아웃으로 이미지 합성 (sharp, canvas 등 사용)
    // 4. 합성된 이미지 저장
    // 5. 저장된 이미지 경로 반환
    
    throw new Error('Not implemented: 서버 사이드 이미지 생성 라이브러리 필요 (sharp, canvas 등)')
}
