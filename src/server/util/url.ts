/**
 * URL 및 URI 처리 함수들
 * 원본: src/ts/util.ts
 */

/**
 * URL에 경로를 추가
 * 
 * @param url - 기본 URL
 * @param lastPath - 추가할 경로
 * @returns 수정된 URL
 * 
 * @example
 * appendLastPath("https://github.com/kwaroran/Risuai", "/commits/main")
 * // returns 'https://github.com/kwaroran/Risuai/commits/main'
 */
export function appendLastPath(url: string, lastPath: string): string {
    // Remove trailing slash from url if exists
    url = url.replace(/\/$/, '');
    
    // Remove leading slash from lastPath if exists
    lastPath = lastPath.replace(/^\//, '');
    
    // Concat the url and lastPath
    return url + '/' + lastPath;
}

/**
 * 알려진 URI 형식인지 확인
 */
export function isKnownUri(uri: string): boolean {
    return uri.startsWith('http://')
        || uri.startsWith('https://')
        || uri.startsWith('ccdefault:')
        || uri.startsWith('embeded://');
}
