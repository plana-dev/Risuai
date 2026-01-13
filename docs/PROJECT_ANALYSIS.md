# RisuAI 프로젝트 구조 분석 및 서비스화 개선 방안

## 1. 프로젝트 개요

RisuAI는 오픈소스 AI 채팅 애플리케이션으로, Svelte 5, TypeScript, Tauri를 기반으로 구축되었습니다. 현재는 로컬 실행 환경에서 동작하도록 설계되어 있으며, 다양한 AI 모델(OpenAI, Claude, Gemini 등)과의 통신을 지원합니다.

### 기술 스택
- **프론트엔드**: Svelte 5, TypeScript, Tailwind CSS
- **데스크톱**: Tauri 2.5
- **모바일**: Capacitor
- **빌드 도구**: Vite
- **상태 관리**: Svelte Stores ($state, $derived)
- **데이터 저장**: IndexedDB (localForage), LocalStorage

---

## 2. 핵심 아키텍처

### 2.1 애플리케이션 진입점

```
main.ts
  ├── preload.ts (플랫폼 감지 및 초기화)
  ├── database.svelte.ts (데이터베이스 초기화)
  ├── loadData() (데이터 로드)
  └── App.svelte (메인 컴포넌트)
```

**주요 흐름:**
1. `preload.ts`에서 플랫폼 감지 (Tauri/Web/Capacitor)
2. `database.svelte.ts`에서 로컬 데이터베이스 초기화
3. `loadData()`로 저장된 데이터 로드
4. `App.svelte`에서 UI 렌더링

### 2.2 상태 관리 구조

**Stores (`src/ts/stores.svelte.ts`):**
- `DBState`: 전역 데이터베이스 상태 (Svelte 5 $state 사용)
- `selectedCharID`: 현재 선택된 캐릭터 ID
- `loadedStore`: 로딩 상태
- `settingsOpen`: 설정 창 열림 상태
- 기타 UI 상태 관리

**데이터베이스 구조 (`src/ts/storage/database.svelte.ts`):**
```typescript
interface Database {
    characters: (character | groupChat)[]  // 캐릭터 및 그룹 채팅 목록
    apiType: string                        // API 타입
    openAIKey: string                      // API 키들
    claudeAPIKey: string
    // ... 수백 개의 설정 필드
    account?: {                            // 계정 정보 (옵션)
        token: string
        id: string
        data: { refresh_token, access_token, expires_in }
    }
}
```

### 2.3 데이터 저장 메커니즘

**현재 구조:**
- **로컬 저장**: IndexedDB (localForage) + LocalStorage
- **동기화**: Google Drive 백업 (선택적)
- **계정 시스템**: OAuth 2.0 (Sionyw) - 선택적 사용

**저장 위치:**
- Tauri: `AppData` 디렉토리
- Web: IndexedDB + LocalStorage
- Capacitor: 외부 저장소

**문제점:**
- 모든 데이터가 클라이언트에 저장됨
- 서버 없이 동작하므로 멀티 디바이스 동기화 어려움
- 사용자별 데이터 격리 없음

---

## 3. 핵심 기능 및 상호작용

### 3.1 채팅 처리 흐름

**메인 프로세스 (`src/ts/process/index.svelte.ts`):**

```
사용자 메시지 입력
  ↓
sendChat() 호출
  ↓
Stage 1: 데이터 준비
  - 현재 캐릭터 정보 로드
  - 채팅 히스토리 수집
  - 토큰 계산 및 컨텍스트 관리
  ↓
Stage 2: 프롬프트 구성
  - 메인 프롬프트
  - 캐릭터 설명
  - 페르소나 프롬프트
  - 채팅 히스토리
  - 재일브레이크
  - 로어북 (관련 항목만)
  - 전역 노트
  - 작성자 노트
  - 스크립트 처리
  - 모듈 통합
  ↓
Stage 3: AI 요청
  - 모델 선택 (aiModel/subModel)
  - API 요청 (requestChatDataMain)
  - 스트리밍 처리 (옵션)
  ↓
Stage 4: 응답 후처리
  - 응답 정리
  - 스크립트 처리
  - 트리거 실행
  - Inlay 처리
  - TTS 처리
  - 메모리 업데이트
  ↓
UI 업데이트
```

