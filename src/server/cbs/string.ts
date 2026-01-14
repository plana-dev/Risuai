/**
 * CBS 문자열 조작 함수들
 * file, startswith, endswith, contains, replace, split, join, spread, trim, length, lower, upper, capitalize
 */

import type { CBSRegisterArg } from './types';

export function registerStringFunctions(arg: CBSRegisterArg) {
    const { registerFunction, makeArray, parseArray } = arg;

    registerFunction({
        name: 'file',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.displaying){
                return `<br><div class="risu-file">${args[0]}</div><br>`
            }
            return Buffer.from(args[1], 'base64').toString('utf-8')
        },
        alias: [],
        description: 'Handles file display or decoding. In display mode, shows filename in a formatted div. Otherwise, decodes base64 content to UTF-8 text.\n\nUsage:: {{file::filename::base64content}}',
    });

    registerFunction({
        name: 'startswith',
        callback: (str, matcherArg, args, vars) => {
            return args[0].startsWith(args[1]) ? '1' : '0'
        },
        alias: [],
        description: 'Checks if a string starts with a specific substring. Returns "1" if the string begins with the substring, "0" otherwise. Case-sensitive.\n\nUsage:: {{startswith::Hello World::Hello}}',
    });

    registerFunction({
        name: 'endswith',
        callback: (str, matcherArg, args, vars) => {
            return args[0].endsWith(args[1]) ? '1' : '0'
        },
        alias: [],
        description: 'Checks if a string ends with a specific substring. Returns "1" if the string ends with the substring, "0" otherwise. Case-sensitive.\n\nUsage:: {{endswith::Hello World::World}}',
    });

    registerFunction({
        name: 'contains',
        callback: (str, matcherArg, args, vars) => {
            return args[0].includes(args[1]) ? '1' : '0'
        },
        alias: [],
        description: 'Checks if a string contains a specific substring anywhere within it. Returns "1" if found, "0" otherwise. Case-sensitive.\n\nUsage:: {{contains::Hello World::lo Wo}}',
    });

    registerFunction({
        name: 'replace',
        callback: (str, matcherArg, args, vars) => {
            return args[0].replaceAll(args[1], args[2])
        },
        alias: [],
        description: 'Replaces all occurrences of a substring with a new string. Global replacement - changes every instance found. Case-sensitive.\n\nUsage:: {{replace::Hello World::o::0}} → Hell0 W0rld',
    });

    registerFunction({
        name: 'split',
        callback: (str, matcherArg, args, vars) => {
            return makeArray(args[0].split(args[1]))
        },
        alias: [],
        description: 'Splits a string into an array using the specified delimiter. Returns a JSON array of string parts.\n\nUsage:: {{split::apple,banana,cherry::,}} → ["apple","banana","cherry"]',
    });

    registerFunction({
        name: 'join',
        callback: (str, matcherArg, args, vars) => {
            return (parseArray(args[0])).join(args[1])
        },
        alias: [],
        description: 'Joins array elements into a single string using the specified separator. Takes a JSON array and delimiter.\n\nUsage:: {{join::["apple","banana"]::, }} → apple, banana',
    });

    registerFunction({
        name: 'spread',
        callback: (str, matcherArg, args, vars) => {
            return (parseArray(args[0])).join('::')
        },
        alias: [],
        description: 'Joins array elements into a single string using "::" as separator. Specialized version of join for CBS array spreading.\n\nUsage:: {{spread::["a","b","c"]}} → a::b::c',
    });

    registerFunction({
        name: 'trim',
        callback: (str, matcherArg, args, vars) => {
            return args[0].trim()
        },
        alias: [],
        description: 'Removes leading and trailing whitespace from a string. Does not affect whitespace in the middle of the string.\n\nUsage:: {{trim::  hello world  }} → hello world',
    });

    registerFunction({
        name: 'length',
        callback: (str, matcherArg, args, vars) => {
            return args[0].length.toString()
        },
        alias: [],
        description: 'Returns the character length of a string as a number. Counts all characters including spaces and special characters.\n\nUsage:: {{length::Hello}} → 5',
    });

    registerFunction({
        name: 'lower',
        callback: (str, matcherArg, args, vars) => {
            return args[0].toLocaleLowerCase()
        },
        alias: [],
        description: 'Converts all characters in a string to lowercase using locale-aware conversion. Handles international characters properly.\n\nUsage:: {{lower::Hello WORLD}} → hello world',
    });

    registerFunction({
        name: 'upper',
        callback: (str, matcherArg, args, vars) => {
            return args[0].toLocaleUpperCase()
        },
        alias: [],
        description: 'Converts all characters in a string to uppercase using locale-aware conversion. Handles international characters properly.\n\nUsage:: {{upper::Hello world}} → HELLO WORLD',
    });

    registerFunction({
        name: 'capitalize',
        callback: (str, matcherArg, args, vars) => {
            return args[0].charAt(0).toUpperCase() + args[0].slice(1)
        },
        alias: [],
        description: 'Capitalizes only the first character of a string, leaving the rest unchanged. Useful for sentence-case formatting.\n\nUsage:: {{capitalize::hello world}} → Hello world',
    });
}
