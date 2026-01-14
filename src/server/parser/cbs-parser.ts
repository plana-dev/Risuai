/**
 * CBS 메인 파서
 * risuChatParser
 */

import type { matcherArg } from '../../ts/cbs';
import type { RisuChatParserArg, blockMatch } from './types';
import { parseArray } from './utility';
import { legacyBlockMatcher, blockStartMatcher, blockEndMatcher, type BlockMatcherContext } from './cbs-blocks';
import { matcher, type MatcherContext } from './cbs-matcher';

export interface RisuChatParserContext {
    getDatabase: () => any; // Database
    getSelectedCharID: () => number;
    findCharacterbyId: (id: string) => any; // character
}

export function risuChatParser(
    da: string,
    arg: RisuChatParserArg = {},
    contexts: {
        parser: RisuChatParserContext;
        matcher: MatcherContext;
        block: BlockMatcherContext;
    }
): string {
    const chatID = arg.chatID ?? -1
    const db = arg.db ?? contexts.parser.getDatabase()
    const aChara = arg.chara
    let chara: any | string = null

    if (aChara) {
        if (typeof (aChara) !== 'string' && aChara.type === 'group') {
            if (aChara.chats[aChara.chatPage].message.length > 0) {
                const gc = contexts.parser.findCharacterbyId(aChara.chats[aChara.chatPage].message.at(-1).saying ?? '')
                if (gc.name !== 'Unknown Character') {
                    chara = gc
                }
            }
            else {
                chara = 'bot'
            }
        }
        else {
            chara = aChara
        }
    }
    if (arg.tokenizeAccurate) {
        const db = arg.db ?? contexts.parser.getDatabase()
        const selchar = chara ?? db.characters[contexts.parser.getSelectedCharID()]
        if (!selchar) {
            chara = 'bot'
        }
    }

    let pointer = 0;
    let nested: string[] = [""]
    let stackType = new Uint8Array(512)
    let pureModeNest: Map<number, boolean> = new Map()
    let pureModeNestType: Map<number, string> = new Map()
    let blockNestType: Map<number, {
        type: blockMatch,
        type2?: string
        funcArg?: string[]
        mode?: string
    }> = new Map()
    let commentMode = false
    let commentLatest: string[] = [""]
    let commentV = new Uint8Array(512)
    let thinkingMode = false
    let tempVar: { [key: string]: string } = {}
    let functions: Map<string, {
        data: string,
        arg: string[]
    }> = arg.functions ?? (new Map())

    arg.callStack = (arg.callStack ?? 0) + 1

    if (arg.callStack > 20) {
        return 'ERROR: Call stack limit reached'
    }

    const matcherObj: matcherArg = {
        chatID: chatID,
        chara: chara,
        rmVar: arg.rmVar ?? false,
        db: db,
        var: arg.var ?? null,
        tokenizeAccurate: arg.tokenizeAccurate ?? false,
        displaying: arg.visualize ?? false,
        role: arg.role,
        runVar: arg.runVar ?? false,
        consistantChar: arg.consistantChar ?? false,
        cbsConditions: arg.cbsConditions ?? {},
        triggerId: undefined,
        getNested: () => {
            return nested
        },
        setNestedRoot: (val: string) => {
            nested[0] = val
        }
    }

    da = da.replace(/\<(user|char|bot)\>/gi, '{{$1}}')

    const isPureMode = () => {
        return pureModeNest.size > 0
    }

    while (pointer < da.length) {
        switch (da[pointer]) {
            case '{': {
                if (da[pointer + 1] !== '{' && da[pointer + 1] !== '#') {
                    nested[0] += da[pointer]
                    break
                }
                pointer++
                nested.unshift('')
                stackType[nested.length] = 1
                break
            }
            case '#': {
                //legacy if statement, deprecated
                if (da[pointer + 1] !== '}' || nested.length === 1 || stackType[nested.length] !== 1) {
                    nested[0] += da[pointer]
                    break
                }
                pointer++
                const dat = nested.shift()
                const mc = legacyBlockMatcher(dat, matcherObj)
                nested[0] += mc ?? `{#${dat}#}`
                break
            }
            case '}': {
                if (da[pointer + 1] !== '}' || nested.length === 1 || stackType[nested.length] !== 1) {
                    nested[0] += da[pointer]
                    break
                }
                pointer++
                const dat = nested.shift()
                if (dat.startsWith('#') || dat.startsWith(':')) {
                    if (isPureMode()) {
                        nested[0] += `{{${dat}}}`
                        nested.unshift('')
                        stackType[nested.length] = 6
                        break
                    }
                    const matchResult = blockStartMatcher(dat, matcherObj, contexts.block)
                    if (matchResult.type === 'nothing') {
                        nested[0] += `{{${dat}}}`
                        break
                    }
                    else {
                        nested.unshift('')
                        stackType[nested.length] = 5
                        blockNestType.set(nested.length, matchResult)
                        if (matchResult.type === 'ignore' || matchResult.type === 'pure' ||
                            matchResult.type === 'each' || matchResult.type === 'function' ||
                            matchResult.type === 'pure-display' || matchResult.type === 'escape'
                        ) {
                            pureModeNest.set(nested.length, true)
                            pureModeNestType.set(nested.length, "block")
                        }
                        break
                    }
                }
                if (dat.startsWith('/') && !dat.startsWith('//')) {
                    if (stackType[nested.length] === 5) {
                        const blockType = blockNestType.get(nested.length)
                        if (blockType.type === 'ignore' || blockType.type === 'pure' ||
                            blockType.type === 'each' || blockType.type === 'function' ||
                            blockType.type === 'pure-display' || blockType.type === 'escape'
                        ) {
                            pureModeNest.delete(nested.length)
                            pureModeNestType.delete(nested.length)
                        }
                        blockNestType.delete(nested.length)
                        const dat2 = nested.shift()
                        const matchResult = blockEndMatcher(dat2, blockType, matcherObj)
                        if (blockType.type === 'each') {
                            const asIndex = blockType.type2.lastIndexOf(' as ')
                            let sub = blockType.type2.substring(asIndex + 4).trim()
                            let array = parseArray(blockType.type2.substring(0, asIndex))
                            if (asIndex === -1) {
                                //compability mode
                                const subind = blockType.type2.lastIndexOf(' ')
                                if (subind === -1) {
                                    break
                                }
                                sub = blockType.type2.substring(subind + 1)
                                array = parseArray(blockType.type2.substring(0, subind))
                            }
                            let added = ''
                            for (let i = 0; i < array.length; i++) {
                                added += matchResult.replaceAll(`{{slot::${sub}}}`, typeof (array[i]) === 'string' ? array[i] as string : JSON.stringify(array[i]))
                            }
                            da = da.substring(0, pointer + 1) + (blockType.mode === 'keep' ? added : added.trim()) + da.substring(pointer + 1)
                            break
                        }
                        if (blockType.type === 'function') {
                            console.log(matchResult)
                            functions.set(blockType.funcArg[0], {
                                data: matchResult,
                                arg: blockType.funcArg.slice(1)
                            })
                            break
                        }
                        if (blockType.type === 'pure-display') {
                            nested[0] += matchResult.replaceAll('{{', '\\{\\{').replaceAll('}}', '\\}\\}')
                            break
                        }
                        if (matchResult === '') {
                            break
                        }
                        nested[0] += matchResult
                        break
                    }
                    if (stackType[nested.length] === 6) {
                        const sft = nested.shift()
                        nested[0] += sft + `{{${dat}}}`
                        break
                    }
                }
                if (dat.startsWith('call::')) {
                    if (arg.callStack && arg.callStack > 20) {
                        nested[0] += `ERROR: Call stack limit reached`
                        break
                    }
                    const argData = dat.split('::').slice(1)
                    const funcName = argData[0]
                    const func = functions.get(funcName)
                    console.log(func)
                    if (func) {
                        let data = func.data
                        for (let i = 0; i < argData.length; i++) {
                            data = data.replaceAll(`{{arg::${i}}}`, argData[i])
                        }
                        arg.functions = functions
                        nested[0] += risuChatParser(data, arg, contexts)
                        break
                    }
                }
                const mc = isPureMode() ? null : matcher(dat, matcherObj, tempVar, contexts.matcher)
                if (!mc && mc !== '') {
                    nested[0] += `{{${dat}}}`
                }
                else if (typeof (mc) === 'string') {
                    nested[0] += mc
                }
                else {
                    nested[0] += mc.text
                    tempVar = mc.var
                    if (tempVar['__force_return__']) {
                        return tempVar['__return__'] ?? 'null'
                    }
                }
                break
            }
            default: {
                nested[0] += da[pointer]
                break
            }
        }
        pointer++
    }
    if (commentMode) {
        nested = commentLatest
        stackType = commentV
        if (thinkingMode) {
            nested[0] += `<div>Thinking...</div>`
        }
        commentMode = false
    }
    if (nested.length === 1) {
        return nested[0]
    }
    let result = ''
    while (nested.length > 1) {
        let dat = (stackType[nested.length] === 1) ? '{{' : "<"
        dat += nested.shift()
        result = dat + result
    }
    return nested[0] + result
}
