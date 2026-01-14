/**
 * Anthropic (Claude) API 구현
 * 원본: src/ts/process/request/anthropic.ts
 * 
 * TODO: 전체 구현 필요 - 현재는 기본 구조만 제공
 */

import type { Database } from '../../database';
import type { RequestDataArgumentExtended, RequestDataResponse } from './types';

/**
 * Claude API 요청
 */
export async function requestClaude(
    arg: RequestDataArgumentExtended,
    database: Database,
    userId: string
): Promise<RequestDataResponse> {
    // TODO: 전체 구현 필요
    // 원본 파일이 매우 크므로 (982 lines) 단계적으로 구현 필요
    
    return {
        type: 'fail',
        result: 'Anthropic API implementation in progress',
    };
}
