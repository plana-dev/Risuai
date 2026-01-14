/**
 * ChatTokenizer 클래스
 * 원본: src/ts/tokenizer.ts
 */

import type { OpenAIChat, MultiModal } from '../process/types';
import type { Database } from '../database';
import type { TokenizerContext } from './types';
import { encode } from './encode';

export class ChatTokenizer {
    private chatAdditionalTokens: number;
    private useName: 'name' | 'noName';

    constructor(chatAdditionalTokens: number, useName: 'name' | 'noName') {
        this.chatAdditionalTokens = chatAdditionalTokens;
        this.useName = useName;
    }

    async tokenizeChat(
        data: OpenAIChat,
        context: TokenizerContext,
        args: {
            countThoughts?: boolean;
        } = {}
    ): Promise<number> {
        let encoded = (await encode(data.content, context)).length + this.chatAdditionalTokens;
        
        if (data.name && this.useName === 'name') {
            encoded += (await encode(data.name, context)).length + 1;
        }
        
        if (data.multimodals && data.multimodals.length > 0) {
            for (const multimodal of data.multimodals) {
                encoded += await this.tokenizeMultiModal(multimodal, context);
            }
        }
        
        if (data.thoughts && data.thoughts.length > 0 && args.countThoughts) {
            for (const thought of data.thoughts) {
                encoded += (await encode(thought, context)).length + 1;
            }
        }
        
        return encoded;
    }

    async tokenizeChats(
        data: OpenAIChat[],
        context: TokenizerContext
    ): Promise<number> {
        let encoded = 0;
        for (const chat of data) {
            encoded += await this.tokenizeChat(chat, context);
        }
        return encoded;
    }

    tokenizeMultiModal(
        data: MultiModal,
        context: TokenizerContext
    ): number {
        const { database } = context;
        
        // TODO: supportsInlayImage 체크 (서버 사이드 구현 필요)
        // if (!supportsInlayImage()) {
        //     return this.chatAdditionalTokens;
        // }
        
        if (database.gptVisionQuality === 'low') {
            return 87;
        }

        let encoded = this.chatAdditionalTokens;
        let height = data.height ?? 0;
        let width = data.width ?? 0;

        if (height === width) {
            if (height > 768) {
                height = 768;
                width = 768;
            }
        } else if (height > width) {
            if (width > 768) {
                width = 768;
                height = height * (768 / width);
            }
        } else {
            if (height > 768) {
                height = 768;
                width = width * (768 / height);
            }
        }

        const chunkSize = Math.ceil(width / 512) * Math.ceil(height / 512);
        encoded += chunkSize * 2;
        encoded += 85;

        return encoded;
    }
}
