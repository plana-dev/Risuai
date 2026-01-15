/**
 * CBS (Curly Bracket Syntax) 메인 등록 함수
 * 서버 사이드에서 사용할 수 있도록 모든 함수를 등록
 */

import type { CBSRegisterArg, RegisterCallback } from './types';
import { registerBasicFunctions } from './basic';
import { registerCharacterFunctions } from './character';
import { registerPromptFunctions } from './prompt';
import { registerTimeFunctions } from './time';
import { registerVariableFunctions } from './variable';
import { registerMetadataFunctions } from './metadata';
import { registerComparisonFunctions } from './comparison';
import { registerStringFunctions } from './string';
import { registerArrayFunctions } from './array';
import { registerMathFunctions } from './math';
import { registerRandomFunctions } from './random';
import { registerDisplayFunctions } from './display';
import { registerControlFunctions } from './control';
import { registerAssetFunctions } from './asset';
import { registerUtilityFunctions } from './utility';
import { registerEncryptionFunctions } from './encryption';

// Matcher 맵 (싱글톤)
const matcherMap = new Map<string, RegisterCallback>();
let matcherInitialized = false;

/**
 * Matcher 초기화
 * 원본: src/ts/parser.svelte.ts의 initMatcher
 */
export function initMatcher(arg: CBSRegisterArg) {
    if (matcherInitialized) {
        return;
    }

    registerCBS(arg);
    matcherInitialized = true;
}

/**
 * Matcher 맵 가져오기
 */
export function getMatcherMap(): Map<string, RegisterCallback> {
    return matcherMap;
}

export function registerCBS(arg: CBSRegisterArg) {
    // Matcher 맵에 함수 등록
    const originalRegisterFunction = arg.registerFunction;
    arg.registerFunction = function (funcArg: {
        name: string;
        callback: RegisterCallback | 'doc_only';
        alias: string[];
        description: string;
        deprecated?: {
            message: string;
            since?: string;
            replacement?: string;
        };
        internalOnly?: boolean;
    }) {
        // 원본 함수 호출
        originalRegisterFunction(funcArg);

        // Matcher 맵에 등록
        const callback = funcArg.callback;
        if (callback !== 'doc_only') {
            const names = [funcArg.name, ...funcArg.alias];
            for (const name of names) {
                matcherMap.set(name.toLowerCase().replace(/[\s_-]/g, ''), callback);
            }
        }
    };

    // 모든 함수 그룹 등록
    registerBasicFunctions(arg);
    registerCharacterFunctions(arg);
    registerPromptFunctions(arg);
    registerTimeFunctions(arg);
    registerVariableFunctions(arg);
    registerMetadataFunctions(arg);
    registerComparisonFunctions(arg);
    registerStringFunctions(arg);
    registerArrayFunctions(arg);
    registerMathFunctions(arg);
    registerRandomFunctions(arg);
    registerDisplayFunctions(arg);
    registerControlFunctions(arg);
    registerAssetFunctions(arg);
    registerUtilityFunctions(arg);
    registerEncryptionFunctions(arg);
}

// 타입 및 기본값 재export
export * from './types';
