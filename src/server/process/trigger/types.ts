/**
 * Trigger 관련 타입 정의
 * 원본: src/ts/process/triggers.ts
 */

import type { OpenAIChat } from '../types';

/**
 * 트리거 모드
 */
export type triggerMode = 'start' | 'manual' | 'output' | 'input' | 'display' | 'request';

/**
 * 트리거 스크립트
 */
export interface triggerscript {
    comment: string;
    type: triggerMode;
    conditions: triggerCondition[];
    effect: triggerEffect[];
    lowLevelAccess?: boolean;
}

/**
 * 트리거 조건
 */
export type triggerCondition =
    | triggerConditionsVar
    | triggerConditionsExists
    | triggerConditionsChatIndex;

/**
 * 변수 조건
 */
export type triggerConditionsVar = {
    type: 'var' | 'value';
    var: string;
    value: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'null' | 'true';
};

/**
 * 채팅 인덱스 조건
 */
export type triggerConditionsChatIndex = {
    type: 'chatindex';
    value: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'null' | 'true';
};

/**
 * 존재 조건
 */
export type triggerConditionsExists = {
    type: 'exists';
    value: string;
    type2: 'strict' | 'loose' | 'regex';
    depth: number;
};

/**
 * 트리거 이펙트
 */
export type triggerEffect = triggerEffectV1 | triggerCode | triggerEffectV2;

/**
 * V1 이펙트
 */
export type triggerEffectV1 =
    | triggerEffectCutChat
    | triggerEffectModifyChat
    | triggerEffectImgGen
    | triggerEffectRegex
    | triggerEffectRunLLM
    | triggerEffectCheckSimilarity
    | triggerEffectSendAIprompt
    | triggerEffectShowAlert
    | triggerEffectSetvar
    | triggerEffectSystemPrompt
    | triggerEffectImpersonate
    | triggerEffectCommand
    | triggerEffectStop
    | triggerEffectRunTrigger
    | triggerEffectRunAxLLM;

/**
 * 코드 이펙트
 */
export type triggerCode = {
    type: 'triggercode' | 'triggerlua';
    code: string;
};

/**
 * 추가 시스템 프롬프트
 */
export type additonalSysPrompt = {
    start: string;
    historyend: string;
    promptend: string;
};

// V1 이펙트 타입들
export interface triggerEffectSetvar {
    type: 'setvar';
    operator: '=' | '+=' | '-=' | '*=' | '/=';
    var: string;
    value: string;
}

export interface triggerEffectCutChat {
    type: 'cutchat';
    start: string;
    end: string;
}

export interface triggerEffectModifyChat {
    type: 'modifychat';
    index: string;
    value: string;
}

export interface triggerEffectSystemPrompt {
    type: 'systemprompt';
    location: 'start' | 'historyend' | 'promptend';
    value: string;
}

export interface triggerEffectImpersonate {
    type: 'impersonate';
    role: 'user' | 'char';
    value: string;
}

export interface triggerEffectCommand {
    type: 'command';
    value: string;
}

export interface triggerEffectRegex {
    type: 'extractRegex';
    value: string;
    regex: string;
    flags: string;
    result: string;
    inputVar: string;
}

export interface triggerEffectShowAlert {
    type: 'showAlert';
    alertType: string;
    value: string;
    inputVar: string;
}

export interface triggerEffectRunTrigger {
    type: 'runtrigger';
    value: string;
}

export interface triggerEffectStop {
    type: 'stop';
}

export interface triggerEffectSendAIprompt {
    type: 'sendAIprompt';
}

export interface triggerEffectImgGen {
    type: 'runImgGen';
    value: string;
    negValue: string;
    inputVar: string;
}

export interface triggerEffectCheckSimilarity {
    type: 'checkSimilarity';
    source: string;
    value: string;
    inputVar: string;
}

export interface triggerEffectRunLLM {
    type: 'runLLM';
    value: string;
    inputVar: string;
}

export interface triggerEffectRunAxLLM {
    type: 'runAxLLM';
    value: string;
    inputVar: string;
}

// V2 이펙트 타입들 (일부만 정의, 나머지는 필요시 추가)
export type triggerEffectV2 =
    | triggerV2Header
    | triggerV2IfVar
    | triggerV2Else
    | triggerV2EndIndent
    | triggerV2SetVar
    | triggerV2Loop
    | triggerV2BreakLoop
    | triggerV2RunTrigger
    | triggerV2ConsoleLog
    | triggerV2StopTrigger
    | triggerV2CutChat
    | triggerV2ModifyChat
    | triggerV2SystemPrompt
    | triggerV2Impersonate
    | triggerV2Command
    | triggerV2SendAIprompt
    | triggerV2ImgGen
    | triggerV2CheckSimilarity
    | triggerV2RunLLM
    | triggerV2ShowAlert
    | triggerV2ExtractRegex
    | triggerV2GetLastMessage
    | triggerV2GetMessageAtIndex
    | triggerV2GetMessageCount
    | triggerV2DeclareLocalVar
    | triggerV2Wait
    | triggerV2IfAdvanced;

