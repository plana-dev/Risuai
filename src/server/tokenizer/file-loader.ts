/**
 * Tokenizer 파일 로더
 * 서버 사이드에서 tokenizer 모델 파일을 로드
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TokenizerFileLoader } from './types';

/**
 * 파일 시스템 기반 파일 로더
 */
export class FileSystemTokenizerLoader implements TokenizerFileLoader {
    private basePath: string;

    constructor(basePath: string = 'public') {
        this.basePath = basePath;
    }

    async loadTokenFile(filePath: string): Promise<ArrayBuffer> {
        // 서버 사이드에서는 public 폴더에서 파일 읽기
        const fullPath = path.join(this.basePath, filePath);
        const buffer = await fs.readFile(fullPath);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
}

/**
 * HTTP 기반 파일 로더 (클라이언트 또는 프록시 사용)
 */
export class HttpTokenizerLoader implements TokenizerFileLoader {
    private baseUrl: string;

    constructor(baseUrl: string = '') {
        this.baseUrl = baseUrl;
    }

    async loadTokenFile(filePath: string): Promise<ArrayBuffer> {
        const url = `${this.baseUrl}${filePath.startsWith('/') ? filePath : '/' + filePath}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load tokenizer file: ${url}`);
        }
        return await response.arrayBuffer();
    }
}

// 기본 파일 로더 인스턴스 (환경에 따라 선택)
let defaultLoader: TokenizerFileLoader | null = null;

export function getDefaultFileLoader(): TokenizerFileLoader {
    if (!defaultLoader) {
        // 서버 환경에서는 파일 시스템 사용
        if (typeof process !== 'undefined' && process.versions?.node) {
            defaultLoader = new FileSystemTokenizerLoader();
        } else {
            // 클라이언트 환경에서는 HTTP 사용
            defaultLoader = new HttpTokenizerLoader();
        }
    }
    return defaultLoader;
}

export function setDefaultFileLoader(loader: TokenizerFileLoader): void {
    defaultLoader = loader;
}
