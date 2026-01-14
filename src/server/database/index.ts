/**
 * 데이터베이스 관련 함수들의 메인 엔트리 포인트
 * 
 * 원본: src/ts/storage/database.svelte.ts
 * 서버 사이드에서는 데이터베이스 어댑터를 통해 동작합니다.
 */

// 타입 정의
export * from './types';

// 기본값 상수
export * from './defaults';

// 초기화 함수
export * from './initialize';

// 접근 함수
export * from './access';

// Preset 관련 함수
export * from './preset';
