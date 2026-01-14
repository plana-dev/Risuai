/**
 * Realm Hub 통합 함수들
 * 
 * TODO: 추후 서비스 웹 마켓플레이스와 연동 예정
 * 
 * 이 파일의 함수들은 현재 클라이언트 전용이며,
 * 서버 사이드에서는 마켓플레이스 API를 통해 구현될 예정입니다.
 */

import type { hubType, GetRisuHubArg, DownloadRisuHubArg, ShareRisuHubArg } from './types';
import type { character } from '../database';

/**
 * Realm Hub URL
 * TODO: 서버 사이드에서는 환경 변수나 설정에서 가져와야 함
 */
export const hubURL = process.env.HUB_URL || 'https://sv.risuai.xyz';

/**
 * Realm 정보를 가져옵니다.
 * 
 * TODO: 서버 사이드에서는 마켓플레이스 API를 통해 구현
 * @param realmPath - Realm 경로
 */
export async function getRealmInfo(realmPath: string): Promise<hubType | null> {
    // TODO: 마켓플레이스 API 연동
    // const response = await fetch(`${hubURL}/hub/info/${realmPath}`);
    // return await response.json();
    throw new Error('Not implemented: 마켓플레이스 API 연동 필요');
}

/**
 * Realm Hub에서 캐릭터 목록을 가져옵니다.
 * 
 * TODO: 서버 사이드에서는 마켓플레이스 API를 통해 구현
 * @param arg - 검색 옵션
 */
export async function getRisuHub(arg: GetRisuHubArg): Promise<hubType[]> {
    // TODO: 마켓플레이스 API 연동
    // const stringArg = `search==${arg.search}&&page==${arg.page}&&nsfw==${arg.nsfw}&&sort==${arg.sort}&&web==server`;
    // const response = await fetch(`${hubURL}/realm/${encodeURIComponent(stringArg)}`);
    // return await response.json();
    throw new Error('Not implemented: 마켓플레이스 API 연동 필요');
}

/**
 * Realm Hub에서 캐릭터를 다운로드합니다.
 * 
 * TODO: 서버 사이드에서는 마켓플레이스 API를 통해 구현
 * @param id - Realm ID
 * @param arg - 다운로드 옵션
 */
export async function downloadRisuHub(
    id: string,
    arg: DownloadRisuHubArg = {}
): Promise<void> {
    // TODO: 마켓플레이스 API 연동
    // 1. 마켓플레이스에서 캐릭터 데이터 가져오기
    // 2. importCharacterCardSpec()를 사용하여 임포트
    // 3. 데이터베이스에 저장
    throw new Error('Not implemented: 마켓플레이스 API 연동 필요');
}

/**
 * Realm Hub 리소스를 가져옵니다.
 * 
 * TODO: 서버 사이드에서는 마켓플레이스 API를 통해 구현
 * @param id - 리소스 ID
 */
export async function getHubResources(id: string): Promise<Uint8Array> {
    // TODO: 마켓플레이스 API 연동
    // const response = await fetch(`${hubURL}/resource/${id}`);
    // return new Uint8Array(await response.arrayBuffer());
    throw new Error('Not implemented: 마켓플레이스 API 연동 필요');
}

/**
 * Realm Hub에 캐릭터를 공유합니다.
 * 
 * TODO: 서버 사이드에서는 마켓플레이스 API를 통해 구현
 * @param char - 공유할 캐릭터
 * @param arg - 공유 옵션
 */
export async function shareRisuHub2(
    char: character,
    arg: ShareRisuHubArg
): Promise<void> {
    // TODO: 마켓플레이스 API 연동
    // 1. exportCharacterCard()를 사용하여 캐릭터 익스포트
    // 2. 마켓플레이스 API에 업로드
    // 3. 업로드 결과를 데이터베이스에 저장
    throw new Error('Not implemented: 마켓플레이스 API 연동 필요');
}
