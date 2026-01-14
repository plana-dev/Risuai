/**
 * 이미지 임베딩 처리
 * 원본: src/ts/process/transformers.ts의 runImageEmbedding
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import type { ImageToTextOutput } from '@huggingface/transformers';

// TODO: transformers 모듈을 서버 사이드로 마이그레이션
// 현재는 클라이언트 사이드 버전을 임시로 사용
import { runImageEmbedding as runImageEmbeddingClient } from '../../../ts/process/transformers';

/**
 * 이미지 임베딩 실행 (이미지 캡셔닝)
 * 
 * @param dataurl - 이미지 데이터 URL (base64 또는 URL)
 * @returns 이미지 캡션 결과
 */
export async function runImageEmbedding(dataurl: string): Promise<ImageToTextOutput> {
    // TODO: 서버 사이드 transformers 모듈로 교체
    // 서버에서는 @huggingface/transformers를 Node.js 환경에서 실행해야 함
    return await runImageEmbeddingClient(dataurl);
}