**API 요청 처리 (`src/ts/process/request/request.ts`):**

지원하는 AI 모델 형식:
- `LLMFormat.OpenAICompatible`: OpenAI, OpenRouter 등
- `LLMFormat.Anthropic`: Claude
- `LLMFormat.VertexAIGemini`: Google Gemini
- `LLMFormat.Ollama`: 로컬 Ollama
- `LLMFormat.Horde`: AI Horde
- `LLMFormat.WebLLM`: 브라우저 내 LLM
- 기타 다수

### 3.2 인증 시스템

**현재 구조:**
- **Sionyw OAuth**: 선택적 계정 시스템 (`src/ts/sionyw.ts`)
- **Google Drive OAuth**: 백업용 (`src/ts/drive/drive.ts`)
- **로컬 인증 없음**: 기본적으로 인증 없이 사용 가능

**인증 흐름:**
```
사용자 로그인 요청
  ↓
OAuth 2.0 PKCE 플로우 시작
  ↓
인증 서버로 리다이렉트
  ↓
인증 코드 수신
  ↓
토큰 교환 (Access Token + Refresh Token)
  ↓
DPoP 키 쌍 생성 (보안 강화)
  ↓
토큰 저장 (IndexedDB)
```

**문제점:**
- 인증이 선택적이므로 사용자 관리 어려움
- 서버 없이 토큰만 저장하므로 세션 관리 불가
- 멀티 디바이스 동기화를 위한 중앙 서버 없음

### 3.3 데이터 동기화

**현재 메커니즘:**
- **Google Drive 백업**: 수동 백업/복원
- **RisuAuth 동기화**: 계정 사용 시 선택적 동기화
- **로컬 파일**: Tauri 환경에서 파일 시스템 직접 접근

**동기화 흐름:**
```
로컬 데이터 변경
  ↓
수동 백업 트리거 (Google Drive)
  또는
자동 동기화 (RisuAuth - 제한적)
  ↓
원격 저장소에 업로드
  ↓
다른 디바이스에서 수동 복원
```

**문제점:**
- 실시간 동기화 없음
- 충돌 해결 메커니즘 없음
- 서버 없이 P2P만으로는 확장성 제한

---

## 4. 주요 컴포넌트 구조

### 4.1 UI 컴포넌트 계층

```
App.svelte
  ├── Sidebar.svelte (캐릭터 목록)
  ├── ChatScreen.svelte (채팅 화면)
  │   ├── DefaultChatScreen.svelte
  │   ├── ChatBody.svelte
  │   └── Chat.svelte
  ├── Settings.svelte (설정)
  └── 모달들 (Alert, Realm, Preset 등)
```

### 4.2 플러그인 시스템

**구조 (`src/ts/plugins/`):**
- `plugins.ts`: 플러그인 로더
- `pluginSafety.ts`: 보안 검사
- `jsSandbox.ts`: JavaScript 샌드박스 실행
- `apiV3/`: 플러그인 API v3

**플러그인 기능:**
- 커스텀 AI 프로바이더 추가
- UI 확장
- 기능 추가

### 4.3 모듈 시스템

**모듈 (`src/ts/process/modules.ts`):**
- 확장 가능한 기능 모듈
- 프롬프트에 자동 통합
- 동적 활성화/비활성화

---

## 5. 서비스화를 위한 개선 방안

### 5.1 현재 아키텍처의 한계

1. **서버 없음**
   - 모든 로직이 클라이언트에서 실행
   - 사용자 데이터가 로컬에만 저장
   - 멀티 유저 지원 불가

2. **인증 시스템 부재**
   - 선택적 OAuth만 존재
   - 사용자 세션 관리 없음
   - 권한 관리 시스템 없음

3. **데이터 격리 없음**
   - 모든 사용자가 같은 로컬 저장소 사용
   - 사용자별 데이터 분리 불가

