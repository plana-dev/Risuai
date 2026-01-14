/**
 * CBS (Curly Bracket Syntax) 메인 등록 함수
 * 서버 사이드에서 사용할 수 있도록 모든 함수를 등록
 */

import type { CBSRegisterArg } from './types';
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

export function registerCBS(arg: CBSRegisterArg) {
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
