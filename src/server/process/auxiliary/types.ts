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

/**
 * Inlay Asset type
 */
export type InlayAsset = {
    id?: string;
    name: string;
    data: string; // base64 data URI
    ext: string;
    height?: number;
    width?: number;
    type: 'image' | 'video' | 'audio';
};

/**
 * File Process Result type
 */
export type FileProcessResult = {
    success: boolean;
    error?: string;
    data?: any;
    assetId?: string;
};
