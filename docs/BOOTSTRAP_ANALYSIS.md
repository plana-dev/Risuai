# Bootstrap 초기화 시스템 분석

## 개요

`src/ts/bootstrap.ts`는 RisuAI 애플리케이션의 핵심 초기화 시스템입니다. 애플리케이션 시작 시 모든 필수 데이터를 로드하고, 환경별 설정을 적용하며, UI 상태를 초기화하는 역할을 담당합니다.

## 파일 구조

```
src/ts/bootstrap.ts
├── loadData()              # 메인 초기화 함수
├── checkNewFormat()        # 데이터베이스 포맷 마이그레이션
├── pargeChunks()          # 불필요한 파일 정리
├── assignIds()            # ID 할당
├── registerSw()           # Service Worker 등록
├── updateErrorHandling()  # 에러 핸들링 설정
└── updateHeightMode()     # 높이 모드 설정
```

## 초기화 프로세스

### 1. 메인 초기화 함수: `loadData()`

애플리케이션 시작 시 실행되는 핵심 함수입니다. `main.ts`에서 호출되며, 다음 순서로 초기화를 수행합니다.

#### 1.1 환경별 데이터 로드

**Tauri (데스크톱) 환경:**
```typescript
- 디렉토리 생성 (database, assets)
- 저장 파일 읽기 (database/database.bin)
- 백업 파일 복원 (손상 시)
- 업데이트 체크
- 전체화면 모드 설정
```

**웹/모바일 환경:**
```typescript
- LocalForage 초기화
- 로컬 저장 파일 로드
- 계정 동기화 체크
- 원격 저장 파일 로드 (계정 동기화 시)
- Drive Sync 체크
- Service Worker 등록
- 첫 설정 시 캐릭터 URL 임포트
```

#### 1.2 불필요한 파일 정리 (`pargeChunks()`)

- 사용하지 않는 에셋 파일 삭제
- 계정 동기화 사용 시 스킵
- Tauri: 파일 시스템 기반 정리
- 웹: LocalForage 인덱스 기반 정리

#### 1.3 플러그인 로드 (`loadPlugins()`)

- 설치된 플러그인 초기화
- 플러그인 API 등록

#### 1.4 계정 데이터 로드 (`loadRisuAccountData()`)

- 계정 정보가 있는 경우에만 실행
- 사용자 계정 데이터 동기화

#### 1.5 포맷 업데이트 체크 (`checkNewFormat()`)

- 데이터베이스 포맷 버전 마이그레이션
- 레거시 데이터 변환
- 데이터 무결성 검사
- 캐릭터 데이터 정규화

#### 1.6 UI 상태 초기화

```typescript
updateColorScheme()        // 색상 테마 적용
updateTextThemeAndCSS()    // 텍스트 테마 및 CSS 업데이트
updateAnimationSpeed()     // 애니메이션 속도 설정
updateHeightMode()         // 높이 모드 설정
updateErrorHandling()      // 에러 핸들링 설정
updateGuisize()            // GUI 크기 설정
```

#### 1.7 최종 설정

```typescript
- 모바일 GUI 초기화 (조건부)
- DOM 관찰 시작 (startObserveDom())
- ID 할당 (assignIds())
- Cold Data 생성 (makeColdData())
- 데이터베이스 저장 (saveDb())
- 모듈 업데이트 (moduleUpdate())
```

### 2. 데이터베이스 포맷 마이그레이션: `checkNewFormat()`

#### 2.1 데이터 무결성 검사

```typescript
- 캐릭터 데이터 정규화
- 필수 필드 기본값 설정
- null/undefined 필터링
```

#### 2.2 포맷 버전별 마이그레이션

**Format Version 2:**
- 에셋 경로 정규화
- `assets/` 접두사 추가

**Format Version 3:**
- Stable Diffusion 데이터 기본값 설정

**Format Version 4:**
- 마이그레이션 제거됨 (이슈로 인해)

**Format Version 5:**
- Lorebook 토큰 최소값 설정 (8000)

#### 2.3 레거시 프롬프트 업데이트

```typescript
- oldMainPrompt → defaultMainPrompt
- oldJailbreak → defaultJailbreak
```

#### 2.4 휴지통 정리

- 3일 이상 된 휴지통 항목 자동 삭제

### 3. 불필요한 파일 정리: `pargeChunks()`

#### 3.1 정리 대상 파일 식별

```typescript
- 사용 중인 에셋: 유지
- 미사용 에셋: 삭제
- 계정 동기화 사용 시: 스킵
```

#### 3.2 환경별 구현

**Tauri:**
```typescript
- readDir()로 assets 디렉토리 스캔
- getUnpargeables()로 보호 목록 확인
- remove()로 파일 삭제
```

