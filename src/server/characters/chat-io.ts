/**
 * 채팅 임포트/익스포트 함수들
 * 
 * 서버 사이드에서는 데이터베이스에서 직접 데이터를 가져오고 저장합니다.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Chat } from '../database';
import { checkNullish } from '../util';

/**
 * 채팅을 JSON 형식으로 익스포트합니다.
 * 
 * @param chat - 익스포트할 채팅
 * @param folders - 채팅 폴더 목록 (선택사항)
 * @returns JSON 문자열
 */
export function exportChatAsJSON(
    chat: Chat,
    folders: any[] = []
): string {
    return JSON.stringify({
        type: 'risuChat',
        ver: 2,
        data: chat,
        folders: folders
    }, null, 2);
}

/**
 * 모든 채팅을 JSON 형식으로 익스포트합니다.
 * 
 * @param chats - 익스포트할 채팅 목록
 * @param folders - 채팅 폴더 목록 (선택사항)
 * @returns JSON 문자열
 */
export function exportAllChatsAsJSON(
    chats: Chat[],
    folders: any[] = []
): string {
    return JSON.stringify({
        type: 'risuAllChats',
        ver: 2,
        data: chats,
        folders: folders
    }, null, 2);
}

/**
 * 채팅을 TXT 형식으로 익스포트합니다.
 * 
 * @param chat - 익스포트할 채팅
 * @param charName - 캐릭터 이름
 * @param firstMessage - 첫 메시지
 * @param getUserNameFn - 사용자 이름 가져오기 함수
 * @param findCharacterbyIdFn - ID로 캐릭터 찾기 함수
 * @returns TXT 문자열
 */
export function exportChatAsTXT(
    chat: Chat,
    charName: string,
    firstMessage: string,
    getUserNameFn: () => string,
    findCharacterbyIdFn: (id: string) => { name: string }
): string {
    let stringl = chat.message.map((v) => {
        if (v.saying) {
            return `--${findCharacterbyIdFn(v.saying).name}\n${v.data}`
        }
        else {
            return `--${v.role === 'char' ? charName : getUserNameFn()}\n${v.data}`
        }
    }).join('\n\n')

    stringl = `--${charName}\n${firstMessage}\n\n` + stringl

    return stringl
}

/**
 * JSON 형식의 채팅을 임포트합니다.
 * 
 * @param jsonData - JSON 데이터
 * @param existingChatFolders - 기존 채팅 폴더 목록
 * @returns 임포트된 채팅 목록과 폴더 목록
 */
export function importChatFromJSON(
    jsonData: any,
    existingChatFolders: any[] = []
): { chats: Chat[], folders: any[] } {
    if ((jsonData.type === 'risuAllChats' || jsonData.type === 'risuChat') && jsonData.ver === 2) {
        const folders = jsonData.folders || []
        const chats = Array.isArray(jsonData.data) ? jsonData.data : [jsonData.data]
        let folderIdMap: { [key: string]: string } = {}

        // 폴더 ID 중복 처리
        folders.forEach((folder: any) => {
            if (existingChatFolders?.some((f: any) => f.id === folder.id)) {
                const newId = uuidv4()
                folderIdMap[folder.id] = newId
                folder.id = newId
            } else {
                folderIdMap[folder.id] = folder.id
            }
        })

        // 채팅 ID 업데이트 및 폴더 ID 매핑
        chats.forEach((chat: Chat) => {
            if (chat.folderId && folderIdMap[chat.folderId]) {
                chat.folderId = folderIdMap[chat.folderId]
            }
            if (!chat.id) {
                chat.id = uuidv4()
            }
        })

        return { chats, folders }
    }

    if (jsonData.type === 'risuAllChats' && jsonData.ver === 1) {
        const chats = jsonData.data
        if (Array.isArray(chats) && chats.length > 0) {
            const processedChats = chats.map((v: Chat) => {
                if (!v.id) {
                    v.id = uuidv4()
                }
                if (!v.localLore) {
                    v.localLore = []
                }
                v.fmIndex ??= -1
                return v
            })
            return { chats: processedChats, folders: [] }
        }
        throw new Error('Invalid chat data')
    }

    if (jsonData.type === 'risuChat' && jsonData.ver === 1) {
        const das: Chat = jsonData.data
        if (!(checkNullish(das.message) || checkNullish(das.note) || checkNullish(das.name) || checkNullish(das.localLore))) {
            das.fmIndex ??= -1
            if (!das.id) {
                das.id = uuidv4()
            }
            return { chats: [das], folders: [] }
        }
        throw new Error('Invalid chat data')
    }

    throw new Error('Unsupported chat format')
}

/**
 * JSONL 형식의 채팅을 임포트합니다.
 * 
 * @param jsonlData - JSONL 데이터 (줄바꿈으로 구분된 JSON 라인들)
 * @param charName - 캐릭터 이름
 * @param formatTavernChatFn - Tavern 형식 채팅 포맷팅 함수
 * @returns 임포트된 채팅
 */
