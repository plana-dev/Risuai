/**
 * CBS 유틸리티 함수들
 */

import type { CBSRegisterArg } from './types';

export function registerUtilityFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getDatabase, getSelectedCharID, makeArray, safeStructuredClone, risuChatParser, parseArray, getModules, dateTimeFormat } = arg;

    registerFunction({
        name: 'history',
        callback: (str, matcherArg, args, vars) => {
            if(args.length === 0){
                const db = getDatabase()
                const selchar = db.characters[getSelectedCharID()]
                const chat = selchar.chats[selchar.chatPage]
                return makeArray([{
                    role: 'char',
                    data: chat.fmIndex === -1 ? selchar.firstMessage : selchar.alternateGreetings[chat.fmIndex]
                }].concat(chat.message).map((v) => {
                    v = safeStructuredClone(v)
                    v.data = risuChatParser(v.data, matcherArg)
                    return JSON.stringify(v)
                }))
            }
            const db = getDatabase()
            const selchar = db.characters[getSelectedCharID()]
            const chat = selchar.chats[selchar.chatPage]
            return makeArray(chat.message.map((f) => {
                let data = ''
                if(args.includes('role')){
                    data += f.role + ': '
                }
                data += f.data
                return data
            }))
        },
        alias: ['messages'],
        description: 'Returns chat history as a JSON array. With no arguments, returns full message objects. With "role" argument, prefixes each message with "role: ". Includes first message/greeting.\n\nUsage:: {{history}} or {{history::role}}',
    });

    registerFunction({
        name: 'range',
        callback: (str, matcherArg, args, vars) => {
            const arr = parseArray(args[0])
            const start = arr.length > 1 ? Number(arr[0]) : 0
            const end = arr.length > 1 ? Number(arr[1]) : Number(arr[0])
            const step = arr.length > 2 ? Number(arr[2]) : 1
            let out:string[] = []

            for(let i=start;i<end;i+=step){
                out.push(i.toString())
            }
            
            return makeArray(out)
        },
        alias: [],
        description: 'Creates a JSON array of sequential numbers. Single argument: 0 to N-1. Two arguments: start to end-1. Three arguments: start to end-1 with step.\n\nUsage:: {{range::[5]}} → [0,1,2,3,4] or {{range::[2,8,2]}} → [2,4,6]',
    });

    registerFunction({
        name: 'date',
        callback: (str, matcherArg, args, vars) => {
            if(args.length === 0){
                const now = new Date()
                return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
            }
            const secondParam = args[1]
            let t = 0
            if(secondParam){
                t = (Number(secondParam) / 1000)
                if(isNaN(t)){
                    t = 0
                }
            }
            return dateTimeFormat(args[0], t)
        },
        alias: ['datetimeformat'],
        description: 'Formats date/time using custom format string. No arguments returns YYYY-M-D. First argument is format string, optional second argument is unix timestamp.\n\nUsage:: {{date::YYYY-MM-DD}} or {{date::HH:mm:ss::1640995200000}}',
    });

    registerFunction({
        name: 'moduleenabled',
        callback: (str, matcherArg, args, vars) => {
            const modules = getModules()
            for(const module of modules){
                if(module.namespace === args[0]){
                    return '1'
                }
            }
            return '0'
        },
        alias: ['module_enabled'],
        description: 'Checks if a module with the specified namespace is currently enabled/loaded. Returns "1" if found, "0" otherwise.\n\nUsage:: {{moduleenabled::mymodule}}',
    });

    registerFunction({
        name: 'moduleassetlist',
        callback: (str, matcherArg, args, vars) => {
            const module = getModules()?.find((f) => {
                return f.namespace === args[0]
            })
            if(!module){
                return ''
            }
            return makeArray(module.assets?.map((f) => {
                return f[0]
            }) ?? [])
        },
        alias: ['module_assetlist'],
        description: 'Returns a JSON array of asset names for the specified module namespace. Returns empty string if module not found.\n\nUsage:: {{moduleassetlist::mymodule}}',
    });

    registerFunction({
        name: 'filter',
        callback: (str, matcherArg, args, vars) => {
            const array = parseArray(args[0])
            const filterTypes = [
                'all',
                'nonempty', 
                'unique',
            ]
            let filterType = filterTypes.indexOf(args[1])
            if(filterType === -1){
                filterType = 0
            }
            return makeArray(array.filter((f, i) => {
                switch(filterType){
                    case 0:
                        return f !== '' && i === array.indexOf(f)
                    case 1:
                        return f !== ''
                    case 2:
                        return i === array.indexOf(f)
                }
            }))
        },
        alias: [],
        description: 'Filters a JSON array based on the specified filter type. "all": removes empty and duplicates, "nonempty": removes empty only, "unique": removes duplicates only.\n\nUsage:: {{filter::["a","","a"]::unique}} → ["a",""]',
    });

    registerFunction({
        name: 'all',
        callback: (str, matcherArg, args, vars) => {
            const array = args.length > 1 ? args : parseArray(args[0])
            const all = array.every((f) => {
                return f === '1'
            })
            return all ? '1' : '0'
        },
        alias: [],
        description: 'Returns "1" only if all provided values are "1", otherwise returns "0". Can take array as first argument or multiple arguments. Logical AND of all values.\n\nUsage:: {{all::1::1::1}} → 1',
    });

    registerFunction({
        name: 'any',
        callback: (str, matcherArg, args, vars) => {
            const array = args.length > 1 ? args : parseArray(args[0])
            const any = array.some((f) => {
                return f === '1'
            })
            return any ? '1' : '0'
        },
        alias: [],
        description: 'Returns "1" if any provided value is "1", otherwise returns "0". Can take array as first argument or multiple arguments. Logical OR of all values.\n\nUsage:: {{any::0::1::0}} → 1',
    });

    registerFunction({
        name: 'min',
        callback: (str, matcherArg, args, vars) => {
            const val = args.length > 1 ? args : parseArray(args[0])
            return Math.min(...val.map((f) => {
                const num = Number(f)
                if(isNaN(num)){
                    return 0
                }
                return num
            })).toString()
        },
        alias: [],
        description: 'Returns the smallest numeric value from the provided values. Can take array as first argument or multiple arguments. Non-numeric values treated as 0.\n\nUsage:: {{min::5::2::8}} → 2',
    });

    registerFunction({
        name: 'max',
        callback: (str, matcherArg, args, vars) => {
            const val = args.length > 1 ? args : parseArray(args[0])
            return Math.max(...val.map((f) => {
                const num = Number(f)
                if(isNaN(num)){
                    return 0
                }
                return num
            })).toString()
        },
        alias: [],
        description: 'Returns the largest numeric value from the provided values. Can take array as first argument or multiple arguments. Non-numeric values treated as 0.\n\nUsage:: {{max::5::2::8}} → 8',
    });

    registerFunction({
        name: 'sum',
        callback: (str, matcherArg, args, vars) => {
            const val = args.length > 1 ? args : parseArray(args[0])
            return val.map((f) => {
                const num = Number(f)
                if(isNaN(num)){
                    return 0
                }
                return num
            }).reduce((a, b) => a + b, 0).toString()
        },
        alias: [],
        description: 'Returns the sum of all numeric values provided. Can take array as first argument or multiple arguments. Non-numeric values treated as 0.\n\nUsage:: {{sum::1::2::3}} → 6',
    });

    registerFunction({
        name: 'average',
        callback: (str, matcherArg, args, vars) => {
            const val = args.length > 1 ? args : parseArray(args[0])
            const sum = val.map((f) => {
                const num = Number(f)
                if(isNaN(num)){
                    return 0
                }
                return num
            }).reduce((a, b) => a + b, 0)
            return (sum / val.length).toString()
        },
        alias: [],
        description: 'Returns the arithmetic mean of all numeric values provided. Can take array as first argument or multiple arguments. Non-numeric values treated as 0.\n\nUsage:: {{average::2::4::6}} → 4',
    });

    registerFunction({
        name: 'fixnum',
        callback: (str, matcherArg, args, vars) => {
            return Number(args[0]).toFixed(Number(args[1]))
        },
        alias: ['fixnum', 'fixnumber'],
        description: 'Rounds a number to the specified number of decimal places. Uses toFixed() method for consistent formatting.\n\nUsage:: {{fixnum::3.14159::2}} → 3.14',
    });

    registerFunction({
        name: 'unicodeencode',
        callback: (str, matcherArg, args, vars) => {
            return args[0].charCodeAt(args[1] ? Number(args[1]) : 0).toString()
        },
        alias: ['unicode_encode'],
        description: 'Returns the Unicode code point of a character at the specified index (default 0) in the string. Returns numeric code as string.\n\nUsage:: {{unicodeencode::A}} → 65',
    });

    registerFunction({
        name: 'unicodedecode',
        callback: (str, matcherArg, args, vars) => {
            return String.fromCharCode(Number(args[0]))
        },
        alias: ['unicode_decode'],
        description: 'Converts a Unicode code point number back to its corresponding character. Inverse of unicodeencode.\n\nUsage:: {{unicodedecode::65}} → A',
    });

    registerFunction({
        name: 'u',
        callback: (str, matcherArg, args, vars) => {
            return String.fromCharCode(parseInt(args[0], 16))
        },
        alias: ['unicodedecodefromhex'],
        description: 'Converts a hexadecimal Unicode code to its corresponding character. Useful for special characters and symbols.\n\nUsage:: {{u::41}} → A',
    });

    registerFunction({
        name: 'ue',
        callback: (str, matcherArg, args, vars) => {
            return String.fromCharCode(parseInt(args[0], 16))
        },
        alias: ['unicodeencodefromhex'],
        description: 'Converts a hexadecimal Unicode code to its corresponding character. Alias for {{u}}.\n\nUsage:: {{ue::41}} → A',
    });

    registerFunction({
        name: 'fromhex',
        callback: (str, matcherArg, args, vars) => {
            return Number.parseInt(args[0], 16).toString()
        },
        alias: [],
        description: 'Converts a hexadecimal string to its decimal number equivalent. Parses base-16 input to base-10 output.\n\nUsage:: {{fromhex::FF}} → 255',
    });

    registerFunction({
        name: 'tohex',
        callback: (str, matcherArg, args, vars) => {
            return Number.parseInt(args[0]).toString(16)
        },
        alias: [],
        description: 'Converts a decimal number to its hexadecimal string representation. Parses base-10 input to base-16 output.\n\nUsage:: {{tohex::255}} → ff',
    });

    registerFunction({
        name: 'iserror',
        callback: (str, matcherArg, args, vars) => {
            return args[0].toLocaleLowerCase().startsWith('error:') ? '1' : '0'
        },
        alias: [],
        description: 'Checks if a string starts with "error:" (case-insensitive). Returns "1" if it\'s an error message, "0" otherwise. Useful for error handling.\n\nUsage:: {{iserror::Error: failed}} → 1',
    });
}
