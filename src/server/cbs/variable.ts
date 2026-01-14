/**
 * CBS 변수 관련 함수들
 * tempvar, settempvar, return, getvar, calc, addvar, setvar, setdefaultvar, getglobalvar
 */

import type { CBSRegisterArg } from './types';

export function registerVariableFunctions(arg: CBSRegisterArg) {
    const { registerFunction, getChatVar, setChatVar, getGlobalChatVar, calcString } = arg;

    registerFunction({
        name: 'tempvar',
        callback: (str, matcherArg, args, vars) => {
            return {
                text: vars?.[args[0]] ?? '',
                var: vars || {}
            }
        },
        alias: ['gettempvar'],
        description: 'Gets the value of a temporary variable by name. Temporary variables only exist during the current script execution. Returns empty string if variable doesn\'t exist.\n\nUsage:: {{tempvar::variableName}}',
    });

    registerFunction({
        name: 'settempvar',
        callback: (str, matcherArg, args, vars) => {
            if (!vars) vars = {};
            vars[args[0]] = args[1]
            return {
                text: '',
                var: vars
            }
        },
        alias: [],
        description: 'Sets a temporary variable to the specified value. Temporary variables only exist during current script execution. Always returns empty string.\n\nUsage:: {{settempvar::variableName::value}}',
    });

    registerFunction({
        name: 'return',
        callback: (str, matcherArg, args, vars) => {
            if (!vars) vars = {};
            vars['__return__'] = args[0]
            vars['__force_return__'] = '1'
            return {
                text: '',
                var: vars
            }
        },
        alias: [],
        description: 'Sets the return value and immediately exits script execution. Used to return values from script functions. Sets internal __return__ and __force_return__ variables.\n\nUsage:: {{return::value}}',
    });

    registerFunction({
        name: 'getvar',
        callback: (str, matcherArg, args, vars) => {
            return getChatVar(args[0])
        },
        alias: [],
        description: 'Gets the value of a persistent chat variable by name. Chat variables are saved with the chat and persist between sessions. Returns empty string if variable doesn\'t exist.\n\nUsage:: {{getvar::variableName}}',
    });

    registerFunction({
        name: 'calc',
        callback: (str, matcherArg, args, vars) => {
            return calcString(args[0]).toString()
        },
        alias: [],
        description: 'Evaluates a mathematical expression and returns the result as a string. Supports basic arithmetic operations (+, -, *, /, parentheses).\n\nUsage:: {{calc::2+2*3}}',
    });

    registerFunction({
        name: 'addvar',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.rmVar){
                return ''
            }
            if(matcherArg.runVar){
                setChatVar(args[0], (Number(getChatVar(args[0])) + Number(args[1])).toString())
                return ''
            }
            return null
        },
        alias: [],
        description: 'Adds a numeric value to an existing chat variable. Treats the variable as a number, adds the specified amount, and saves the result. Only executes when runVar is true.\n\nUsage:: {{addvar::counter::5}}',
    });

    registerFunction({
        name: 'setvar',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.rmVar){
                return ''
            }
            if(matcherArg.runVar){
                setChatVar(args[0], args[1])
                return ''
            }
            return null
        },
        alias: [],
        description: 'Sets a persistent chat variable to the specified value. Chat variables are saved with the chat and persist between sessions. Only executes when runVar is true.\n\nUsage:: {{setvar::variableName::value}}',
    });

    registerFunction({
        name: 'setdefaultvar',
        callback: (str, matcherArg, args, vars) => {
            if(matcherArg.rmVar){
                return ''
            }
            if(matcherArg.runVar){
                if(!getChatVar(args[0])){
                    setChatVar(args[0], args[1])
                }
                return ''
            }
            return null
        },
        alias: [],
        description: 'Sets a chat variable to the specified value only if the variable doesn\'t already exist or is empty. Used for setting default values. Only executes when runVar is true.\n\nUsage:: {{setdefaultvar::variableName::defaultValue}}',
    });

    registerFunction({
        name: 'getglobalvar',
        callback: (str, matcherArg, args, vars) => {
            return getGlobalChatVar(args[0])
        },
        alias: [],
        description: 'Gets the value of a global chat variable by name. Global variables are shared across all chats and characters. Returns empty string if variable doesn\'t exist.\n\nUsage:: {{getglobalvar::variableName}}',
    });
}
