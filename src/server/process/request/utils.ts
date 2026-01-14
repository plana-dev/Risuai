/**
 * Request 유틸리티 함수들
 * 원본: src/ts/process/request/request.ts
 */

import type { Database } from '../../database';
import type { Parameter, ParameterMap, ModelModeExtended } from './types';

/**
 * 객체에 중첩된 키로 값 설정
 */
export function setObjectValue<T>(obj: T, key: string, value: any): T {
    const splitKey = key.split('.');
    if (splitKey.length > 1) {
        const firstKey = splitKey.shift()!;
        if (!obj[firstKey as keyof T]) {
            (obj as any)[firstKey] = {};
        }
        (obj as any)[firstKey] = setObjectValue((obj as any)[firstKey], splitKey.join('.'), value);
        return obj;
    }

    (obj as any)[key] = value;
    return obj;
}

/**
 * 파라미터 적용
 */
export function applyParameters(
    data: { [key: string]: any },
    parameters: Parameter[],
    rename: ParameterMap,
    ModelMode: ModelModeExtended,
    database: Database,
    arg: {
        ignoreTopKIfZero?: boolean;
    } = {}
): { [key: string]: any } {
    function getEffort(effort: number): string {
        switch (effort) {
            case -1:
                return 'minimal';
            case 0:
                return 'low';
            case 1:
                return 'medium';
            case 2:
                return 'high';
            default:
                return 'medium';
        }
    }

    function getVerbosity(verbosity: number): string {
        switch (verbosity) {
            case 0:
                return 'low';
            case 1:
                return 'medium';
            case 2:
                return 'high';
            default:
                return 'medium';
        }
    }

    if (database.seperateParametersEnabled && ModelMode !== 'model') {
        if (ModelMode === 'submodel') {
            ModelMode = 'otherAx';
        }

        for (const parameter of parameters) {
            let value: number | string = 0;
            if (parameter === 'top_k' && arg.ignoreTopKIfZero && database.seperateParameters[ModelMode][parameter] === 0) {
                continue;
            }

            switch (parameter) {
                case 'temperature':
                    value = database.seperateParameters[ModelMode].temperature === -1000
                        ? -1000
                        : database.seperateParameters[ModelMode].temperature / 100;
                    break;
                case 'top_k':
                    value = database.seperateParameters[ModelMode].top_k;
                    break;
                case 'repetition_penalty':
                    value = database.seperateParameters[ModelMode].repetition_penalty;
                    break;
                case 'min_p':
                    value = database.seperateParameters[ModelMode].min_p;
                    break;
                case 'top_a':
                    value = database.seperateParameters[ModelMode].top_a;
                    break;
                case 'top_p':
                    value = database.seperateParameters[ModelMode].top_p;
                    break;
                case 'thinking_tokens':
                    value = database.seperateParameters[ModelMode].thinking_tokens;
                    break;
                case 'frequency_penalty':
                    value = database.seperateParameters[ModelMode].frequencyPenalty === -1000
                        ? -1000
                        : database.seperateParameters[ModelMode].frequencyPenalty / 100;
                    break;
                case 'presence_penalty':
                    value = database.seperateParameters[ModelMode].presencePenalty === -1000
                        ? -1000
                        : database.seperateParameters[ModelMode].presencePenalty / 100;
                    break;
                case 'reasoning_effort':
                    value = getEffort(database.seperateParameters[ModelMode].reasoningEffort);
                    break;
                case 'verbosity':
                    value = getVerbosity(database.seperateParameters[ModelMode].verbosity);
                    break;
            }

            if (value === -1000 || value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
                continue;
            }

            data = setObjectValue(data, rename[parameter] ?? parameter, value);
        }
        return data;
    }

    for (const parameter of parameters) {
        let value: number | string = 0;
        if (parameter === 'top_k' && arg.ignoreTopKIfZero && database.top_k === 0) {
            continue;
        }

        switch (parameter) {
            case 'temperature':
                value = database.temperature === -1000 ? -1000 : database.temperature / 100;
                break;
            case 'top_k':
                value = database.top_k;
                break;
            case 'repetition_penalty':
                value = database.repetition_penalty;
                break;
            case 'min_p':
                value = database.min_p;
                break;
            case 'top_a':
                value = database.top_a;
                break;
            case 'top_p':
                value = database.top_p;
                break;
            case 'reasoning_effort':
                value = getEffort(database.reasoningEffort);
                break;
            case 'verbosity':
                value = getVerbosity(database.verbosity);
                break;
            case 'frequency_penalty':
                value = database.frequencyPenalty === -1000 ? -1000 : database.frequencyPenalty / 100;
                break;
            case 'presence_penalty':
                value = database.PresensePenalty === -1000 ? -1000 : database.PresensePenalty / 100;
                break;
            case 'thinking_tokens':
                value = database.thinkingTokens;
                break;
        }

        if (value === -1000) {
            continue;
        }

        data = setObjectValue(data, rename[parameter] ?? parameter, value);
    }

    return data;
}
