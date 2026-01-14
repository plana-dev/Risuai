# Global API 분석 문서

## 개요

`src/ts/globalApi.svelte.ts`는 RisuAI 애플리케이션의 전역 API 함수들을 제공하는 핵심 모듈입니다. 파일 시스템 접근, HTTP 요청, 데이터베이스 저장/로드, 유틸리티 함수 등을 포함하며, Tauri, 웹, 모바일(Capacitor) 환경을 모두 지원합니다.

## 파일 통계

- **총 라인 수**: 2,192줄
- **Export된 함수**: 20개
- **Export된 클래스**: 5개
- **Export된 상수/변수**: 4개
- **사용처**: 83개 파일

## 주요 기능 카테고리

### 1. 파일 시스템 관련

#### 1.1 `downloadFile(name: string, dat: Uint8Array | ArrayBuffer | string)`
**설명**: 파일을 다운로드합니다.

**환경별 동작**:
- **Tauri**: `BaseDirectory.Download`에 파일 저장
- **웹**: Blob URL 생성 후 다운로드 트리거

**서버 사이드 개선**:
- 파일 다운로드 엔드포인트 제공
- Content-Disposition 헤더 설정
- 스트리밍 다운로드 지원

#### 1.2 `getFileSrc(loc: string): Promise<string>`
**설명**: 파일의 소스 URL을 반환합니다.

**환경별 동작**:
- **Tauri**: `convertFileSrc()`로 파일 경로 변환
- **웹 (계정 동기화)**: Hub URL 반환
- **Capacitor**: Capacitor 파일 시스템 URI 변환
- **Service Worker**: `/sw/img/` 경로 반환
- **일반 웹**: Base64 데이터 URL 반환

**서버 사이드 개선**:
- Supabase Storage URL 생성
- 서명된 URL 생성 (임시 접근)
- CDN URL 생성 (최적화된 이미지)

**주요 사용처**:
- `src/ts/parser.svelte.ts` - 에셋 파싱
- `src/ts/characterCards.ts` - 캐릭터 이미지 로드
- `src/lib/ChatScreens/AssetInput.svelte` - 에셋 입력

#### 1.3 `readImage(data: string): Promise<Uint8Array>`
**설명**: 이미지 파일을 읽어 Uint8Array로 반환합니다.

**환경별 동작**:
- **Tauri**: 파일 시스템에서 직접 읽기
- **웹**: LocalForage에서 읽기

**서버 사이드 개선**:
- Supabase Storage에서 파일 다운로드
- 스트리밍 읽기 지원
- 캐싱 전략 적용

#### 1.4 `saveAsset(data: Uint8Array, customId?: string, fileName?: string): Promise<string>`
**설명**: 에셋 파일을 저장하고 경로를 반환합니다.

**환경별 동작**:
- **Tauri**: `assets/{id}.{ext}` 경로에 저장
- **웹**: LocalForage에 저장

**서버 사이드 개선**:
- Supabase Storage에 업로드
- 파일 해시 기반 중복 검사
- 이미지 최적화 (리사이즈, 포맷 변환)

**주요 사용처**:
- `src/ts/characterCards.ts` - 캐릭터 이미지 저장
- `src/lib/ChatScreens/AssetInput.svelte` - 에셋 업로드
- `src/ts/process/stableDiff.ts` - 생성된 이미지 저장

#### 1.5 `loadAsset(id: string): Promise<Uint8Array>`
**설명**: 에셋 파일을 로드합니다.

**서버 사이드 개선**:
- Supabase Storage에서 다운로드
- 캐싱 레이어 추가
- 스트리밍 다운로드 지원

### 2. 데이터베이스 저장/로드

#### 2.1 `saveDb(): Promise<void>`
**설명**: 데이터베이스를 자동으로 저장합니다. 변경 사항을 추적하고 디바운싱하여 저장합니다.

**주요 기능**:
- Svelte 5 `$effect`를 사용한 변경 추적
- BroadcastChannel을 통한 다중 탭 동기화
- RisuSaveEncoder를 사용한 증분 저장
- 백업 파일 자동 생성

**저장 위치**:
- **Tauri**: `database/database.bin`, `database/dbbackup-{timestamp}.bin`
- **웹**: LocalForage `database/database.bin`
- **계정 동기화**: 원격 저장소에 동기화

**서버 사이드 개선**:
- Prisma를 통한 데이터베이스 저장
- Redis 캐싱
- 트랜잭션 처리
- 변경 이력 추적