export type triggerV2Header = {
    type: 'v2Header';
    code?: string;
    indent: number;
};

export type triggerV2IfVar = {
    type: 'v2If';
    condition: '=' | '!=' | '>' | '<' | '>=' | '<=' | '∈' | '∋' | '∉' | '∌' | '≒' | '≡';
    targetType: 'var' | 'value';
    target: string;
    source: string;
    sourceType?: 'var' | 'value';
    indent: number;
};

export type triggerV2Else = {
    type: 'v2Else';
    indent: number;
};

export type triggerV2EndIndent = {
    type: 'v2EndIndent';
    endOfLoop?: boolean;
    indent: number;
};

export type triggerV2SetVar = {
    type: 'v2SetVar';
    operator: '=' | '+=' | '-=' | '*=' | '/=' | '%=';
    var: string;
    valueType: 'var' | 'value';
    value: string;
    indent: number;
};

export type triggerV2Loop = {
    type: 'v2Loop';
    indent: number;
};

export type triggerV2BreakLoop = {
    type: 'v2BreakLoop';
    indent: number;
};

export type triggerV2RunTrigger = {
    type: 'v2RunTrigger';
    target: string;
    indent: number;
};

export type triggerV2ConsoleLog = {
    type: 'v2ConsoleLog';
    sourceType: 'var' | 'value';
    source: string;
    indent: number;
};

export type triggerV2StopTrigger = {
    type: 'v2StopTrigger';
    indent: number;
};

export type triggerV2CutChat = {
    type: 'v2CutChat';
    start: string;
    startType: 'var' | 'value';
    end: string;
    endType: 'var' | 'value';
    indent: number;
};

export type triggerV2ModifyChat = {
    type: 'v2ModifyChat';
    index: string;
    indexType: 'var' | 'value';
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2SystemPrompt = {
    type: 'v2SystemPrompt';
    location: 'start' | 'historyend' | 'promptend';
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2Impersonate = {
    type: 'v2Impersonate';
    role: 'user' | 'char';
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2Command = {
    type: 'v2Command';
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2SendAIprompt = {
    type: 'v2SendAIprompt';
    indent: number;
};

export type triggerV2ImgGen = {
    type: 'v2ImgGen';
    value: string;
    valueType: 'var' | 'value';
    negValue: string;
    negValueType: 'var' | 'value';
    outputVar: string;
    indent: number;
};

export type triggerV2CheckSimilarity = {
    type: 'v2CheckSimilarity';
    source: string;
    sourceType: 'var' | 'value';
    value: string;
    valueType: 'var' | 'value';
    outputVar: string;
    indent: number;
};

export type triggerV2RunLLM = {
    type: 'v2RunLLM';
    value: string;
    valueType: 'var' | 'value';
    model: 'model' | 'submodel';
    outputVar: string;
    indent: number;
};

export type triggerV2ShowAlert = {
    type: 'v2ShowAlert';
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2ExtractRegex = {
    type: 'v2ExtractRegex';
    value: string;
    valueType: 'var' | 'value';
    regex: string;
    regexType: 'var' | 'value';
    flags: string;
    flagsType: 'var' | 'value';
    result: string;
    resultType: 'var' | 'value';
    outputVar: string;
    indent: number;
};

export type triggerV2GetLastMessage = {
    type: 'v2GetLastMessage';
    outputVar: string;
    indent: number;
};

export type triggerV2GetMessageAtIndex = {
    type: 'v2GetMessageAtIndex';
    index: string;
    indexType: 'var' | 'value';
    outputVar: string;
    indent: number;
};

export type triggerV2GetMessageCount = {
    type: 'v2GetMessageCount';
    outputVar: string;
    indent: number;
};

export type triggerV2DeclareLocalVar = {
    type: 'v2DeclareLocalVar';
    var: string;
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2Wait = {
    type: 'v2Wait';
    value: string;
    valueType: 'var' | 'value';
    indent: number;
};

export type triggerV2IfAdvanced = {
    type: 'v2IfAdvanced';
    condition: '=' | '!=' | '>' | '<' | '>=' | '<=' | '∈' | '∋' | '∉' | '∌' | '≒' | '≡';
    targetType: 'var' | 'value';
    target: string;
    source: string;
    sourceType: 'var' | 'value';
    indent: number;
};

/**
 * 트리거 실행 결과
 */
export interface TriggerRunResult {
    chat?: any; // Chat 타입
    additonalSysPrompt?: additonalSysPrompt;
    stopSending?: boolean;
    sendAIprompt?: boolean;
}
