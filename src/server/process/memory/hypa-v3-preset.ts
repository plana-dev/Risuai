/**
 * HypaV3 Preset 관리
 * 원본: src/ts/process/memory/hypav3.ts
 */

import type { Database } from '../../database';
import type { HypaV3Preset, HypaV3Settings } from './types';

/**
 * 현재 HypaV3 Preset 가져오기
 */
export function getCurrentHypaV3Preset(database: Database): HypaV3Preset {
    const preset = database.hypaV3Presets?.[database.hypaV3PresetId];

    if (!preset) {
        throw new Error("Preset not found. Please select a valid preset.");
    }

    return preset;
}

/**
 * HypaV3 Preset 생성
 */
export function createHypaV3Preset(
    name = "New Preset",
    existingSettings: Partial<HypaV3Settings> = {}
): HypaV3Preset {
    const settings: HypaV3Settings = {
        summarizationModel: "subModel",
        summarizationPrompt: "",
        reSummarizationPrompt: "",
        memoryTokensRatio: 0.2,
        extraSummarizationRatio: 0,
        maxChatsPerSummary: 6,
        recentMemoryRatio: 0.4,
        similarMemoryRatio: 0.4,
        enableSimilarityCorrection: false,
        preserveOrphanedMemory: false,
        processRegexScript: false,
        doNotSummarizeUserMessage: false,
        // Experimental
        useExperimentalImpl: false,
        summarizationRequestsPerMinute: 20,
        summarizationMaxConcurrent: 1,
        embeddingRequestsPerMinute: 100,
        embeddingMaxConcurrent: 1,
        alwaysToggleOn: false,
    };

    if (
        existingSettings &&
        typeof existingSettings === "object" &&
        !Array.isArray(existingSettings)
    ) {
        for (const [key, value] of Object.entries(existingSettings)) {
            if (key in settings && typeof value === typeof (settings as any)[key]) {
                (settings as any)[key] = value;
            }
        }
    }

    return {
        name,
        settings,
    };
}
