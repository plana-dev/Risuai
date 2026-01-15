/**
 * HypaMemory 프로세서
 * 원본: src/ts/process/memory/hypamemory.ts
 * 
 * 서버 사이드에서는 localforage 대신 Redis 또는 데이터베이스를 사용
 */

import type { HypaModel, VectorArray, MemoryVector } from './types';
import type { Database } from '../../database';
import { chunkArray, similarity, localModels } from './base';
import { appendLastPath } from '../../util';
import { getRedisService } from '../../redis-service';
// runEmbedding은 서버 사이드에서 API 호출로 구현
// TODO: 로컬 모델 지원을 위해 transformers 모듈 마이그레이션 필요

/**
 * HypaMemory 프로세서 클래스
 * 서버 사이드에서는 Redis를 벡터 저장소로 사용
 */
export class HypaProcessor {
    oaikey: string;
    vectors: MemoryVector[];
    model: HypaModel;
    customEmbeddingUrl: string;
    private redis: ReturnType<typeof getRedisService>;
    private userId: string;
    private chatId: string;

    constructor(
        model: HypaModel | 'auto' = 'auto',
        customEmbeddingUrl?: string,
        userId?: string,
        chatId?: string,
        database?: Database
    ) {
        this.vectors = [];
        this.userId = userId || '';
        this.chatId = chatId || '';
        this.redis = getRedisService();

        if (model === 'auto') {
            this.model = database?.hypaModel || 'MiniLM';
        } else {
            this.model = model;
        }
        this.customEmbeddingUrl = customEmbeddingUrl?.trim() || database?.hypaCustomSettings?.url?.trim() || '';
        this.oaikey = database?.supaMemoryKey || '';
    }

    /**
     * 문서 임베딩 생성
     */
    async embedDocuments(texts: string[]): Promise<VectorArray[]> {
        const subPrompts = chunkArray(texts, 50);
        const embeddings: VectorArray[] = [];

        for (let i = 0; i < subPrompts.length; i += 1) {
            const input = subPrompts[i];
            const data = await this.getEmbeds(input);
            embeddings.push(...data);
        }

        return embeddings;
    }

    /**
     * 임베딩 가져오기
     */
    async getEmbeds(input: string[] | string, database?: Database): Promise<VectorArray[]> {
        const inputs: string[] = Array.isArray(input) ? input : [input];

        // 로컬 모델 사용 - API 기반으로 처리
        if (Object.keys(localModels.models).includes(this.model)) {
            // 서버 사이드에서는 로컬 모델 서버 API를 호출하거나 subModel을 사용
            // 로컬 모델 서버가 임베딩 API를 제공하는 경우 사용
            // 그렇지 않으면 subModel을 사용하여 임베딩 생성 (API 기반)
            
            // 방법 1: 로컬 모델 서버 API 호출 (임베딩 엔드포인트가 있는 경우)
            // 방법 2: subModel을 사용하여 임베딩 생성
            // 현재는 subModel을 사용하여 임베딩 생성 (API 기반)
            
            if (database?.subModel) {
                // subModel을 사용하여 임베딩 생성
                // 일반 LLM은 임베딩을 생성하지 않으므로, 커스텀 임베딩 URL을 사용하거나
                // 로컬 모델 서버의 임베딩 API를 호출해야 함
                
                // 로컬 모델 서버 임베딩 API 호출 시도
                try {
                    const localEmbeddingUrl = database.hypaCustomSettings?.url || 'http://localhost:10026/embeddings';
                    const response = await fetch(localEmbeddingUrl, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(database?.hypaCustomSettings?.key?.trim()
                                ? { Authorization: 'Bearer ' + database.hypaCustomSettings.key.trim() }
                                : {}),
                        },
                        method: 'POST',
                        body: JSON.stringify({
                            input: inputs,
                            model: localModels.models[this.model as keyof typeof localModels.models],
                        }),
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const result: number[][] = [];
                        for (let i = 0; i < data.data.length; i++) {
                            result.push(data.data[i].embedding);
                        }
                        return result;
                    }
                } catch (error) {
                    // 로컬 모델 서버 API 호출 실패 시 subModel 사용 안내
                    console.warn(`Local model embedding API failed, falling back to custom embedding URL or OpenAI: ${error}`);
                }
            }
            
            // 로컬 모델 서버 API가 없는 경우 커스텀 임베딩 URL 사용 또는 에러
            if (this.customEmbeddingUrl) {
                // 커스텀 임베딩 URL 사용 (아래 코드에서 처리)
            } else {
                throw new Error(
                    `Local model ${this.model} requires either a local embedding server API or custom embedding URL. ` +
                    `Please configure hypaCustomSettings.url or use OpenAI/custom embedding models.`
                );
            }
        }

        let gf = null;

