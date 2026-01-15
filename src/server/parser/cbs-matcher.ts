/**
 * CBS 함수 매칭 관련
 * matcher, initMatcher
 */

import type { matcherArg, RegisterCallback } from '../cbs/types';

export interface MatcherContext {
    calcString: (str: string) => number;
    getMatcherMap: () => Map<string, RegisterCallback>;
    initMatcher: () => void;
}

export function matcher(
    p1: string,
    matcherArg: matcherArg,
    vars: { [key: string]: string } | null,
    context: MatcherContext
): {
    text: string,
    var: { [key: string]: string }
} | string | null {

    context.initMatcher()

    try {
        if (p1.startsWith('? ')) {
            const substring = p1.substring(2)
            return context.calcString(substring).toString()
        }
        const colonIndex = p1.indexOf(':')
        let splited: string[]
        if (colonIndex !== -1 && p1[colonIndex + 1] === ':') {
            splited = p1.split('::')
        }
        else {
            splited = p1.split(':')
        }
        const name = splited[0].toLocaleLowerCase().replace(/[\s_-]/g, '')
        const args = splited.slice(1)
        const callback = context.getMatcherMap().get(name)
        if (callback) {
            return callback(p1, matcherArg, args, vars)
        }
    } catch (error) { }

    return null
}