4. **확장성 제한**
   - 클라이언트에서 모든 API 호출
   - API 키가 클라이언트에 노출
   - Rate limiting 관리 어려움

5. **동기화 문제**
   - 실시간 동기화 없음
   - 충돌 해결 메커니즘 없음
   - 오프라인/온라인 상태 관리 없음

### 5.2 서비스화 개선 단계

#### Phase 1: 백엔드 서버 구축

**필요한 구성 요소:**

1. **인증 서버**
   - 사용자 회원가입/로그인
   - JWT 토큰 발급
   - 세션 관리
   - OAuth 통합 (기존 Sionyw 유지 가능)

2. **API 게이트웨이**
   - AI API 프록시 (API 키 보호)
   - Rate limiting
   - 사용량 추적
   - 요청 로깅

3. **데이터베이스 서버**
   - 사용자 데이터 저장 (PostgreSQL/MongoDB)
   - 캐릭터 데이터 저장
   - 채팅 히스토리 저장
   - 인덱싱 및 검색

4. **동기화 서버**
   - 실시간 데이터 동기화 (WebSocket)
   - 충돌 해결
   - 오프라인 지원 (Queue)

**기술 스택 제안:**
- **백엔드**: Node.js (Express/Fastify) 또는 Python (FastAPI)
- **데이터베이스**: PostgreSQL (관계형) + Redis (캐시/세션)
- **실시간**: WebSocket (Socket.io 또는 ws)
- **인증**: JWT + Refresh Token
- **API 게이트웨이**: Kong 또는 자체 구현

#### Phase 2: 데이터 마이그레이션

**기존 데이터 구조 분석:**
- `Database` 인터페이스의 모든 필드를 데이터베이스 스키마로 변환
- 사용자별 데이터 분리
- 관계형 데이터 정규화

**마이그레이션 전략:**
1. 기존 로컬 데이터를 서버로 업로드
2. 사용자 계정 생성 및 데이터 연결
3. 점진적 마이그레이션 (하이브리드 모드)

#### Phase 3: 클라이언트 개선

**필요한 변경사항:**

1. **API 클라이언트**
   - REST API 호출로 변경
   - WebSocket 연결 (실시간 동기화)
   - 오프라인 큐 구현

2. **인증 통합**
   - 로그인/회원가입 UI
   - 토큰 관리 (자동 갱신)
   - 세션 유지

3. **데이터 동기화**
   - 실시간 동기화
   - 충돌 해결 UI
   - 오프라인 모드 지원

4. **로컬 캐싱**
   - IndexedDB를 캐시로 사용
   - 서버 데이터와 동기화
   - 오프라인 접근 지원

#### Phase 4: 보안 강화

1. **API 키 보호**
   - 클라이언트에서 API 키 제거
   - 서버에서 프록시로 처리
   - 사용량 제한 및 모니터링

2. **데이터 암호화**
   - 전송 중 암호화 (HTTPS)
   - 저장 시 암호화 (선택적)
   - 민감 정보 마스킹

3. **권한 관리**
   - 사용자별 권한 설정
   - 공유 캐릭터/채팅 관리
   - 접근 제어

#### Phase 5: 확장 기능

1. **멀티 유저 지원**
   - 공유 채팅방
   - 협업 기능
   - 실시간 협업

2. **커뮤니티 기능**
   - 캐릭터 공유 마켓플레이스
   - 프리셋 공유
   - 플러그인 마켓플레이스

3. **분석 및 모니터링**
   - 사용량 통계
   - 성능 모니터링
   - 에러 추적

---

## 6. 상세 기술 스펙

### 6.1 데이터베이스 스키마 설계

