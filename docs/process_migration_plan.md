# Process 폴더 서버 사이드 마이그레이션 계획

## 📋 개요

`src/ts/process` 폴더는 Risuai의 핵심 채팅 처리 로직이 구현된 곳입니다. 이 폴더를 서버 사이드로 마이그레이션하는 단계별 계획입니다.

## 🔍 폴더 구조 분석

### 주요 파일 및 디렉토리

```
src/ts/process/
├── index.svelte.ts          # 메인 채팅 처리 (sendChat) - 1971 lines
├── scriptings.ts            # Lua/Python 스크립팅 엔진 - 1453 lines
├── triggers.ts               # 트리거 시스템 - 2796 lines
├── lorebook.svelte.ts       # Lorebook 관리 - 754 lines
├── prompt.ts                # 프롬프트 처리 - 487 lines
├── request/                 # API 요청 처리
│   ├── request.ts           # 메인 요청 로직
│   ├── openAI.ts            # OpenAI API
│   ├── anthropic.ts         # Anthropic API
│   └── google.ts            # Google API
├── memory/                   # 메모리 시스템
│   ├── supaMemory.ts        # SupaMemory
│   ├── hypamemory.ts        # HypaMemory
│   ├── hypav2.ts            # HypaMemory V2
│   ├── hypav3.ts            # HypaMemory V3
│   └── hanuraiMemory.ts     # HanuraiMemory
├── models/                   # 모델 관련
│   ├── local.ts             # 로컬 모델
│   ├── nai.ts               # NovelAI
│   └── modelString.ts       # 모델 문자열
├── files/                    # 파일 처리
│   ├── inlays.ts            # 인레이 이미지
│   └── multisend.ts         # 멀티 전송
├── templates/                # 템플릿
├── embedding/                # 임베딩
├── mcp/                      # Model Context Protocol
├── stableDiff.ts            # 이미지 생성
├── tts.ts                   # 텍스트 음성 변환
├── transformers.ts          # Transformers
├── modules.ts               # 모듈 시스템
└── 기타 유틸리티 파일들
```

## 🎯 핵심 기능 분석

### 1. 메인 채팅 처리 (`index.svelte.ts`)
- **`sendChat()`**: 전체 채팅 처리 파이프라인
  - Stage 1: 데이터 준비 및 검증
  - Stage 2: 프롬프트 생성
  - Stage 3: API 요청
  - Stage 4: 응답 처리 및 저장
- **의존성**: 
  - Svelte stores (`DBState`, `selectedCharID`, `doingChat`)
  - 클라이언트 전용 UI (`alertError`, `alertToast`)
  - 실시간 업데이트를 위한 Svelte reactivity

### 2. 스크립팅 엔진 (`scriptings.ts`)
- **`runScripted()`**: Lua/Python 스크립트 실행
- **의존성**:
  - `wasmoon` (Lua 엔진)
  - `Pyodide` (Python 엔진)
  - 클라이언트 전용 UI (`alertSelect`, `alertInput`)

### 3. 트리거 시스템 (`triggers.ts`)
- **`runTrigger()`**: 이벤트 트리거 실행
- **의존성**: 
  - Svelte stores
  - 클라이언트 전용 UI

### 4. Lorebook 관리 (`lorebook.svelte.ts`)
- **`loadLoreBookV3Prompt()`**: Lorebook 프롬프트 로드
- **의존성**:
  - Svelte stores
  - Tokenizer

### 5. API 요청 처리 (`request/`)
- **`requestChatData()`**: AI 모델 API 호출
- **의존성**:
  - HTTP 클라이언트
  - 스트리밍 처리

### 6. 메모리 시스템 (`memory/`)
- 다양한 메모리 구현체
- **의존성**:
  - 벡터 DB (임베딩)
  - 데이터베이스

## 📝 단계별 마이그레이션 계획

### Phase 1: 기반 구조 및 타입 정의 (우선순위: 높음)

**목표**: 서버 사이드 구조 설계 및 타입 정의

#### 1.1 타입 정의 분리
- [ ] `src/server/process/types.ts` 생성
  - `OpenAIChat`, `MultiModal`, `OpenAIChatFull` 인터페이스
  - `requestTokenPart` 인터페이스
  - 채팅 처리 컨텍스트 타입
  - 스크립팅 컨텍스트 타입

