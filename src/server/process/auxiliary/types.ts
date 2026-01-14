import type { OpenAIChat } from '../types';
import type { character } from '../../database';

/**
 * Group order type for group chat character ordering
 */
export type GroupOrder = {
    id: string;
    talkness: number;
    index: number;
};

/**
 * Script processing mode
 */
export type ScriptMode = 'editinput' | 'editoutput' | 'editprocess' | 'editdisplay';

/**
 * Unstringlizer chunks result
 */
export type UnstringlizerChunks = {
    chunks: string[];
    extChunk: string[];
};

/**
 * AIN output string extraction result
 */
export type AINOutputString = {
    content: string;
    character: string;
};

/**
 * AIN content type
 */
export type AINContent = {
    type: 'outside' | 'inside';
    content: string;
};