        // 커스텀 모델
        if (this.model === 'custom') {
            if (!this.customEmbeddingUrl) {
                throw new Error('Custom model requires a Custom Server URL');
            }
            const replaceUrl = this.customEmbeddingUrl.endsWith('/embeddings')
                ? this.customEmbeddingUrl
                : appendLastPath(this.customEmbeddingUrl, 'embeddings');

            const fetchArgs = {
                headers: {
                    ...(database?.hypaCustomSettings?.key?.trim()
                        ? { Authorization: 'Bearer ' + database.hypaCustomSettings.key.trim() }
                        : {}),
                },
                body: {
                    input: input,
                    ...(database?.hypaCustomSettings?.model?.trim()
                        ? { model: database.hypaCustomSettings.model.trim() }
                        : {}),
                },
            };

            const response = await fetch(replaceUrl.toString(), {
                headers: {
                    'Content-Type': 'application/json',
                    ...(database?.hypaCustomSettings?.key?.trim()
                        ? { Authorization: 'Bearer ' + database.hypaCustomSettings.key.trim() }
                        : {}),
                },
                method: 'POST',
                body: JSON.stringify({
                    input: inputs,
                    ...(database?.hypaCustomSettings?.model?.trim()
                        ? { model: database.hypaCustomSettings.model.trim() }
                        : {}),
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }
            
            gf = {
                ok: response.ok,
                data: await response.json(),
            };
        }

        // OpenAI 모델
        if (this.model === 'ada' || this.model === 'openai3small' || this.model === 'openai3large') {
            const models = {
                ada: 'text-embedding-ada-002',
                openai3small: 'text-embedding-3-small',
                openai3large: 'text-embedding-3-large',
            };

            const response = await fetch('https://api.openai.com/v1/embeddings', {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + (this.oaikey?.trim() || database?.supaMemoryKey?.trim() || ''),
                },
                method: 'POST',
                body: JSON.stringify({
                    input: inputs,
                    model: models[this.model],
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }
            
            gf = {
                ok: response.ok,
                data: await response.json(),
            };
        }

        const data = gf?.data;

        if (!gf?.ok) {
            throw new Error(JSON.stringify(gf?.data));
        }

        const result: number[][] = [];
        for (let i = 0; i < data.data.length; i++) {
            result.push(data.data[i].embedding);
        }

        return result;
    }

    /**
     * 텍스트 테스트 (캐시 확인)
     */
    async testText(text: string): Promise<number[]> {
        const cacheKey = `hypa:vector:${this.userId}:${this.chatId}:${text}:${this.model}`;
        const forageResult: number[] | null = await this.redis.get(cacheKey);
        if (forageResult) {
            return forageResult;
        }
        const vec = (await this.embedDocuments([text]))[0] as number[];
        await this.redis.set(cacheKey, vec, 86400 * 7); // 7일 TTL
        return vec;
    }

    /**
     * 텍스트 추가
     */
    async addText(texts: string[], database?: Database): Promise<void> {
        const suffix =
            this.model === 'custom' && database?.hypaCustomSettings?.model?.trim()
                ? `-${database.hypaCustomSettings.model.trim()}`
                : '';

        // Redis에서 기존 벡터 로드
        for (let i = 0; i < texts.length; i++) {
            const cacheKey = `hypa:vector:${this.userId}:${this.chatId}:${texts[i]}:${this.model}${suffix}`;
            const itm: MemoryVector | null = await this.redis.get(cacheKey);
            if (itm) {
                itm.alreadySaved = true;
                this.vectors.push(itm);
            }
        }

        // 이미 있는 텍스트 필터링
        texts = texts.filter(v => {
            for (let i = 0; i < this.vectors.length; i++) {
                const existingContent = this.vectors[i].content || this.vectors[i].text;
                if (existingContent === v) {
                    return false;
                }
            }
            return true;
        });

        if (texts.length === 0) {
            return;
        }

        const vectors = await this.embedDocuments(texts);

        const memoryVectors: MemoryVector[] = vectors.map((embedding, idx) => ({
            content: texts[idx],
            text: texts[idx], // 하위 호환성
            embedding: embedding as number[],
        }));

        // Redis에 저장
        for (let i = 0; i < memoryVectors.length; i++) {
            const vec = memoryVectors[i];
            if (!vec.alreadySaved) {
                const cacheKey = `hypa:vector:${this.userId}:${this.chatId}:${texts[i]}:${this.model}${suffix}`;
                await this.redis.set(cacheKey, vec, 86400 * 7); // 7일 TTL
            }
        }

        this.vectors = memoryVectors.concat(this.vectors);
    }

    /**
     * 유사도 검색
     */
    async similaritySearch(query: string): Promise<string[]> {
        const results = await this.similaritySearchVectorWithScore((await this.getEmbeds(query))[0]);
        return results.map(result => result[0]);
    }

    /**
     * 점수가 포함된 유사도 검색
     */
    async similaritySearchScored(query: string): Promise<[string, number][]> {
        return await this.similaritySearchVectorWithScore((await this.getEmbeds(query))[0]);
    }

    /**
     * 벡터 기반 유사도 검색 (점수 포함)
     */
    private similaritySearchVectorWithScore(query: VectorArray): [string, number][] {
        const memoryVectors = this.vectors;
        const searches = memoryVectors
            .map((vector, index) => ({
                similarity: similarity(query, vector.embedding),
                index,
            }))
            .sort((a, b) => (a.similarity > b.similarity ? -1 : 0));

        const result: [string, number][] = searches.map(search => [
            memoryVectors[search.index].content || memoryVectors[search.index].text || '',
            search.similarity,
        ]);

        return result;
    }

    /**
     * 유사도 체크
     */
    similarityCheck(query1: number[], query2: number[]): number {
        return similarity(query1, query2);
    }
}