#### 1.2 컨텍스트 인터페이스 설계
- [ ] `ProcessContext` 인터페이스
  - `userId`: string
  - `characterId`: string
  - `chatId`: string
  - `database`: Database
  - `databaseAdapter`: DatabaseAdapter
  - `assetService`: AssetService
  - `redisService`: RedisService

#### 1.3 상태 관리 추상화
- [ ] 클라이언트 전용 Svelte stores 제거
- [ ] 서버 사이드 상태 관리 인터페이스 설계
  - `doingChat`: boolean (Redis 또는 메모리)
  - `chatProcessStage`: number (Redis 또는 메모리)
  - `abortChat`: boolean (Redis 또는 메모리)

**예상 작업 시간**: 2-3시간

---

### Phase 2: API 요청 처리 (우선순위: 높음)

**목표**: AI 모델 API 호출 로직 서버 사이드화

#### 2.1 Request 모듈 분리
- [ ] `src/server/process/request/` 디렉토리 생성
- [ ] `types.ts`: 요청 관련 타입 정의
- [ ] `base.ts`: 기본 요청 로직
- [ ] `openai.ts`: OpenAI API 구현
- [ ] `anthropic.ts`: Anthropic API 구현
- [ ] `google.ts`: Google API 구현
- [ ] `index.ts`: 통합 export

#### 2.2 스트리밍 처리
- [ ] 서버 사이드 스트리밍 처리 구현
- [ ] SSE (Server-Sent Events) 또는 WebSocket 지원
- [ ] 클라이언트로 스트림 전달

#### 2.3 에러 처리
- [ ] 클라이언트 전용 `alertError` 제거
- [ ] 서버 사이드 에러 처리 및 로깅
- [ ] 구조화된 에러 응답

**예상 작업 시간**: 4-6시간

---

### Phase 3: 프롬프트 처리 (우선순위: 높음)

**목표**: 프롬프트 생성 및 토큰화 로직 서버 사이드화

#### 3.1 Prompt 모듈 분리
- [ ] `src/server/process/prompt/` 디렉토리 생성
- [ ] `types.ts`: 프롬프트 타입 정의
- [ ] `builder.ts`: 프롬프트 빌더
- [ ] `tokenizer.ts`: 프롬프트 토큰화
- [ ] `templates.ts`: 템플릿 처리
- [ ] `index.ts`: 통합 export

#### 3.2 프롬프트 생성 로직
- [ ] `buildPrompt()`: 프롬프트 생성 함수
- [ ] Persona, Lorebook, Memory 통합
- [ ] 템플릿 시스템 통합

#### 3.3 토큰 계산
- [ ] 기존 tokenizer 모듈 활용
- [ ] 프롬프트별 토큰 계산
- [ ] 토큰 예산 관리

**예상 작업 시간**: 3-4시간

---

### Phase 4: Lorebook 시스템 (우선순위: 중간)

**목표**: Lorebook 관리 및 프롬프트 통합

#### 4.1 Lorebook 모듈 분리
- [ ] `src/server/process/lorebook/` 디렉토리 생성
- [ ] `types.ts`: Lorebook 타입 정의
- [ ] `loader.ts`: Lorebook 로드 로직
- [ ] `matcher.ts`: 키워드 매칭 로직
- [ ] `index.ts`: 통합 export

#### 4.2 Lorebook 로드 로직
- [ ] `loadLoreBookV3Prompt()` 서버 사이드화
- [ ] 키워드 검색 및 매칭
- [ ] 토큰 예산 관리

#### 4.3 데이터베이스 통합
- [ ] DatabaseAdapter를 통한 Lorebook 저장/로드
- [ ] 캐싱 전략 (Redis)

**예상 작업 시간**: 3-4시간

---

### Phase 5: 메모리 시스템 (우선순위: 중간)

**목표**: 다양한 메모리 구현체 서버 사이드화

#### 5.1 Memory 모듈 분리
- [ ] `src/server/process/memory/` 디렉토리 생성
- [ ] `types.ts`: 메모리 타입 정의
- [ ] `base.ts`: 기본 메모리 인터페이스
- [ ] `supaMemory.ts`: SupaMemory 구현
- [ ] `hypaMemory.ts`: HypaMemory 구현
- [ ] `hypaMemoryV2.ts`: HypaMemory V2 구현
- [ ] `hypaMemoryV3.ts`: HypaMemory V3 구현
- [ ] `hanuraiMemory.ts`: HanuraiMemory 구현
- [ ] `index.ts`: 통합 export

