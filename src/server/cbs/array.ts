/**
 * CBS 배열 및 객체 조작 함수들
 */

import type { CBSRegisterArg } from './types';

export function registerArrayFunctions(arg: CBSRegisterArg) {
    const { registerFunction, parseArray, parseDict, makeArray } = arg;

    registerFunction({
        name: 'arraylength',
        callback: (str, matcherArg, args, vars) => {
            return parseArray(args[0]).length.toString()
        },
        alias: ['arraylength'],
        description: 'Returns the number of elements in a JSON array as a string. Parses the array and counts elements.\n\nUsage:: {{arraylength::["a","b","c"]}} → 3',
    });

    registerFunction({
        name: 'arrayelement',
        callback: (str, matcherArg, args, vars) => {
            const element = parseArray(args[0]).at(Number(args[1])) ?? 'null'
            return typeof element === 'object' ? JSON.stringify(element) : String(element)
        },
        alias: ['arrayelement'],
        description: 'Retrieves the element at the specified index from a JSON array. Uses 0-based indexing. Returns "null" if index is out of bounds.\n\nUsage:: {{arrayelement::["a","b","c"]::1}} → b',
    });

    registerFunction({
        name: 'dictelement',
        callback: (str, matcherArg, args, vars) => {
            const element = parseDict(args[0])[args[1]] ?? 'null'
            return typeof element === 'object' ? JSON.stringify(element) : String(element)
        },
        alias: ['dictelement', 'objectelement'],
        description: 'Retrieves the value associated with a key from a JSON object/dictionary. Returns "null" if key doesn\'t exist.\n\nUsage:: {{dictelement::{"name":"John"}::name}} → John',
    });

    registerFunction({
        name: 'objectassert',
        callback: (str, matcherArg, args, vars) => {
            const dict = parseDict(args[0])
            if(!dict[args[1]]){
                dict[args[1]] = args[2]
            }
            return JSON.stringify(dict)
        },
        alias: ['dictassert', 'object_assert'],
        description: 'Sets a property in a JSON object only if the property doesn\'t already exist. Returns the modified object as JSON. Used for default values.\n\nUsage:: {{objectassert::{"a":1}::b::2}} → {"a":1,"b":2}',
    });

    registerFunction({
        name: 'element',
        callback: (str, matcherArg, args, vars) => {
            try {
                const agmts = args.slice(1)
                let current = args[0]
                for(const arg of agmts){
                    const parsed = JSON.parse(current)
                    if(parsed === null || (typeof(parsed) !== 'object' && !Array.isArray(parsed))){
                        return 'null'
                    }
                    current = parsed[arg]
                    if(!current){
                        return 'null'
                    }
                }
                return current
            } catch (error) {
                return 'null'
            }
        },
        alias: ['ele'],
        description: 'Retrieves a deeply nested element from a JSON structure using multiple keys/indices. Traverses the object path step by step. Returns "null" if any step fails.\n\nUsage:: {{element::{"user":{"name":"John"}}::user::name}} → John',
    });

    registerFunction({
        name: 'arrayshift',
        callback: (str, matcherArg, args, vars) => {
            const arr = parseArray(args[0])
            arr.shift()
            return makeArray(arr)
        },
        alias: ['arrayshift'],
        description: 'Removes and discards the first element from a JSON array. Returns the modified array without the first element.\n\nUsage:: {{arrayshift::["a","b","c"]}} → ["b","c"]',
    });

    registerFunction({
        name: 'arraypop',
        callback: (str, matcherArg, args, vars) => {
            const arr = parseArray(args[0])
            arr.pop()
            return makeArray(arr)
        },
        alias: ['arraypop'],
        description: 'Removes and discards the last element from a JSON array. Returns the modified array without the last element.\n\nUsage:: {{arraypop::["a","b","c"]}} → ["a","b"]',
    });

    registerFunction({
        name: 'arraypush',
        callback: (str, matcherArg, args, vars) => {
            const arr = parseArray(args[0])
            arr.push(args[1])
            return makeArray(arr)
        },
        alias: ['arraypush'],
        description: 'Adds a new element to the end of a JSON array. Returns the modified array with the new element appended.\n\nUsage:: {{arraypush::["a","b"]::c}} → ["a","b","c"]',
    });

    registerFunction({
        name: 'arraysplice',
        callback: (str, matcherArg, args, vars) => {
            const arr = parseArray(args[0])
            arr.splice(Number(args[1]), Number(args[2]), args[3])
            return makeArray(arr)
        },
        alias: ['arraysplice'],
        description: 'Modifies an array by removing elements and optionally inserting new ones at a specific index. Parameters: array, startIndex, deleteCount, newElement.\n\nUsage:: {{arraysplice::["a","b","c"]::1::1::x}} → ["a","x","c"]',
    });

    registerFunction({
        name: 'arrayassert',
        callback: (str, matcherArg, args, vars) => {
            const arr = parseArray(args[0])
            const index = Number(args[1])
            if(index >= arr.length){
                arr[index] = args[2]
            }
            return makeArray(arr)
        },
        alias: ['arrayassert'],
        description: 'Sets an array element at the specified index only if the index is currently out of bounds (extends array). Fills gaps with undefined.\n\nUsage:: {{arrayassert::["a"]::5::b}} → array with element "b" at index 5',
    });

    registerFunction({
        name: 'makearray',
        callback: (str, matcherArg, args, vars) => {
            return makeArray(args)
        },
        alias: ['array', 'a', 'makearray'],
        description: 'Creates a JSON array from the provided arguments. Each argument becomes an array element. Variable number of arguments supported.\n\nUsage:: {{makearray::a::b::c}} → ["a","b","c"]',
    });

    registerFunction({
        name: 'makedict',
        callback: (str, matcherArg, args, vars) => {
            let out: {[key: string]: string} = {}
            for(let i=0;i<args.length;i++){
                const current = args[i]
                const firstEqual = current.indexOf('=')
                if(firstEqual === -1){
                    continue
                }
                const key = current.substring(0, firstEqual)
                const value = current.substring(firstEqual + 1)
                out[key] = value ?? 'null'
            }
            return JSON.stringify(out)
        },
        alias: ['dict', 'd', 'makedict', 'makeobject', 'object', 'o'],
        description: 'Creates a JSON object from key=value pair arguments. Each argument should be in "key=value" format. Invalid pairs are ignored.\n\nUsage:: {{makedict::name=John::age=25}} → {"name":"John","age":"25"}',
    });
}
