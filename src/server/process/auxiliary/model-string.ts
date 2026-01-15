/**
 * 모델 문자열 변환
 * 원본: src/ts/process/models/modelString.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import type { Database } from '../../database';

/**
 * 생성 모델 이름을 문자열로 변환
 * 원본: src/ts/process/models/modelString.ts
 */
export function getGenerationModelString(
    database: Database, 
    name?: string,
    userId?: string
): string {
    const modelName = name ?? database.aiModel;
    
    switch (modelName) {
        case 'reverse_proxy':
            return 'custom-' + (database.reverseProxyOobaMode ? 'ooba' : (database.customProxyRequestModel || 'unknown'));
        case 'openrouter':
            return 'openrouter-' + (database.openrouterRequestModel || 'unknown');
        default:
            return modelName;
    }
}