#### 5.2 벡터 DB 통합
- [ ] 임베딩 생성 및 저장
- [ ] 벡터 검색
- [ ] 데이터베이스 통합

**예상 작업 시간**: 6-8시간

---

### Phase 6: 스크립팅 엔진 (우선순위: 중간)

**목표**: Lua/Python 스크립팅 엔진 서버 사이드화

#### 6.1 Scripting 모듈 분리
- [ ] `src/server/process/scripting/` 디렉토리 생성
- [ ] `types.ts`: 스크립팅 타입 정의
- [ ] `lua-engine.ts`: Lua 엔진 구현
- [ ] `python-engine.ts`: Python 엔진 구현
- [ ] `api-bridge.ts`: API 브리지
- [ ] `index.ts`: 통합 export

#### 6.2 Lua 엔진 구현
- [ ] 기존 `lua-service.ts` 활용
- [ ] API 함수 등록
- [ ] 보안 및 샌드박싱

#### 6.3 Python 엔진 구현
- [ ] Pyodide 서버 사이드 실행
- [ ] API 함수 등록
- [ ] 보안 및 샌드박싱

**예상 작업 시간**: 4-6시간

---

### Phase 7: 트리거 시스템 (우선순위: 낮음)

**목표**: 트리거 시스템 서버 사이드화

#### 7.1 Trigger 모듈 분리
- [ ] `src/server/process/trigger/` 디렉토리 생성
- [ ] `types.ts`: 트리거 타입 정의
- [ ] `runner.ts`: 트리거 실행 로직
- [ ] `matcher.ts`: 트리거 매칭 로직
- [ ] `index.ts`: 통합 export

#### 7.2 트리거 실행 로직
- [ ] `runTrigger()` 서버 사이드화
- [ ] 이벤트 기반 트리거
- [ ] 조건부 트리거

**예상 작업 시간**: 4-6시간

---

### Phase 8: 메인 채팅 처리 (우선순위: 높음)

**목표**: `sendChat()` 함수 서버 사이드화

#### 8.1 Chat Processor 모듈 분리
- [ ] `src/server/process/chat/` 디렉토리 생성
- [ ] `types.ts`: 채팅 처리 타입 정의
- [ ] `processor.ts`: 메인 채팅 처리 로직
- [ ] `stage1-prepare.ts`: Stage 1 - 데이터 준비
- [ ] `stage2-prompt.ts`: Stage 2 - 프롬프트 생성
- [ ] `stage3-request.ts`: Stage 3 - API 요청
- [ ] `stage4-response.ts`: Stage 4 - 응답 처리
- [ ] `index.ts`: 통합 export

#### 8.2 Stage별 구현
- [ ] **Stage 1**: 데이터 준비 및 검증
  - 캐릭터/채팅 데이터 로드
  - 검증 로직
- [ ] **Stage 2**: 프롬프트 생성
  - 프롬프트 빌더 호출
  - Lorebook 통합
  - Memory 통합
- [ ] **Stage 3**: API 요청
  - Request 모듈 호출
  - 스트리밍 처리
- [ ] **Stage 4**: 응답 처리
  - 응답 파싱
  - 데이터베이스 저장
  - 후처리 (TTS, 이미지 생성 등)

#### 8.3 상태 관리
- [ ] Redis를 통한 상태 관리
- [ ] 진행 상황 추적
- [ ] 중단 처리

**예상 작업 시간**: 8-12시간

---

### Phase 9: 보조 기능들 (우선순위: 낮음)

**목표**: 기타 기능들 서버 사이드화

#### 9.1 이미지 생성
- [ ] `stableDiff.ts` 서버 사이드화
- [ ] 이미지 생성 API 통합
- [ ] 에셋 저장

#### 9.2 TTS
- [ ] `tts.ts` 서버 사이드화
- [ ] TTS API 통합
- [ ] 오디오 파일 저장

