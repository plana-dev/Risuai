import { shuffle } from 'lodash';
import type { GroupOrder } from './types';
import type { ProcessContext } from '../context';

/**
 * Gets words from input string
 */
function getWords(data: string): string[] {
    const matches = data.split(/\n| /g);
    let words: string[] = [];
    if (!matches) {
        return [data];
    }
    for (const match of matches) {
        words.push(match.toLocaleLowerCase());
    }
    return words;
}

/**
 * Determines the order of characters in a group chat based on input
 * 
 * @param chars - Array of group order objects
 * @param input - User input string
 * @param context - Process context (for findCharacterbyId)
 * @returns Ordered array of group order objects
 */
export function groupOrder(chars: GroupOrder[], input: string, context: ProcessContext): GroupOrder[] {
    let order: GroupOrder[] = [];
    let ids: string[] = [];
    if (input) {
        const words = getWords(input);

        for (const word of words) {
            for (let char of chars) {
                const charData = context.findCharacterbyId(char.id);
                if (!charData) continue;
                
                const charNameChunks = getWords(charData.name);

                if (charNameChunks.includes(word)) {
                    order.push(char);
                    ids.push(char.id);
                    break;
                }
            }
        }
    }

    const shuffled = shuffle(chars);
    for (const char of shuffled) {
        if (ids.includes(char.id)) {
            continue;
        }

        const chance = char.talkness ?? 0.5;

        if (chance >= Math.random()) {
            order.push(char);
            ids.push(char.id);
        }
    }

    while (order.length === 0) {
        order.push(chars[Math.floor(Math.random() * chars.length)]);
    }

    return order;
}
