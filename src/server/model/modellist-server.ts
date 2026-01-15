/**
 * Model List 서버 사이드 구현
 * 원본: src/ts/model/modellist.ts의 getModelInfo 함수
 * userId 기반으로 데이터베이스 접근
 */

import type { Database } from '../database';
import { getDatabaseAdapter } from '../database-adapter';
import { getModelInfo as getModelInfoBase, LLMModels, type LLMModel, LLMProvider, LLMFormat, LLMTokenizer, OpenAIParameters } from './modellist';

/**
 * 서버 사이드 getModelInfo
 * userId를 받아서 데이터베이스에서 모델 정보를 가져옴
 */
export async function getModelInfo(
    id: string,
    userId?: string
): Promise<LLMModel> {
    let database: Database | null = null;

    if (userId) {
        const db = getDatabaseAdapter();
        database = await db.loadDatabase(userId);
    }

    // 기본 모델 리스트에서 찾기
    const found: LLMModel | undefined = JSON.parse(JSON.stringify(LLMModels.find(model => model.id === id))); // safeStructuredClone 대체

    if (found) {
        // 데이터베이스에서 custom flags 적용
        if (database?.enableCustomFlags) {
            found.flags = database.customFlags;
        }

        // Custom models 처리
        if (id.startsWith('xcustom:::')) {
            const customModels = database?.customModels || [];
            const customFound = customModels.find((model) => model.id === id);
            if (customFound) {
                return {
                    id: customFound.id,
                    name: customFound.name,
                    shortName: customFound.name,
                    fullName: customFound.name,
                    internalID: customFound.internalId,
                    provider: LLMProvider.AsIs,
                    format: customFound.format,
                    flags: customFound.flags,
                    parameters: [
                        'temperature',
                        'top_p',
                        'frequency_penalty',
                        'presence_penalty',
                        'repetition_penalty',
                        'min_p',
                        'top_a',
                        'top_k',
                        'thinking_tokens',
                    ],
                    tokenizer: customFound.tokenizer,
                };
            }
        }

        return found;
    }

    // 기본 모델 정보 반환
    return {
        id,
        name: id,
        shortName: id,
        fullName: id,
        internalID: id,
        provider: LLMProvider.AsIs,
        format: LLMFormat.OpenAICompatible,
        flags: [],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Unknown,
    };
}

// Re-export from modellist
export { LLMModels, LLMProvider, LLMFormat, LLMTokenizer, OpenAIParameters };
export type { LLMModel };