#### 9.3 파일 처리
- [ ] `files/inlays.ts` 서버 사이드화
- [ ] `files/multisend.ts` 서버 사이드화
- [ ] 에셋 서비스 통합

#### 9.4 모듈 시스템
- [ ] `modules.ts` 서버 사이드화
- [ ] 모듈 로드 및 실행

**예상 작업 시간**: 6-8시간

---

## 🔄 마이그레이션 전략

### 의존성 제거 전략

1. **Svelte Stores 제거**
   - `DBState` → `DatabaseAdapter` + `userId`
   - `selectedCharID` → 함수 파라미터로 전달
   - `doingChat`, `chatProcessStage` → Redis 또는 메모리 상태

2. **클라이언트 전용 UI 제거**
   - `alertError`, `alertNormal` → 에러/응답 반환
   - `alertSelect`, `alertInput` → API 응답으로 처리

3. **실시간 업데이트**
   - Svelte reactivity → WebSocket 또는 SSE
   - 클라이언트로 진행 상황 전달

### 데이터 흐름

```
클라이언트 요청
    ↓
서버 API 엔드포인트
    ↓
ProcessContext 생성
    ↓
sendChat() 호출
    ↓
Stage 1: 데이터 준비
    ↓
Stage 2: 프롬프트 생성
    ↓
Stage 3: API 요청 (스트리밍)
    ↓
Stage 4: 응답 처리 및 저장
    ↓
클라이언트로 응답 전송
```

## 📊 우선순위 매트릭스

| Phase | 우선순위 | 복잡도 | 예상 시간 | 의존성 |
|-------|---------|--------|----------|--------|
| Phase 1 | 높음 | 낮음 | 2-3h | 없음 |
| Phase 2 | 높음 | 중간 | 4-6h | Phase 1 |
| Phase 3 | 높음 | 중간 | 3-4h | Phase 1, 2 |
| Phase 4 | 중간 | 중간 | 3-4h | Phase 1, 3 |
| Phase 5 | 중간 | 높음 | 6-8h | Phase 1 |
| Phase 6 | 중간 | 높음 | 4-6h | Phase 1 |
| Phase 7 | 낮음 | 중간 | 4-6h | Phase 1, 6 |
| Phase 8 | 높음 | 매우 높음 | 8-12h | Phase 1-7 |
| Phase 9 | 낮음 | 중간 | 6-8h | Phase 1, 8 |

## 🚀 시작 단계

### 즉시 시작 가능한 작업

1. **Phase 1.1**: 타입 정의 분리
   - `src/server/process/types.ts` 생성
   - 기존 타입들을 서버 사이드로 이동

2. **Phase 2.1**: Request 모듈 기본 구조
   - 디렉토리 생성
   - 기본 인터페이스 정의

3. **Phase 3.1**: Prompt 모듈 기본 구조
   - 디렉토리 생성
   - 기본 인터페이스 정의

## ⚠️ 주의사항

1. **점진적 마이그레이션**: 한 번에 모든 것을 옮기지 말고 단계적으로 진행
2. **테스트**: 각 Phase 완료 후 충분한 테스트
3. **호환성**: 기존 클라이언트 코드와의 호환성 유지
4. **성능**: 서버 사이드에서의 성능 최적화 고려
5. **보안**: 스크립팅 엔진의 보안 및 샌드박싱 중요

## 📝 체크리스트

### Phase 1 완료 조건
- [ ] 모든 타입 정의 완료
- [ ] 컨텍스트 인터페이스 설계 완료
- [ ] 상태 관리 추상화 완료

### Phase 2 완료 조건
- [ ] 모든 API 요청 처리 구현
- [ ] 스트리밍 처리 구현
- [ ] 에러 처리 구현

### Phase 3 완료 조건
- [ ] 프롬프트 빌더 구현
- [ ] 토큰 계산 구현
- [ ] 템플릿 시스템 통합

### Phase 8 완료 조건
- [ ] 전체 채팅 처리 파이프라인 구현
- [ ] 모든 Stage 구현 완료
- [ ] 통합 테스트 통과

## 🔗 관련 문서

- [Database Migration Plan](./DATABASE_DOCS_README.md)
- [Bootstrap Analysis](./BOOTSTRAP_ANALYSIS.md)
- [Global API Analysis](./GLOBAL_API_ANALYSIS.md)
