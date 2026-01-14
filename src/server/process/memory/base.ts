/**
 * Memory 기본 인터페이스 및 유틸리티
 * 원본: src/ts/process/memory/
 */

import type { VectorArray, MemoryVector } from './types';

/**
 * 벡터 유사도 계산
 */
export function similarity(a: VectorArray, b: VectorArray): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}

/**
 * 배열을 청크로 분할
 */
export function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
    return arr.reduce(
        (chunks, elem, index) => {
            const chunkIndex = Math.floor(index / chunkSize);
            const chunk = chunks[chunkIndex] || [];
            chunks[chunkIndex] = chunk.concat([elem]);
            return chunks;
        },
        [] as T[][]
    );
}

/**
 * 로컬 모델 설정
 */
export const localModels = {
    models: {
        MiniLM: 'Xenova/all-MiniLM-L6-v2',
        MiniLMGPU: 'Xenova/all-MiniLM-L6-v2',
        nomic: 'nomic-ai/nomic-embed-text-v1.5',
        nomicGPU: 'nomic-ai/nomic-embed-text-v1.5',
        bgeSmallEn: 'Xenova/bge-small-en-v1.5',
        bgeSmallEnGPU: 'Xenova/bge-small-en-v1.5',
        bgem3: 'Xenova/bge-m3',
        bgem3GPU: 'Xenova/bge-m3',
        multiMiniLM: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        multiMiniLMGPU: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        bgeM3Ko: 'HyperBlaze/BGE-m3-ko',
        bgeM3KoGPU: 'HyperBlaze/BGE-m3-ko',
    },
    gpuModels: [
        'MiniLMGPU',
        'nomicGPU',
        'bgeSmallEnGPU',
        'bgem3GPU',
        'multiMiniLMGPU',
        'bgeM3KoGPU',
    ],
} as const;
