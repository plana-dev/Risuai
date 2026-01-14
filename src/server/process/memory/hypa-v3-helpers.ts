/**
 * HypaMemory V3 헬퍼 함수들
 * 원본: src/ts/process/memory/hypav3.ts
 */

import type { OpenAIChat } from '../types';
import type { HypaV3Data, HypaV3Summary, SerializableHypaV3Data, SerializableHypaV3Summary } from './types';

export interface SummaryChunk {
    text: string;
    summary: HypaV3Summary;
}

/**
 * XML 태그로 감싸기
 */
export function wrapWithXml(tag: string, content: string): string {
    return `<${tag}>\n${content}\n</${tag}>`;
}

/**
 * Set이 subset인지 확인
 */
export function isSubset(subset: Set<string>, superset: Set<string>): boolean {
    for (const elem of subset) {
        if (!superset.has(elem)) {
            return false;
        }
    }
    return true;
}

/**
 * SerializableHypaV3Data를 HypaV3Data로 변환
 */
export function toHypaV3Data(serialData: SerializableHypaV3Data): HypaV3Data {
    const { lastSelectedSummaries, ...restData } = serialData;

    return {
        ...restData,
        summaries: serialData.summaries.map((summary) => ({
            ...summary,
            chatMemos: new Set(
                summary.chatMemos.map((memo) => (memo === null ? undefined : memo))
            ),
        })),
    };
}

/**
 * HypaV3Data를 SerializableHypaV3Data로 변환
 */
export function toSerializableHypaV3Data(data: HypaV3Data): SerializableHypaV3Data {
    return {
        ...data,
        summaries: data.summaries.map((summary) => ({
            ...summary,
            chatMemos: [...summary.chatMemos],
        })),
    };
}

/**
 * 고아 summary 정리
 */
export function cleanOrphanedSummary(chats: OpenAIChat[], data: HypaV3Data): void {
    const currentChatMemos = new Set(chats.map((chat) => chat.memo));
    const originalLength = data.summaries.length;

    data.summaries = data.summaries.filter((summary) => {
        return isSubset(summary.chatMemos, currentChatMemos);
    });

    const removedCount = originalLength - data.summaries.length;

    if (removedCount > 0) {
        console.log('[HypaV3]', `Cleaned ${removedCount} orphaned summaries.`);
    }
}

/**
 * Simple Comb Combiner (CC) - 여러 점수 리스트를 결합
 */
export function simpleCC<T>(
    scoredLists: [T, number][][],
    weightFunc?: (listIndex: number, totalLists: number) => number
): T[] {
    const scores = new Map<T, number>();

    for (let listIndex = 0; listIndex < scoredLists.length; listIndex++) {
        const list = scoredLists[listIndex];
        const weight = weightFunc
            ? weightFunc(listIndex, scoredLists.length)
            : 1 / scoredLists.length;

        for (const [item, score] of list) {
            scores.set(item, (scores.get(item) || 0) + score * weight);
        }
    }

    return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([item]) => item);
}

/**
 * Simple Reciprocal Rank Fusion (RRF)
 */
export function simpleRRF<T>(rankedLists: T[][], k: number = 60): T[] {
    const scores = new Map<T, number>();

    for (let listIndex = 0; listIndex < rankedLists.length; listIndex++) {
        const list = rankedLists[listIndex];

        for (let itemIndex = 0; itemIndex < list.length; itemIndex++) {
            const item = list[itemIndex];
            const rank = itemIndex + 1;
            const rrfTerm = 1 / (k + rank);

            scores.set(item, (scores.get(item) || 0) + rrfTerm);
        }
    }

    return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([item]) => item);
}

/**
 * Child to Parent RRF
 */
export function childToParentRRF<C, P>(
    rankedChildren: C[],
    parentFunc: (child: C) => P,
    k: number = 60
): P[] {
    const scores = new Map<P, number>();

    for (let childIndex = 0; childIndex < rankedChildren.length; childIndex++) {
        const child = rankedChildren[childIndex];
        const parent = parentFunc(child);
        const rank = childIndex + 1;
        const rrfTerm = 1 / (k + rank);

        scores.set(parent, (scores.get(parent) || 0) + rrfTerm);
    }

    return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([parent]) => parent);
}

/**
 * 점수 정규화
 */
export function normalizeScores<T>(scoredList: [T, number][]): [T, number][] {
    if (scoredList.length === 0) {
        return [];
    }

    const scores = scoredList.map(([, score]) => score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    if (minScore === maxScore) {
        if (minScore === 0) {
            return scoredList.map(([item]) => [item, 0]);
        }

        return scoredList.map(([item]) => [item, 1]);
    }

    return scoredList.map(([item, score]) => {
        const normalizedScore = (score - minScore) / (maxScore - minScore);
        return [item, normalizedScore];
    });
}