**웹:**
```typescript
- forageStorage.keys()로 인덱스 스캔
- assets/ 접두사 확인
- forageStorage.removeItem()로 삭제
```

### 4. ID 할당: `assignIds()`

#### 4.1 캐릭터 ID 할당

```typescript
- chaId가 없는 경우 UUID 생성
- 중복 ID 검사 및 재할당
```

#### 4.2 채팅 ID 할당

```typescript
- chat.id가 없는 경우 UUID 생성
- 중복 ID 검사 및 재할당
```

### 5. Service Worker 등록: `registerSw()`

```typescript
- /sw.js 등록
- /sw/init 엔드포인트 호출
- 실패 시 페이지 리로드
```

### 6. 에러 핸들링 설정: `updateErrorHandling()`

```typescript
- window.addEventListener('error', ...)
- window.addEventListener('unhandledrejection', ...)
- alertError()로 에러 표시
```

### 7. 높이 모드 설정: `updateHeightMode()`

```typescript
- CSS 변수 --risu-height-size 설정
- 지원 모드: auto, vh, dvh, lvh, svh, percent
```

## 환경별 차이점

### Tauri (데스크톱)

```typescript
✅ 파일 시스템 직접 접근
✅ BaseDirectory.AppData 사용
✅ 전체화면 모드 지원
✅ 업데이트 체크
❌ Service Worker 미사용
❌ LocalForage 미사용
```

### 웹/모바일

```typescript
✅ LocalForage 사용
✅ Service Worker 지원
✅ 계정 동기화
✅ Drive Sync
✅ PWA 모드 지원
❌ 파일 시스템 직접 접근 불가
```

## 서버 사이드 초기화 고려사항

### 1. 클라이언트 전용 기능 분리

다음 기능들은 서버 사이드에서 제거하거나 대체해야 합니다:

```typescript
❌ DOM 조작 (updateColorScheme, updateTextThemeAndCSS)
❌ Service Worker 등록
❌ LocalForage 사용
❌ Tauri API 사용
❌ 브라우저 전용 API (navigator.serviceWorker, window.matchMedia)
```

### 2. 서버 사이드 초기화 항목

```typescript
✅ 데이터베이스 연결 초기화
✅ Redis 연결 초기화
✅ Supabase 클라이언트 초기화
✅ 플러그인 시스템 초기화 (서버 사이드 버전)
✅ 에러 핸들링 설정
✅ 로깅 시스템 초기화
✅ 환경 변수 검증
```

### 3. 공통 초기화 항목

```typescript
✅ 데이터베이스 포맷 마이그레이션
✅ 데이터 무결성 검사
✅ ID 할당
✅ 플러그인 로드
✅ 모듈 업데이트
```

## 클라이언트/서버 초기화 분리 방안

### 1. 초기화 모듈 분리

```
src/
├── ts/
│   └── bootstrap/
│       ├── client.ts        # 클라이언트 전용 초기화
│       ├── server.ts        # 서버 전용 초기화
│       ├── common.ts        # 공통 초기화
│       └── types.ts         # 타입 정의
└── server/
    └── bootstrap/
        ├── index.ts         # 서버 초기화 진입점
        ├── database.ts      # 데이터베이스 초기화
        ├── redis.ts         # Redis 초기화
        └── services.ts      # 서비스 초기화
```

### 2. 공통 초기화 함수

```typescript
// src/ts/bootstrap/common.ts
export async function initializeCommon() {
    // 데이터베이스 포맷 마이그레이션
    await checkNewFormat();
    
    // 데이터 무결성 검사
    await validateDataIntegrity();
    
    // ID 할당
    assignIds();
    
    // 플러그인 로드
    await loadPlugins();
    
    // 모듈 업데이트
    moduleUpdate();
}
```

### 3. 클라이언트 전용 초기화

```typescript
// src/ts/bootstrap/client.ts
export async function initializeClient() {
    // 환경별 데이터 로드
    if (isTauri) {
        await loadTauriData();
    } else {
        await loadWebData();
    }
    
    // UI 상태 초기화
    updateColorScheme();
    updateTextThemeAndCSS();
    updateAnimationSpeed();
    updateHeightMode();
    updateGuisize();
    
    // Service Worker 등록
    if (navigator.serviceWorker) {
        await registerSw();
    }
    
    // DOM 관찰 시작
    startObserveDom();
    
    // 공통 초기화
    await initializeCommon();
}
```

### 4. 서버 전용 초기화

```typescript
// src/server/bootstrap/index.ts
export async function initializeServer() {
    // 데이터베이스 연결
    await initializeDatabase();
    
    // Redis 연결
    await initializeRedis();
    
    // Supabase 클라이언트
    await initializeSupabase();
    
    // 서비스 초기화
    await initializeServices();
    
    // 에러 핸들링
    setupErrorHandling();
    
    // 로깅 초기화
    initializeLogging();
    
    // 공통 초기화
    await initializeCommon();
}
```