**주요 사용처**:
- `src/ts/bootstrap.ts` - 초기화 후 저장
- 전역적으로 자동 호출됨

#### 2.2 `getDbBackups(): Promise<number[]>`
**설명**: 데이터베이스 백업 파일 목록을 반환합니다.

**기능**:
- 최대 20개 백업 유지
- 오래된 백업 자동 삭제
- 타임스탬프 배열 반환

**서버 사이드 개선**:
- 데이터베이스 스냅샷 관리
- 버전 관리 시스템
- 자동 백업 스케줄링

**주요 사용처**:
- `src/ts/bootstrap.ts` - 백업 파일 복원
- `src/ts/kei/backup.ts` - 백업 관리

#### 2.3 `loadInternalBackup(): Promise<void>`
**설명**: 내부 백업 파일을 로드합니다.

**서버 사이드 개선**:
- 데이터베이스 스냅샷 복원
- 롤백 기능
- 버전 선택 UI

### 3. HTTP 요청

#### 3.1 `globalFetch(url: string, arg?: GlobalFetchArgs): Promise<GlobalFetchResult>`
**설명**: 환경에 맞는 HTTP 요청을 수행합니다.

**환경별 구현**:
- **Plain Fetch**: `fetchWithPlainFetch()` - 일반 fetch 사용
- **UserScript Fetch**: `fetchWithUSFetch()` - 사용자 스크립트 제공 fetch
- **Tauri**: `fetchWithTauri()` - Tauri HTTP 플러그인
- **Capacitor**: `fetchWithCapacitor()` - Capacitor HTTP
- **Proxy**: `fetchWithProxy()` - 프록시 서버를 통한 요청

**특징**:
- CORS 우회 (프록시 사용)
- 로컬 호스트 요청 제한 (웹 환경)
- Risu 토큰 지원
- 요청 위치 설정 지원

**서버 사이드 개선**:
- 직접 HTTP 요청 (프록시 불필요)
- 요청 재시도 로직
- 타임아웃 설정
- 요청 큐 관리

**주요 사용처**:
- `src/ts/process/request/request.ts` - LLM API 요청
- `src/ts/process/request/openAI.ts` - OpenAI API
- `src/ts/process/request/anthropic.ts` - Anthropic API
- `src/ts/process/request/google.ts` - Google API

#### 3.2 `fetchNative(url: string, arg?: {...}): Promise<Response>`
**설명**: 네이티브 스트리밍 fetch를 수행합니다.

**특징**:
- ReadableStream 반환
- Tauri/Capacitor 네이티브 스트리밍 지원
- 프록시를 통한 스트리밍

**서버 사이드 개선**:
- Node.js 스트리밍 지원
- 청크 단위 처리
- 백프레셔 처리

**주요 사용처**:
- `src/ts/process/request/request.ts` - 스트리밍 응답 처리

#### 3.3 `textifyReadableStream(stream: ReadableStream<Uint8Array>): Promise<string>`
**설명**: ReadableStream을 텍스트로 변환합니다.

**서버 사이드 개선**:
- 버퍼 관리 최적화
- 큰 스트림 처리 개선

### 4. Fetch 로깅

#### 4.1 `addFetchLog(arg: {...}): number`
**설명**: Fetch 요청 로그를 추가합니다.

**로그 정보**:
- 요청 URL, Body, Headers
- 응답 Body, Headers
- 성공 여부
- 타임스탬프
- Chat ID

**서버 사이드 개선**:
- 데이터베이스에 로그 저장
- 로그 분석 도구
- 에러 추적

#### 4.2 `getFetchLogs(): fetchLog[]`
**설명**: Fetch 로그 배열을 반환합니다.

**서버 사이드 개선**:
- 페이지네이션 지원
- 필터링 기능
- 검색 기능

#### 4.3 `getRequestLog(): string`
**설명**: 요청 로그를 마크다운 형식으로 반환합니다.

**서버 사이드 개선**:
- 다양한 형식 지원 (JSON, CSV)
- 로그 내보내기 기능

#### 4.4 `getFetchData(id: string): fetchLog | null`
**설명**: 특정 Chat ID의 Fetch 로그를 반환합니다.

**서버 사이드 개선**:
- 인덱싱 최적화
- 빠른 검색

### 5. Writer 클래스들

#### 5.1 `TauriWriter`
**설명**: Tauri 환경용 파일 작성기.

**서버 사이드 개선**:
- Node.js Stream 기반 Writer
- 파일 시스템 직접 접근

