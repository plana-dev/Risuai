/**
 * 프롬프트 토큰화
 * 원본: src/ts/process/prompt.ts
 */

import type { PromptItem } from './types';
import type { TokenizerContext } from '../../tokenizer';
import { tokenizeAccurate } from '../../tokenizer';

/**
 * 프롬프트 프리셋 토큰화
 */
export async function tokenizePreset(
    prompts: PromptItem[],
    context: TokenizerContext,
    consti: boolean = false
): Promise<number> {
    let total = 0;
    for (const prompt of prompts) {
        switch (prompt.type) {
            case 'plain':
            case 'jailbreak': {
                total += await tokenizeAccurate(prompt.text, context, consti);
                break;
            }
            case 'persona':
            case 'description':
            case 'lorebook':
            case 'postEverything':
            case 'authornote':
            case 'memory': {
                if (prompt.innerFormat) {
                    total += await tokenizeAccurate(prompt.innerFormat, context, consti);
                }
                break;
            }
        }
    }
    return total;
}
