/**
 * Gemma Tokenizer 구현
 * 원본: src/ts/tokenizer.ts
 */

import type { GemmaTokenizer } from "@huggingface/transformers";
import { gemmaTokenizer } from './types';
import { getDefaultFileLoader } from './file-loader';

/**
 * Gemma Tokenizer로 텍스트 인코딩
 */
export async function gemmaTokenize(text: string): Promise<number[] | Uint32Array | Int32Array> {
    let currentTokenizer = gemmaTokenizer;
    
    if (!currentTokenizer) {
        const { GemmaTokenizer } = await import('@huggingface/transformers');
        const fileLoader = getDefaultFileLoader();
        const tokenData = await fileLoader.loadTokenFile("/token/llama/llama3.json");
        const jsonData = JSON.parse(new TextDecoder().decode(tokenData));
        currentTokenizer = new GemmaTokenizer(jsonData, {});
    }
    
    return currentTokenizer!.encode(text);
}
