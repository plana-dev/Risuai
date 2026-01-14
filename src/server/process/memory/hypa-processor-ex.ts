/**
 * HypaProcessor 확장 클래스 (SummaryChunk 지원)
 * 원본: src/ts/process/memory/hypav3.ts
 */

import { HypaProcessor } from './hypa-processor';
import type { MemoryVector } from './types';
import { similarity } from './base';
import type { SummaryChunk } from './hypa-v3-helpers';

interface SummaryChunkVector {
    chunk: SummaryChunk;
    vector: MemoryVector;
}

/**
 * HypaProcessor 확장 클래스
 * SummaryChunk를 지원하는 확장 버전
 */
export class HypaProcessorEx extends HypaProcessor {
    summaryChunkVectors: SummaryChunkVector[] = [];

    /**
     * SummaryChunks 추가
     */
    async addSummaryChunks(chunks: SummaryChunk[], database?: import('../../database').Database): Promise<void> {
        // Maintain the superclass's caching structure by adding texts
        const texts = chunks.map((chunk) => chunk.text);

        await this.addText(texts, database);

        // Create new SummaryChunkVectors
        const newSummaryChunkVectors: SummaryChunkVector[] = [];

        for (const chunk of chunks) {
            const vector = this.vectors.find((v) => v.content === chunk.text);

            if (!vector) {
                throw new Error(
                    `Failed to create vector for summary chunk:\n${chunk.text}`
                );
            }

            newSummaryChunkVectors.push({
                chunk,
                vector,
            });
        }

        // Append new SummaryChunkVectors to the existing collection
        this.summaryChunkVectors.push(...newSummaryChunkVectors);
    }

    /**
     * SummaryChunk 기반 유사도 검색 (점수 포함)
     */
    async similaritySearchScoredEx(
        query: string,
        database?: import('../../database').Database
    ): Promise<[SummaryChunk, number][]> {
        const queryVector = (await this.getEmbeds(query, database))[0];

        return this.summaryChunkVectors
            .map((scv) => ({
                chunk: scv.chunk,
                similarity: similarity(queryVector, scv.vector.embedding),
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .map((result) => [result.chunk, result.similarity]);
    }
}