#### 5.2 `LocalWriter`
**설명**: 로컬 파일 작성기 (Tauri/웹/모바일 지원).

**기능**:
- 파일 다이얼로그 (Tauri)
- StreamSaver (웹)
- Capacitor 파일 시스템 (모바일)

**서버 사이드 개선**:
- HTTP 응답 스트리밍
- 파일 다운로드 엔드포인트

#### 5.3 `VirtualWriter`
**설명**: 메모리 버퍼에 작성하는 가상 Writer.

**서버 사이드 개선**:
- 동일하게 사용 가능
- 버퍼 크기 제한 설정

#### 5.4 `BlankWriter`
**설명**: 아무 작업도 하지 않는 빈 Writer (호환성용).

**서버 사이드 개선**:
- 동일하게 사용 가능

#### 5.5 `AppendableBuffer`
**설명**: 추가/제거 가능한 버퍼 클래스.

**서버 사이드 개선**:
- 동일하게 사용 가능
- 메모리 최적화

### 6. 유틸리티 함수들

#### 6.1 `getBasename(data: string): string`
**설명**: 경로에서 파일명을 추출합니다.

**서버 사이드 개선**:
- 동일하게 사용 가능

**주요 사용처**:
- `src/ts/bootstrap.ts` - 파일 정리
- `src/ts/globalApi.svelte.ts` - 에셋 관리

#### 6.2 `getUnpargeables(db: Database, uptype?: 'basename' | 'pure'): string[]`
**설명**: 삭제하면 안 되는 리소스 목록을 반환합니다.

**포함 항목**:
- 사용자 아이콘
- 커스텀 배경
- 캐릭터 이미지
- 감정 이미지
- 추가 에셋
- 모듈 에셋
- 페르소나 아이콘
- 캐릭터 순서 이미지

**서버 사이드 개선**:
- 데이터베이스 쿼리로 최적화
- 캐싱 적용

**주요 사용처**:
- `src/ts/bootstrap.ts` - 불필요한 파일 정리

#### 6.3 `replaceDbResources(db: Database, replacer: {...}): Database`
**설명**: 데이터베이스의 리소스 경로를 교체합니다.

**서버 사이드 개선**:
- 데이터베이스 업데이트 쿼리
- 트랜잭션 처리

#### 6.4 `checkCharOrder(): void`
**설명**: 캐릭터 순서를 검사하고 업데이트합니다.

**기능**:
- 휴지통 항목 제외
- 순서 배열 정리
- 폴더 구조 유지

**서버 사이드 개선**:
- 데이터베이스 쿼리로 최적화
- 인덱싱 개선

**주요 사용처**:
- `src/App.svelte` - 캐릭터 임포트 후
- `src/ts/bootstrap.ts` - 초기화 시

#### 6.5 `openURL(url: string): void`
**설명**: URL을 적절한 환경에서 엽니다.

**환경별 동작**:
- **Tauri**: `open()` 플러그인 사용
- **웹**: `window.open()` 사용

**서버 사이드 개선**:
- 리다이렉트 응답 반환
- URL 검증

#### 6.6 `toggleFullscreen(): void`
**설명**: 전체화면 모드를 토글합니다.

**서버 사이드 개선**:
- 클라이언트 전용 기능 (제거)

#### 6.7 `trimNonLatin(data: string): string`
**설명**: 비라틴 문자를 제거하고 공백을 정리합니다.

**서버 사이드 개선**:
- 동일하게 사용 가능

#### 6.8 `getLanguageCodes(): {code: string, name: string}[]`
**설명**: 언어 코드 목록을 반환합니다.

**서버 사이드 개선**:
- 데이터베이스 또는 설정 파일에서 로드
- 캐싱 적용

#### 6.9 `getVersionString(): string`
**설명**: 버전 문자열을 반환합니다.

**서버 사이드 개선**:
- 환경 변수에서 로드
- 패키지 버전 사용

#### 6.10 `toGetter<T>(getterFn: () => T, args?: {...}): T`
**설명**: Getter 함수를 프록시 객체로 변환합니다.

**특징**:
- 속성 접근 제한 지원
- 함수 바인딩 자동 처리

**서버 사이드 개선**:
- 동일하게 사용 가능

### 7. AI 법률 관련

#### 7.1 `aiLawApplies(): boolean`
**설명**: AI 법률이 적용되는지 확인합니다.

**현재 구현**:
- 항상 `true` 반환 (안전을 위해)