## 초기화 순서 다이어그램

### 클라이언트 초기화

```
main.ts
  └─> loadData() (client.ts)
       ├─> 환경 감지 (Tauri/Web)
       ├─> 데이터 로드
       │   ├─> Tauri: 파일 시스템
       │   └─> Web: LocalForage
       ├─> 불필요한 파일 정리
       ├─> 플러그인 로드
       ├─> 계정 데이터 로드
       ├─> 포맷 업데이트 체크
       ├─> UI 상태 초기화
       ├─> Service Worker 등록
       ├─> DOM 관찰 시작
       ├─> ID 할당
       ├─> Cold Data 생성
       ├─> 데이터베이스 저장
       └─> 모듈 업데이트
```

### 서버 초기화

```
server/index.ts
  └─> initializeServer()
       ├─> 데이터베이스 연결
       ├─> Redis 연결
       ├─> Supabase 클라이언트
       ├─> 서비스 초기화
       │   ├─> DatabaseAdapter
       │   ├─> RedisService
       │   ├─> AssetService
       │   └─> LuaService
       ├─> 에러 핸들링 설정
       ├─> 로깅 초기화
       ├─> 포맷 업데이트 체크
       ├─> 데이터 무결성 검사
       ├─> ID 할당
       ├─> 플러그인 로드 (서버 버전)
       └─> 모듈 업데이트
```

## 마이그레이션 체크리스트

### Phase 1: 공통 초기화 분리

- [ ] `checkNewFormat()` 함수를 `common.ts`로 이동
- [ ] `assignIds()` 함수를 `common.ts`로 이동
- [ ] 데이터 무결성 검사 함수 분리
- [ ] 공통 타입 정의 (`types.ts`)

### Phase 2: 클라이언트 초기화 분리

- [ ] 환경별 데이터 로드 함수 분리
- [ ] UI 상태 초기화 함수 분리
- [ ] Service Worker 등록 함수 분리
- [ ] DOM 관련 초기화 함수 분리
- [ ] `client.ts` 생성 및 통합

### Phase 3: 서버 초기화 구현

- [ ] 데이터베이스 연결 초기화
- [ ] Redis 연결 초기화
- [ ] Supabase 클라이언트 초기화
- [ ] 서비스 초기화 (ServiceManager)
- [ ] 에러 핸들링 설정
- [ ] 로깅 시스템 초기화
- [ ] `server/bootstrap/index.ts` 생성

### Phase 4: 통합 및 테스트

- [ ] 클라이언트 초기화 테스트
- [ ] 서버 초기화 테스트
- [ ] 공통 초기화 테스트
- [ ] 환경별 초기화 검증
- [ ] 에러 핸들링 테스트

## 주의사항

### 1. 초기화 순서

초기화 순서가 중요합니다. 다음 순서를 유지해야 합니다:

1. 환경 감지
2. 데이터 로드
3. 데이터 검증 및 마이그레이션
4. 서비스 초기화
5. UI 상태 초기화
6. 최종 설정

### 2. 에러 처리

초기화 중 에러가 발생하면:

- 사용자에게 명확한 에러 메시지 표시
- 백업 데이터 복원 시도
- 로그 기록
- 부분 초기화 허용 (가능한 경우)

### 3. 성능 최적화

- 비동기 초기화 병렬 처리
- 불필요한 초기화 스킵
- 로딩 상태 표시
- 점진적 초기화 (필수 → 선택)

### 4. 환경 변수

초기화에 필요한 환경 변수:

```typescript
// 클라이언트
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_RISU_LITE
VITE_RISU_TOS

// 서버
DATABASE_URL
REDIS_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## 참고 자료

- [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md) - 인프라 설정 가이드
- [BACKEND_MIGRATION_ANALYSIS.md](./BACKEND_MIGRATION_ANALYSIS.md) - 백엔드 마이그레이션 분석
- [SERVICE_WEB_DESIGN.md](./SERVICE_WEB_DESIGN.md) - 서비스 웹 디자인

## 결론

`bootstrap.ts`는 애플리케이션의 초기화를 담당하는 핵심 시스템입니다. 클라이언트와 서버 사이드 초기화를 분리하여 재사용 가능한 모듈로 구성하면, 유지보수성과 확장성을 크게 향상시킬 수 있습니다.

주요 개선 사항:
1. 공통 초기화 로직 분리
2. 환경별 초기화 분리
3. 서버 사이드 초기화 구현
4. 타입 안전성 보장
5. 에러 핸들링 강화
