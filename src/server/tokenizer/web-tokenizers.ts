/**
 * Web Tokenizers 구현
 * 원본: src/ts/tokenizer.ts
 */

import type { Tokenizer } from "@mlc-ai/web-tokenizers";
import type { TokenizerType } from './types';
import { tokenizersTokenizer, tokenizersType } from './types';
import { getDefaultFileLoader } from './file-loader';

/**
 * Web Tokenizers로 텍스트 인코딩
 */
export async function tokenizeWebTokenizers(text: string, type: TokenizerType): Promise<number[] | Uint32Array | Int32Array> {
    let currentTokenizer = tokenizersTokenizer;
    let currentType = tokenizersType;
    const fileLoader = getDefaultFileLoader();

    if (type !== currentType || !currentTokenizer) {
        const webTokenizer = await import('@mlc-ai/web-tokenizers');
        
        switch (type) {
            case "novellist":
                currentTokenizer = await webTokenizer.Tokenizer.fromSentencePiece(
                    await fileLoader.loadTokenFile("/token/trin/spiece.model")
                );
                break;
            case "claude":
                currentTokenizer = await webTokenizer.Tokenizer.fromJSON(
                    await fileLoader.loadTokenFile("/token/claude/claude.json")
                );
                break;
            case 'llama3':
                currentTokenizer = await webTokenizer.Tokenizer.fromJSON(
                    await fileLoader.loadTokenFile("/token/llama/llama3.json")
                );
                break;
            case 'cohere':
                currentTokenizer = await webTokenizer.Tokenizer.fromJSON(
                    await fileLoader.loadTokenFile("/token/cohere/tokenizer.json")
                );
                break;
            case 'novelai':
                currentTokenizer = await webTokenizer.Tokenizer.fromSentencePiece(
                    await fileLoader.loadTokenFile("/token/nai/nerdstash_v2.model")
                );
                break;
            case 'llama':
                currentTokenizer = await webTokenizer.Tokenizer.fromSentencePiece(
                    await fileLoader.loadTokenFile("/token/llama/llama.model")
                );
                break;
            case 'mistral':
                currentTokenizer = await webTokenizer.Tokenizer.fromSentencePiece(
                    await fileLoader.loadTokenFile("/token/mistral/tokenizer.model")
                );
                break;
            case 'gemma':
                currentTokenizer = await webTokenizer.Tokenizer.fromSentencePiece(
                    await fileLoader.loadTokenFile("/token/gemma/tokenizer.model")
                );
                break;
            case 'DeepSeek':
                currentTokenizer = await webTokenizer.Tokenizer.fromJSON(
                    await fileLoader.loadTokenFile("/token/deepseek/tokenizer.json")
                );
                break;
        }
        currentType = type;
    }
    
    return currentTokenizer!.encode(text);
}
