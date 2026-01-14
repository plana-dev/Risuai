/**
 * CBS 수학 함수들
 */

import type { CBSRegisterArg } from './types';

export function registerMathFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getSelectedCharID } = arg;

    registerFunction({
        name: 'round',
        callback: (str, matcherArg, args, vars) => {
            return Math.round(Number(args[0])).toString()
        },
        alias: [],
        description: 'Rounds a decimal number to the nearest integer using standard rounding rules (0.5 rounds up). Returns result as string.\n\nUsage:: {{round::3.7}} → 4',
    });

    registerFunction({
        name: 'floor',
        callback: (str, matcherArg, args, vars) => {
            return Math.floor(Number(args[0])).toString()
        },
        alias: [],
        description: 'Rounds a decimal number down to the nearest integer (floor function). Always rounds towards negative infinity.\n\nUsage:: {{floor::3.9}} → 3',
    });

    registerFunction({
        name: 'ceil',
        callback: (str, matcherArg, args, vars) => {
            return Math.ceil(Number(args[0])).toString()
        },
        alias: [],
        description: 'Rounds a decimal number up to the nearest integer (ceiling function). Always rounds towards positive infinity.\n\nUsage:: {{ceil::3.1}} → 4',
    });

    registerFunction({
        name: 'abs',
        callback: (str, matcherArg, args, vars) => {
            return Math.abs(Number(args[0])).toString()
        },
        alias: [],
        description: 'Returns the absolute value of a number (removes negative sign). Converts to positive value regardless of input sign.\n\nUsage:: {{abs::-5}} → 5',
    });

    registerFunction({
        name: 'remaind',
        callback: (str, matcherArg, args, vars) => {
            return (Number(args[0]) % Number(args[1])).toString()
        },
        alias: [],
        description: 'Returns the remainder after dividing first number by second (modulo operation). Useful for cycles and ranges.\n\nUsage:: {{remaind::10::3}} → 1',
    });

    registerFunction({
        name: 'tonumber',
        callback: (str, matcherArg, args, vars) => {
            return ([...args[0]].filter((v) => {
                return !isNaN(Number(v)) || v === '.'
            })).join('')
        },
        alias: [],
        description: 'Extracts only numeric characters (0-9) and decimal points from a string, removing all other characters.\n\nUsage:: {{tonumber::abc123.45def}} → 123.45',
    });

    registerFunction({
        name: 'pow',
        callback: (str, matcherArg, args, vars) => {
            return Math.pow(Number(args[0]), Number(args[1])).toString()
        },
        alias: [],
        description: 'Calculates the power of a number (base raised to exponent). Performs mathematical exponentiation.\n\nUsage:: {{pow::2::3}} → 8 (2³)',
    });

    registerFunction({
        name: 'previouschatlog',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar?.chats?.[selchar.chatPage]
            return chat?.message[Number(args[0])]?.data ?? 'Out of range'
        },
        alias: ['previous_chat_log'],
        description: 'Retrieves the message content at the specified index in the chat history. Returns "Out of range" if index is invalid.\n\nUsage:: {{previouschatlog::5}}',
    });
}
