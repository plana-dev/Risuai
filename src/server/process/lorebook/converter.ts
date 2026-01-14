/**
 * Lorebook 변환 함수들
 * 원본: src/ts/process/lorebook.svelte.ts
 */

import type { loreBook } from '../../database';
import type { CCLorebook } from './types';

/**
 * 외부 Lorebook 형식을 Risuai 형식으로 변환
 */
export function convertExternalLorebook(entries: { [key: string]: CCLorebook }): loreBook[] {
    let lore: loreBook[] = [];
    for (const key in entries) {
        const currentLore = entries[key];
        lore.push({
            key: currentLore.key
                ? currentLore.key.join(', ')
                : currentLore.keys
                  ? currentLore.keys.join(', ')
                  : currentLore.keywords
                    ? currentLore.keywords.join(', ')
                    : '',
            insertorder:
                currentLore.order ??
                currentLore.priority ??
                currentLore?.contextConfig?.budgetPriority ??
                0,
            comment: currentLore.comment || currentLore.name || currentLore.displayName || '',
            content: currentLore.content || currentLore.entry || currentLore.text || '',
            mode: 'normal',
            alwaysActive: currentLore.constant ?? currentLore.forceActivation ?? false,
            secondkey: currentLore.secondary_keys ? currentLore.secondary_keys.join(', ') : '',
            selective: currentLore.selective ?? false,
        });
    }
    return lore;
}