**사용자 테이블:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**캐릭터 테이블:**
```sql
CREATE TABLE characters (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    description TEXT,
    image_url TEXT,
    data JSONB,  -- 기존 character 인터페이스의 모든 필드
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**채팅 테이블:**
```sql
CREATE TABLE chats (
    id UUID PRIMARY KEY,
    character_id UUID REFERENCES characters(id),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    messages JSONB,  -- Message[] 배열
    metadata JSONB,  -- 기타 Chat 인터페이스 필드
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 6.2 API 엔드포인트 설계

**인증:**
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/logout` - 로그아웃

**캐릭터:**
- `GET /api/characters` - 캐릭터 목록
- `POST /api/characters` - 캐릭터 생성
- `GET /api/characters/:id` - 캐릭터 조회
- `PUT /api/characters/:id` - 캐릭터 수정
- `DELETE /api/characters/:id` - 캐릭터 삭제

**채팅:**
- `GET /api/chats` - 채팅 목록
- `POST /api/chats` - 채팅 생성
- `GET /api/chats/:id` - 채팅 조회
- `PUT /api/chats/:id` - 채팅 수정
- `POST /api/chats/:id/messages` - 메시지 전송
- `DELETE /api/chats/:id` - 채팅 삭제

**AI 프록시:**
- `POST /api/ai/chat` - AI 채팅 요청 (프록시)
- `GET /api/ai/models` - 사용 가능한 모델 목록

**동기화:**
- `WebSocket /ws/sync` - 실시간 동기화

### 6.3 클라이언트-서버 통신 프로토콜

**REST API:**
- 표준 HTTP 메서드 사용
- JSON 요청/응답
- JWT 토큰 인증 (Authorization 헤더)

**WebSocket:**
```typescript
// 클라이언트 → 서버
{
    type: 'sync',
    action: 'update' | 'delete' | 'create',
    resource: 'character' | 'chat' | 'message',
    data: {...}
}

// 서버 → 클라이언트
{
    type: 'sync',
    action: 'update' | 'delete' | 'create',
    resource: 'character' | 'chat' | 'message',
    data: {...},
    timestamp: number
}
```

---

## 7. 마이그레이션 전략

### 7.1 하이브리드 모드

**단계적 전환:**
1. **Phase 1**: 서버 구축, 클라이언트는 기존대로 로컬 저장
2. **Phase 2**: 선택적 동기화 (사용자가 선택)
3. **Phase 3**: 기본 동기화, 로컬은 캐시로 사용
4. **Phase 4**: 완전 서버 기반 (로컬 캐시만)

### 7.2 데이터 호환성

- 기존 `Database` 인터페이스 유지
- 서버 스키마와 매핑
- 자동 마이그레이션 스크립트

### 7.3 사용자 경험

- 기존 사용자는 점진적 마이그레이션
- 새 사용자는 서버 기반으로 시작
- 오프라인 모드 지원 유지

---

## 8. 다음 단계

1. **백엔드 프로토타입 개발**
   - 기본 인증 시스템
   - 데이터베이스 스키마
   - API 엔드포인트

2. **클라이언트 통합**
   - API 클라이언트 구현
   - 인증 플로우 통합
   - 데이터 동기화 로직

3. **테스트 및 배포**
   - 통합 테스트
   - 성능 테스트
   - 점진적 롤아웃

---

## 부록: 주요 파일 참조

### 핵심 파일 목록

- `src/App.svelte`: 메인 애플리케이션 컴포넌트
- `src/ts/stores.svelte.ts`: 전역 상태 관리
- `src/ts/storage/database.svelte.ts`: 데이터베이스 인터페이스
- `src/ts/process/index.svelte.ts`: 채팅 처리 메인 로직
- `src/ts/process/request/request.ts`: AI API 요청 처리
- `src/ts/globalApi.svelte.ts`: 전역 API 함수들
- `src/ts/sionyw.ts`: OAuth 인증
- `src/ts/drive/drive.ts`: Google Drive 동기화

### 주요 디렉토리 구조

```
src/
├── lib/              # UI 컴포넌트
│   ├── ChatScreens/  # 채팅 화면
│   ├── Setting/      # 설정
│   ├── SideBars/    # 사이드바
│   └── UI/          # 공통 UI
├── ts/              # TypeScript 로직
│   ├── process/     # 채팅 처리
│   ├── storage/     # 데이터 저장
│   ├── model/       # AI 모델 관리
│   └── plugins/     # 플러그인 시스템
└── lang/            # 다국어 지원
```

---

**작성일**: 2024년
**버전**: 1.0
**상태**: 초기 분석 완료
