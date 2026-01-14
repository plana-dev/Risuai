/**
 * CBS 블록 매칭 관련 함수들
 * legacyBlockMatcher, blockStartMatcher, blockEndMatcher
 */

import type { matcherArg } from '../../ts/cbs';
import type { blockMatch } from './types';
import { parseArray, trimLines, risuEscape } from './utility';

export function legacyBlockMatcher(p1: string, matcherArg: matcherArg) {
    const bn = p1.indexOf('\n')

    if (bn === -1) {
        return null
    }

    const logic = p1.substring(0, bn)
    const content = p1.substring(bn + 1)
    const statement = logic.split(" ", 2)

    switch (statement[0]) {
        case 'if': {
            if (["", "0", "-1"].includes(statement[1])) {
                return ''
            }

            return content.trim()
        }
    }

    return null
}

export interface BlockMatcherContext {
    getChatVar: (key: string) => string;
    getGlobalChatVar: (key: string) => string;
}

export function blockStartMatcher(
    p1: string,
    matcherArg: matcherArg,
    context: BlockMatcherContext
): { type: blockMatch, type2?: string, funcArg?: string[], mode?: string } {
    if (p1.startsWith('#if') || p1.startsWith('#if_pure ')) {
        const statement = p1.split(' ', 2)
        const state = statement[1]
        if (state === 'true' || state === '1') {
            return {
                type: p1.startsWith('#if_pure') ? 'ifpure' :
                    'parse'
            }
        }
        return { type: 'ignore' }
    }

    if (p1.startsWith('#when')) {
        if (p1.startsWith('#when ')) {
            const statement = p1.split(' ', 2)
            const state = statement[1]
            return { type: (state === 'true' || state === '1') ? 'newif' : 'newif-falsy' }
        }
        else if (p1.startsWith('#when::')) {
            const statement = p1.split('::').slice(1)
            if (statement.length === 1) {
                const state = statement[0]
                return { type: (state === 'true' || state === '1') ? 'newif' : 'newif-falsy' }
            }
            let mode: 'normal' | 'keep' | 'legacy' = 'normal'

            const isTruthy = (s: string) => {
                return s === 'true' || s === '1'
            }
            while (statement.length > 1) {
                const condition = statement.pop()
                const operator = statement.pop()
                switch (operator) {
                    case 'not': {
                        if (isTruthy(condition)) {
                            statement.push('0')
                        }
                        else {
                            statement.push('1')
                        }
                        break
                    }
                    case 'keep': {
                        mode = 'keep'
                        statement.push(condition)
                        break
                    }
                    case 'legacy': {
                        mode = 'legacy'
                        statement.push(condition)
                        break
                    }
                    case 'and': {
                        const condition2 = statement.pop()
                        if (isTruthy(condition) && isTruthy(condition2)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'or': {
                        const condition2 = statement.pop()
                        if (isTruthy(condition) || isTruthy(condition2)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'is': {
                        const condition2 = statement.pop()
                        if (condition === condition2) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'isnot': {
                        const condition2 = statement.pop()
                        if (condition !== condition2) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'var': {
                        const variable = context.getChatVar(condition)
                        if (isTruthy(variable)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'toggle': {
                        const variable = context.getGlobalChatVar('toggle_' + condition)
                        if (isTruthy(variable)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'vis': { //vis = variable is
                        const variable = context.getChatVar(statement.pop())
                        if (variable === condition) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'visnot': { //visnot = variable is not
                        const variable = context.getChatVar(statement.pop())
                        if (variable !== condition) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'tis': { //tis = toggle is
                        const variable = context.getGlobalChatVar('toggle_' + statement.pop())
                        if (variable === condition) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case 'tisnot': { //tisnot = toggle is not
                        const variable = context.getGlobalChatVar('toggle_' + statement.pop())
                        if (variable !== condition) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case '>': {
                        const condition2 = statement.pop()
                        if (parseFloat(condition2) > parseFloat(condition)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case '<': {
                        const condition2 = statement.pop()
                        if (parseFloat(condition2) < parseFloat(condition)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case '>=': {
                        const condition2 = statement.pop()
                        if (parseFloat(condition2) >= parseFloat(condition)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    case '<=': {
                        const condition2 = statement.pop()
                        if (parseFloat(condition2) <= parseFloat(condition)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                    default: {
                        if (isTruthy(condition)) {
                            statement.push('1')
                        }
                        else {
                            statement.push('0')
                        }
                        break
                    }
                }
            }

            const finalCondition = statement[0]
            if (isTruthy(finalCondition)) {
                switch (mode) {
                    case 'keep': {
                        return { type: 'newif', type2: 'keep' }
                    }
                    case 'legacy': {
                        return { type: 'parse' }
                    }
                    default: {
                        return { type: 'newif' }
                    }
                }
            }
            else {
                switch (mode) {
                    case 'keep': {
                        return { type: 'newif-falsy', type2: 'keep' }
                    }
                    case 'legacy': {
                        return { type: 'ignore' }
                    }
                    default: {
                        return { type: 'newif-falsy' }
                    }
                }
            }
        }
        else {
            return { type: 'newif-falsy' }
        }
    }
    if (p1 === '#pure') {
        return { type: 'pure' }
    }
    if (p1 === '#pure_display' || p1 === '#puredisplay') {
        return { type: 'pure-display' }
    }
    if (p1 === '#code') {
        return { type: 'normalize' }
    }
    if (p1 === '#escape') {
        return { type: 'escape' }
    }
    if (p1.startsWith('#each')) {
        let t2 = p1.substring(5).trim()
        let mode: string | undefined
        if (t2.startsWith('::keep ')) {
            mode = 'keep'
            t2 = t2.substring(7).trim()
        }
        if (t2.startsWith('as ')) {
            t2 = t2.substring(3).trim()
        }
        return { type: 'each', type2: t2, mode }
    }
    if (p1.startsWith('#func')) {
        const statement = p1.split(' ')
        if (statement.length > 1) {
            return { type: 'function', funcArg: statement.slice(1) }
        }

    }

    return { type: 'nothing' }
}

export function blockEndMatcher(
    p1: string,
    type: { type: blockMatch, type2?: string, mode?: string },
    matcherArg: matcherArg
): string {
    const p1Trimed = p1.trim()
    switch (type.type) {
        case 'pure':
        case 'pure-display':
        case 'function': {
            return p1Trimed
        }
        case 'parse': {
            return trimLines(p1Trimed)
        }
        case 'each': {
            if (type.mode === 'keep') {
                return p1
            }
            return trimLines(p1Trimed)
        }
        case 'ifpure': {
            return p1
        }
        case 'newif':
        case 'newif-falsy': {
            const lines = p1.split("\n")

            if (lines.length === 1) {
                const elseIndex = p1.indexOf('{{:else}}')
                if (elseIndex !== -1) {
                    if (type.type === 'newif') {
                        return p1.substring(0, elseIndex)
                    }
                    if (type.type === 'newif-falsy') {
                        return p1.substring(elseIndex + 9)
                    }
                }
                else {
                    if (type.type === 'newif') {
                        return p1
                    }
                    if (type.type === 'newif-falsy') {
                        return ''
                    }
                }
            }

            const elseLine = lines.findIndex((v) => {
                return v.trim() === '{{:else}}'
            })

            if (elseLine !== -1 && type.type === 'newif') {
                lines.splice(elseLine) //else line and everything after it is removed
            }
            if (elseLine !== -1 && type.type === 'newif-falsy') {
                lines.splice(0, elseLine + 1) //everything before else line is removed
            }
            if (elseLine === -1 && type.type === 'newif-falsy') {
                return ''
            }

            if (type.type2 !== 'keep') {
                while (lines.length > 0 && lines[0].trim() === '') {
                    lines.shift()
                }
                while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                    lines.pop()
                }
            }
            return lines.join('\n')
        }

        case 'normalize': {
            return p1Trimed.trim().replaceAll('\n', '').replaceAll('\t', '')
                .replaceAll(/\\u([0-9A-Fa-f]{4})/g, (match, p1) => {
                    return String.fromCharCode(parseInt(p1, 16))
                })
                .replaceAll(/\\(.)/g, (match, p1) => {
                    switch (p1) {
                        case 'n':
                            return '\n'
                        case 'r':
                            return '\r'
                        case 't':
                            return '\t'
                        case 'b':
                            return '\b'
                        case 'f':
                            return '\f'
                        case 'v':
                            return '\v'
                        case 'a':
                            return '\a'
                        case 'x':
                            return '\x00'
                        default:
                            return p1
                    }
                })
        }
        case 'escape': {
            return risuEscape(p1Trimed)
        }
        default: {
            return ''
        }
    }
}
