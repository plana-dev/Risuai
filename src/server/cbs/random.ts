/**
 * CBS 랜덤 및 유틸리티 함수들
 */

import type { CBSRegisterArg, matcherArg } from './types';

const randomPickImpl = (str: string, matcherArg: matcherArg, args: string[], rand: number, parseArray: (str: string) => unknown[]): string => {
    if (args.length === 0) {
        return rand.toString()
    }

    let arr: unknown[]
    if (args.length === 1) {
        if (args[0].startsWith('[') && args[0].endsWith(']')) {
            arr = parseArray(args[0])
        } else {
            arr = args[0].replace(/\\,/g, '§X').split(/\:|\,/g)
        }
    } else {
        arr = args
    }

    const index = matcherArg.tokenizeAccurate ? 0 : Math.floor(rand * arr.length)
    const element = arr[index]
    return typeof element === 'string' ? element.replace(/§X/g, ',') : JSON.stringify(element) ?? ''
}

export function registerRandomFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getSelectedCharID, pickHashRand, parseArray } = arg;

    registerFunction({
        name: 'random',
        callback: (str, matcherArg, args, vars) => {
            return randomPickImpl(str, matcherArg, args, Math.random(), parseArray)
        },
        alias: [],
        description: 'Returns a random number between 0 and 1 if no arguments. With one argument, returns a random element from the provided array or string split by commas/colons. With multiple arguments, returns a random argument.\n\nUsage:: {{random}} or {{random::a,b,c}} → "b"',
    })

    registerFunction({
        name: 'pick',
        callback: (str, matcherArg, args, vars) => {
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const selChat = selchar.chats[selchar.chatPage]
            const cid = selChat.message.length
            const hashRand = pickHashRand(cid, selchar.chaId + (selChat.id ?? ''))
            return randomPickImpl(str, matcherArg, args, hashRand, parseArray)
        },
        alias: [],
        description: 'Returns a random number between 0 and 1 if no arguments. With one argument, returns a random element from the provided array or string split by commas/colons. With multiple arguments, returns a random argument. unlike {{random}}, uses a hash-based randomization based on chat ID and character ID for consistent results across messages.\n\nUsage:: {{pick}} or {{pick::a,b,c}} → "b"',
    })

    registerFunction({
        name: 'roll',
        callback: (str, matcherArg, args, vars) => {
            if(args.length === 0){
                return '1'
            }
            const notation = args[0].split('d')
            let num = 1
            let sides = 6
            if(notation.length === 2){
                num = Number(notation[0] || 1)
                sides = Number(notation[1] || 6)
            }
            else if(notation.length === 1){
                sides = Number(notation[0])
            }
            if(isNaN(num) || isNaN(sides) || num < 1 || sides < 1){
                return 'NaN'
            }
            let total = 0
            for(let i = 0; i < num; i++){
                total += Math.floor(Math.random() * sides) + 1
            }
            return total.toString()
        },
        alias: [],
        description: 'Simulates rolling dice using standard RPG notation (XdY = X dice with Y sides each). Returns sum of all dice rolls. If no arguments, defaults to 1d6.\n\nUsage:: {{roll::2d6}} → random number 2-12, {{roll::20}} → random number 1-20',
    })

    registerFunction({
        name: 'rollp',
        callback: (str, matcherArg, args, vars) => {
            if(args.length === 0){
                return '1'
            }
            const notation = args[0].split('d')
            let num = 1
            let sides = 6
            if(notation.length === 2){
                num = Number(notation[0] || 1)
                sides = Number(notation[1] || 6)
            }
            else if(notation.length === 1){
                sides = Number(notation[0])
            }
            if(isNaN(num) || isNaN(sides) || num < 1 || sides < 1){
                return 'NaN'
            }
            let total = 0
            for(let i = 0; i < num; i++){
                const db = getDatabase()
                const selchar = db.characters[getSelectedCharID()]
                const selChat = selchar.chats[selchar.chatPage]
                const cid = selChat.message.length + (i * 15)
                const hashRand = pickHashRand(cid, selchar.chaId + (selChat.id ?? ''))
                total += Math.floor(hashRand * sides) + 1
            }
            
            return total.toString()
        },
        alias: ['rollpick'],
        description: 'Simulates rolling dice using standard RPG notation (XdY = X dice with Y sides each). Returns sum of all dice rolls. If no arguments, defaults to 1d6. Unlike {{roll}}, uses a hash-based randomization based on chat ID and character ID for consistent results across messages.\n\nUsage:: {{rollp::2d6}} → random number 2-12, {{rollp::20}} → random number 1-20',
    })

    registerFunction({
        name: 'hiddenkey',
        callback: (str, matcherArg, args, vars) => {
            return ''
        },
        alias: [],
        description: 'Works as a key for activation of lores, while not being included in the model request.\n\nUsage:: {{hidden_key::some_value}}',
    })

    registerFunction({
        name: 'reverse',
        callback: (str, matcherArg, args, vars) => {
            return [...str].reverse().join('')
        },
        alias: [],
        description: 'Reverses the input string.\n\nUsage:: {{reverse::some_value}}',
    })

    registerFunction({
        name: 'hash',
        callback: (str, matcherArg, args, vars) => {
            return ((pickHashRand(0, args[0]) * 10000000) + 1).toFixed(0).padStart(7, '0')
        },
        alias: [],
        description: 'Generates a deterministic 7-digit number based on the input string hash. Same input always produces the same output. Useful for consistent randomization.\n\nUsage:: {{hash::hello}} → 1234567',
    });

    registerFunction({
        name: 'randint',
        callback: (str, matcherArg, args, vars) => {
            const min = Number(args[0])
            const max = Number(args[1])
            if(isNaN(min) || isNaN(max)){
                return 'NaN'
            }
            return (Math.floor(Math.random() * (max - min + 1)) + min).toString()
        },
        alias: [],
        description: 'Generates a random integer between min and max values (inclusive). Returns "NaN" if arguments are not valid numbers.\n\nUsage:: {{randint::1::10}} → random number 1-10',
    });

    registerFunction({
        name: 'dice',
        callback: (str, matcherArg, args, vars) => {
            const notation = args[0].split('d')
            const num = Number(notation[0])
            const sides = Number(notation[1])
            if(isNaN(num) || isNaN(sides)){
                return 'NaN'
            }
            let total = 0
            for(let i = 0; i < num; i++){
                total += Math.floor(Math.random() * sides) + 1
            }
            return total.toString()
        },
        alias: [],
        description: 'Simulates dice rolling using standard RPG notation (XdY = X dice with Y sides each). Returns sum of all dice rolls.\n\nUsage:: {{dice::2d6}} → random number 2-12',
    });
}