**서버 사이드 개선**:
- IP 기반 지역 감지
- 사용자 설정 기반
- 실제 법률 적용 여부 확인

#### 7.2 `aiWatermarkingLawApplies(): boolean`
**설명**: AI 워터마킹 법률이 적용되는지 확인합니다.

**현재 구현**:
- 항상 `false` 반환

**서버 사이드 개선**:
- 지역별 법률 데이터베이스
- 동적 확인

### 8. 채팅 관련

#### 8.1 `chatFoldedState`
**설명**: 채팅 접힘 상태를 관리하는 Svelte 상태.

**서버 사이드 개선**:
- 데이터베이스에 저장
- 사용자별 설정

#### 8.2 `foldChatToMessage(targetMessageIdOrIndex: string | number): void`
**설명**: 특정 메시지로 채팅을 접습니다.

**서버 사이드 개선**:
- API 엔드포인트 제공
- 상태 저장

#### 8.3 `changeChatTo(IdOrIndex: string | number): void`
**설명**: 특정 채팅으로 전환합니다.

**서버 사이드 개선**:
- API 엔드포인트 제공
- 권한 검사

#### 8.4 `createChatCopyName(originalName: string, type: 'Copy' | 'Branch'): string`
**설명**: 채팅 복사/분기 이름을 생성합니다.

**서버 사이드 개선**:
- 데이터베이스 쿼리로 중복 확인
- 트랜잭션 처리

### 9. 성능 디버깅

#### 9.1 `PerformanceDebugger`
**설명**: 성능 측정을 위한 디버깅 클래스.

**기능**:
- 시작/종료 시간 측정
- 평균 시간 계산
- 콘솔 테이블 출력
- 여러 인스턴스 결합

**서버 사이드 개선**:
- 로깅 시스템 통합
- 메트릭 수집
- APM 도구 연동

### 10. Storage 관련

#### 10.1 `forageStorage: AutoStorage`
**설명**: 자동 저장소 인스턴스 (LocalForage 래퍼).

**서버 사이드 개선**:
- 데이터베이스 어댑터로 교체
- Redis 캐싱 레이어 추가

**주요 사용처**:
- 전역적으로 사용됨
- `src/ts/bootstrap.ts` - 초기화
- `src/ts/storage/autoStorage.ts` - 구현

#### 10.2 `setUsingSw(value: boolean): void`
**설명**: Service Worker 사용 여부를 설정합니다.

**서버 사이드 개선**:
- 클라이언트 전용 기능 (제거)

#### 10.3 `saving: $state<{state: boolean}>`
**설명**: 저장 중 상태를 나타내는 Svelte 상태.

**서버 사이드 개선**:
- 작업 큐 상태로 대체
- 진행률 추적

#### 10.4 `requiresFullEncoderReload: $state<{state: boolean}>`
**설명**: 인코더 전체 재로드 필요 여부.

**서버 사이드 개선**:
- 데이터베이스 마이그레이션 플래그로 대체

## 사용처 분석

### 주요 사용 파일

1. **`src/ts/bootstrap.ts`** (14회)
   - `forageStorage`, `saveDb`, `getDbBackups`, `getUnpargeables`, `getBasename`, `setUsingSw`, `checkCharOrder`

2. **`src/ts/characterCards.ts`** (13회)
   - `downloadFile`, `forageStorage`, `loadAsset`, `saveAsset`, `readImage`, `checkCharOrder`, `openURL`, `LocalWriter`, `VirtualWriter`, `AppendableBuffer`, `BlankWriter`

3. **`src/ts/process/request/request.ts`** (7회)
   - `globalFetch`, `fetchNative`

4. **`src/lib/ChatScreens/AssetInput.svelte`** (3회)
   - `saveAsset`, `getFileSrc`, `loadAsset`

5. **`src/ts/parser.svelte.ts`** (7회)
   - `getFileSrc`, `hasher` (imported from parser)

## 서버 사이드 개선 방안

### 1. 파일 시스템 모듈 분리

```
src/server/api/
├── file-system.ts      # 파일 시스템 관련 함수
│   ├── getFileSrc()
│   ├── saveAsset()
│   ├── loadAsset()
│   ├── readImage()
│   └── downloadFile()
├── storage.ts          # Storage 관련
│   └── StorageAdapter (인터페이스)
└── supabase-storage.ts # Supabase Storage 구현
```

### 2. HTTP 요청 모듈 분리

