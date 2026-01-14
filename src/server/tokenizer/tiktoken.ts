/**
 * Tiktoken 구현
 * 원본: src/ts/tokenizer.ts
 */

import type { Tiktoken } from "@dqbd/tiktoken";
import { tikParser, lastTikModel } from './types';

/**
 * Tiktoken으로 텍스트 인코딩
 */
export async function tikJS(text: string, model: string = 'cl100k_base'): Promise<number[] | Uint32Array | Int32Array> {
    let currentTikParser = tikParser;
    let currentLastModel = lastTikModel;

    if (!currentTikParser || currentLastModel !== model) {
        currentTikParser?.free();
        
        if (model === 'cl100k_base') {
            const { Tiktoken } = await import('@dqbd/tiktoken');
            const cl100k_base = await import("@dqbd/tiktoken/encoders/cl100k_base.json");
            
            currentTikParser = new Tiktoken(
                cl100k_base.bpe_ranks,
                cl100k_base.special_tokens,
                cl100k_base.pat_str
            );
            currentLastModel = model;
        } else if (model === 'o200k_base') {
            const { Tiktoken } = await import('@dqbd/tiktoken');
            const o200k_base = await import("src/etc/o200k_base.json");
            
            currentTikParser = new Tiktoken(
                o200k_base.bpe_ranks,
                o200k_base.special_tokens,
                o200k_base.pat_str
            );
            currentLastModel = model;
        }
    }
    
    return currentTikParser!.encode(text);
}