export function importChatFromJSONL(
    jsonlData: string,
    charName: string,
    formatTavernChatFn: (chat: string, charName: string) => string
): Chat {
    const lines = jsonlData.split('\n').filter(line => line.trim())
    let newChat: Chat = {
        message: [],
        note: "",
        name: "Imported Chat",
        localLore: [],
        fmIndex: -1,
        id: uuidv4()
    }

    let isFirst = true
    for (const line of lines) {
        try {
            const parsedLine = JSON.parse(line)
            if (parsedLine.name && parsedLine.is_user !== undefined && parsedLine.mes) {
                if (!isFirst) {
                    newChat.message.push({
                        role: parsedLine.is_user ? "user" : 'char',
                        data: formatTavernChatFn(parsedLine.mes, charName)
                    })
                }
            }
        } catch (error) {
            // JSON 파싱 실패 시 해당 라인 건너뛰기
            continue
        }
        isFirst = false
    }

    if (newChat.message.length === 0) {
        throw new Error('No valid chat messages found')
    }

    return newChat
}

/**
 * HTML 형식의 채팅을 임포트합니다.
 * 
 * @param htmlData - HTML 데이터
 * @returns 임포트된 채팅
 */
export function importChatFromHTML(htmlData: string): Chat {
    // DOMParser는 Node.js 환경에서는 jsdom 등이 필요합니다.
    // 서버 사이드에서는 간단한 정규식 기반 파싱을 사용하거나,
    // HTML 파싱 라이브러리를 사용해야 합니다.
    
    // .idat 클래스를 가진 요소에서 JSON 데이터 추출
    const idatMatch = htmlData.match(/<div[^>]*class="idat"[^>]*>([^<]+)<\/div>/)
    if (!idatMatch) {
        throw new Error('Chat data not found in HTML')
    }

    const jsonString = idatMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')

    const json = JSON.parse(jsonString)
    
    if (json.message && json.note && json.name && json.localLore) {
        if (!json.id) {
            json.id = uuidv4()
        }
        return json as Chat
    }

    throw new Error('Invalid chat data in HTML')
}

/**
 * 채팅을 HTML 형식으로 익스포트합니다.
 * 
 * @param chat - 익스포트할 채팅
 * @param charName - 캐릭터 이름
 * @param firstMessage - 첫 메시지
 * @param getUserNameFn - 사용자 이름 가져오기 함수
 * @param findCharacterbyIdFn - ID로 캐릭터 찾기 함수
 * @param parseMarkdownFn - 마크다운 파싱 함수 (선택사항)
 * @param translateHTMLFn - HTML 번역 함수 (선택사항)
 * @param anonymous - 익명 모드 여부
 * @returns HTML 문자열
 */
export function exportChatAsHTML(
    chat: Chat,
    charName: string,
    firstMessage: string,
    getUserNameFn: () => string,
    findCharacterbyIdFn: (id: string) => { name: string },
    parseMarkdownFn?: (text: string) => string,
    translateHTMLFn?: (html: string) => Promise<string>,
    anonymous: boolean = false
): Promise<string> {
    return (async () => {
        const htmlChatParse = async (v: string): Promise<string> => {
            let result = parseMarkdownFn ? parseMarkdownFn(v) : v

            if (translateHTMLFn) {
                result = await translateHTMLFn(result)
            }

            if (anonymous) {
                const escapedName = charName.replace(/[-\/\\^$*+\?\.()|[\]{}]/g, '\\$&')
                result = result.replace(new RegExp(`${escapedName}`, 'gi'), '×××')
            }

            return result
        }

        let chatContentHTML = ''

        for (const v of chat.message) {
            const name = v.saying
                ? findCharacterbyIdFn(v.saying).name
                : v.role === 'char'
                    ? charName
                    : anonymous
                        ? '×××'
                        : getUserNameFn()
            chatContentHTML += `<div class="chat">
                <h2>${name}</h2>
                <div>${await htmlChatParse(v.data)}</div>
            </div>`
        }

        const doc = `<!DOCTYPE html>
<html>
    <head>
        <title>${charName} Chat</title>
        <style>
            body{
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
            }
            .container{
                max-width: 800px;
                padding: 1rem;
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .chat{
                background: #f0f0f0;
                padding: 1rem;
                border-radius: 10px;
                display: flex;
                flex-direction: column;
            }
            .idat{
                display: none;
            }
            h2{
                margin: 0;
            }
            .chat div{
                margin-top: 0.5rem;
                break-word: break-all;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="chat">
                <h2>${charName}</h2>
                <div>${await htmlChatParse(firstMessage)}</div>
            </div>
            ${chatContentHTML}
        </div>
        <div class="idat">${
            JSON.stringify(chat).replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }</div>
    </body>
</html>`

        return doc
    })()
}