```
src/server/api/
├── http.ts             # HTTP 요청 관련
│   ├── globalFetch()
│   ├── fetchNative()
│   └── fetchWithProxy()
└── fetch-logger.ts     # Fetch 로깅
    ├── addFetchLog()
    ├── getFetchLogs()
    └── getRequestLog()
```

### 3. 데이터베이스 저장 모듈 분리

```
src/server/api/
├── database-save.ts    # 데이터베이스 저장
│   ├── saveDb()
│   ├── getDbBackups()
│   └── loadInternalBackup()
└── database-utils.ts   # 유틸리티
    ├── checkCharOrder()
    ├── getUnpargeables()
    └── replaceDbResources()
```

### 4. Writer 클래스 모듈 분리

```
src/server/api/
└── writers.ts          # Writer 클래스들
    ├── ServerWriter    # 서버용 Writer
    ├── VirtualWriter   # 가상 Writer
    ├── BlankWriter     # 빈 Writer
    └── AppendableBuffer
```

### 5. 공통 유틸리티 모듈

```
src/server/api/
└── utils.ts            # 유틸리티 함수들
    ├── getBasename()
    ├── trimNonLatin()
    ├── getLanguageCodes()
    ├── getVersionString()
    └── toGetter()
```

## 마이그레이션 체크리스트

### Phase 1: 파일 시스템 모듈

- [ ] `getFileSrc()` 서버 사이드 구현 (Supabase Storage)
- [ ] `saveAsset()` 서버 사이드 구현
- [ ] `loadAsset()` 서버 사이드 구현
- [ ] `readImage()` 서버 사이드 구현
- [ ] `downloadFile()` API 엔드포인트 생성

### Phase 2: HTTP 요청 모듈

- [ ] `globalFetch()` 서버 사이드 구현 (프록시 제거)
- [ ] `fetchNative()` 서버 사이드 구현
- [ ] Fetch 로깅 시스템 구현
- [ ] 요청 재시도 로직 추가
- [ ] 타임아웃 설정

### Phase 3: 데이터베이스 저장 모듈

- [ ] `saveDb()` Prisma 기반 구현
- [ ] 변경 추적 시스템 구현
- [ ] 백업 시스템 구현
- [ ] `checkCharOrder()` 최적화

### Phase 4: Writer 클래스

- [ ] `ServerWriter` 클래스 구현
- [ ] HTTP 스트리밍 지원
- [ ] 파일 다운로드 엔드포인트

### Phase 5: 유틸리티 함수

- [ ] 공통 유틸리티 함수 분리
- [ ] 서버 사이드 최적화
- [ ] 타입 안전성 보장

## 주의사항

### 1. 환경별 분기 처리

모든 함수는 환경별로 다른 동작을 하므로, 서버 사이드에서는:
- Tauri API 제거
- Capacitor API 제거
- 브라우저 전용 API 제거
- Service Worker 관련 코드 제거

### 2. 비동기 처리

대부분의 함수가 비동기이므로:
- Promise 체이닝 최적화
- 에러 핸들링 강화
- 타임아웃 설정

### 3. 캐싱 전략

서버 사이드에서는:
- Redis 캐싱 적용
- 파일 메타데이터 캐싱
- 요청 로그 캐싱

### 4. 보안

- 파일 업로드 검증
- 경로 트래버설 방지
- 권한 검사
- Rate limiting

## 참고 자료

- [BOOTSTRAP_ANALYSIS.md](./BOOTSTRAP_ANALYSIS.md) - 초기화 시스템 분석
- [BACKEND_MIGRATION_ANALYSIS.md](./BACKEND_MIGRATION_ANALYSIS.md) - 백엔드 마이그레이션 분석
- [INFRASTRUCTURE_SETUP.md](./impl/INFRASTRUCTURE_SETUP.md) - 인프라 설정 가이드

## 결론

`globalApi.svelte.ts`는 애플리케이션의 핵심 API를 제공하는 중요한 모듈입니다. 서버 사이드로 마이그레이션할 때는:

1. **환경별 분기 제거**: 서버 전용 구현으로 교체
2. **모듈화**: 기능별로 파일 분리
3. **인터페이스 추상화**: 다양한 구현체 지원
4. **성능 최적화**: 캐싱, 스트리밍, 병렬 처리
5. **보안 강화**: 검증, 권한, Rate limiting

이를 통해 클라이언트와 서버 모두에서 사용 가능한 통합 API를 구축할 수 있습니다.
