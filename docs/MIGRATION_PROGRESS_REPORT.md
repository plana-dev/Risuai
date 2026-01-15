# 서버화 작업 진행 상황 리포트

**작성일**: 2026년 1월  
**기준**: `src/ts` → `src/server` 마이그레이션 진행 상황

> 📌 **관련 문서**: [누락된 기능 목록](./MISSING_FEATURES.md) - 원본 소스에 있지만 서버화 소스에 없는 기능들

---

## 📊 전체 진행률 요약

### 모듈별 진행률

| 모듈 | 진행률 | 상태 | 비고 |
|------|--------|------|------|
| **Util 함수** | 90% | ✅ 거의 완료 | 일부 함수 남음 |
| **Parser** | 85% | ✅ 거의 완료 | CBS 파서 완료, 일부 타입 의존성 남음 |
| **Tokenizer** | 95% | ✅ 거의 완료 | 대부분 완료 |
| **CBS 시스템** | 100% | ✅ 완료 | 완전히 분리됨 |
| **Database** | 100% | ✅ 완료 | 타입 및 어댑터 완료 |
| **Process/Request** | 80% | 🟡 진행 중 | 기본 구조 완료, 세부 구현 필요 |
| **Process/Chat** | 85% | 🟡 진행 중 | 프롬프트 처리, 스트리밍, 후처리, 그룹 채팅 완료, 세부 최적화 진행 중 |
| **Process/Memory** | 70% | 🟡 진행 중 | SupaMemory, HanuraiMemory 완료, HypaMemory V2/V3 완료 |
| **Process/Trigger** | 50% | 🟡 진행 중 | 기본 구조 완료, V2 이펙트 일부만 |
| **Process/Scripting** | 60% | 🟡 진행 중 | Lua 엔진 완료, 일부 API 미구현 |
| **Process/Auxiliary** | 70% | 🟡 진행 중 | 대부분의 핵심 기능 완료, runImageEmbedding 및 일부 고급 기능 남음 |
| **Model** | 70% | 🟡 진행 중 | 기본 구조 완료, 일부 provider 미완성 |
| **Character** | 90% | ✅ 거의 완료 | 대부분 완료 |
| **Persona** | 80% | ✅ 거의 완료 | 일부 타입 의존성 남음 |

**전체 진행률**: 약 **83%** 완료

---

## ✅ 완료된 작업

### 1. Util 함수 마이그레이션 (100%) ✅

**완료된 항목:**
- ✅ `checkNullish` → `src/server/util/basic.ts`
- ✅ `asBuffer` → `src/server/util/buffer.ts`
- ✅ `prebuiltAssetCommand` → `src/server/util`
- ✅ `parseToggleSyntax` → `src/server/util/parse.ts`
- ✅ `parseKeyValue` → `src/server/util/parse.ts`
- ✅ `getPersonaPrompt` → `src/server/util/database.ts`
- ✅ `getUserName` → `src/server/util/database.ts`
- ✅ `getUserIcon` → `src/server/util/database.ts`
- ✅ `getAuthorNoteDefaultText` → `src/server/util/database.ts`
- ✅ `findCharacterbyId` → `src/server/util/database.ts`
- ✅ `hasher` → `src/server/util/hash.ts`
- ✅ `Mutex` → `src/server/util/mutex.ts`
- ✅ `calcString` → `src/server/util/string.ts`
- ✅ `getMatcherMap`, `initMatcher` → `src/server/cbs/index.ts`
- ✅ `reencodeImage` → `src/server/util/image.ts`
- ✅ `PngChunk` → `src/server/util/png-chunk.ts`
- ✅ `processMultiCommand` → `src/server/process/auxiliary/command.ts`
- ✅ `generateAIImage` → `src/server/process/auxiliary/image-generation.ts`
- ✅ `tokenizeGGUFModel` → `src/server/tokenizer/encode.ts`

### 2. Parser 마이그레이션 (85%)

**완료된 항목:**
- ✅ `risuChatParser` → `src/server/parser` (완전 구현)
- ✅ `parseChatML` → `src/server/parser/chat-ml.ts`
- ✅ CBS 파서 블록 시스템 완료
- ✅ Markdown 파서 완료
- ✅ 이미지 파서 완료

**남은 작업:**
- ⏳ 일부 타입 정의가 `src/ts`에 의존:
  - `matcherArg`, `RegisterCallback` → `src/ts/cbs`
  - `CbsConditions` → `src/ts/parser.svelte`
  - `RisuModule` → `src/ts/process/modules`

### 3. Tokenizer 마이그레이션 (95%)

**완료된 항목:**
- ✅ `tokenize` → `src/server/tokenizer`
- ✅ ChatTokenizer 완료
- ✅ 다양한 토크나이저 지원 (Tiktoken, Mistral, Claude 등)
- ✅ 캐싱 시스템 완료

**남은 작업:**
- ⏳ `tokenizeGGUFModel` → 아직 `src/ts/process/models/local`에서 import

### 4. CBS 시스템 (100%)

**완료된 항목:**
- ✅ 완전히 분리됨 (`src/server/cbs/`)
- ✅ 모든 CBS 함수 구현 완료
- ✅ 의존성 주입 패턴 적용

### 5. Database 시스템 (100%)

**완료된 항목:**
- ✅ 타입 정의 완료 (`src/server/database/types.ts`)
- ✅ Database 어댑터 완료 (`src/server/database-adapter.ts`)
- ✅ 접근 함수 완료 (`src/server/database/access.ts`)
- ✅ 초기화 로직 완료

**남은 작업:**
- ⏳ 일부 타입이 `src/ts`에서 import됨 (타입만, 런타임 의존성 없음)

### 6. Process/Request 모듈 (80%)

**완료된 항목:**
- ✅ 기본 구조 완료
- ✅ `base.ts` 구현 완료
- ✅ `openai.ts` 기본 구현 완료
- ✅ `anthropic.ts` 기본 구현 완료
- ✅ `google.ts` 기본 구현 완료

**남은 작업:**
- ⏳ 스트리밍 처리 세부 구현
- ⏳ Tool calls 완전 구현
- ⏳ Multimodal 처리 완전 구현
- ⏳ 에러 처리 및 재시도 로직 강화

### 7. Process/Memory 모듈 (70%)

**완료된 항목:**
- ✅ `supaMemory` → `src/server/process/memory/supa-memory.ts`
- ✅ `hanuraiMemory` → `src/server/process/memory/hanurai-memory.ts`
- ✅ `hypaMemoryV2` → `src/server/process/memory/hypa-v2.ts`
- ✅ `hypaMemoryV3` → `src/server/process/memory/hypa-v3.ts`
- ✅ HypaProcessor 구현 완료

**남은 작업:**
- ⏳ 벡터 DB 통합 (Redis 또는 전용 벡터 DB)
- ⏳ 임베딩 생성 서버 사이드 마이그레이션

### 8. Process/Scripting 모듈 (60%)

**완료된 항목:**
- ✅ Lua 엔진 통합 완료 (`src/server/lua-service.ts`)
- ✅ 기본 API 함수 등록 완료
- ✅ `runLuaEditTrigger` 구현 완료

**남은 작업:**
- ⏳ `LLMMain`, `simpleLLM` 완전 구현
- ⏳ 일부 API 함수 미구현 (`getPersonaName`, `getPersonaDescription` 등)
- ⏳ `Mutex` import를 서버 사이드로 변경 필요

### 9. Character 모듈 (90%)

**완료된 항목:**
- ✅ Character 생성/수정/삭제 완료
- ✅ Character 임포트 완료
- ✅ Character 에셋 관리 완료
- ✅ Realm 시스템 완료

**남은 작업:**
- ⏳ `OnnxModelFiles` 타입이 `src/ts/process/transformers`에서 import됨

### 10. Persona 모듈 (100%) ✅

**완료된 항목:**
- ✅ Persona 임포트/익스포트 완료
- ✅ Persona 이미지 처리 완료
- ✅ Persona 관리 함수 완료
- ✅ `reencodeImage` → `src/server/util/image.ts`로 마이그레이션 완료
- ✅ `PngChunk` → `src/server/util/png-chunk.ts`로 마이그레이션 완료

---

## 🟡 진행 중인 작업

### 1. Process/Chat 모듈 (85%)

**현재 상태:**
- 핵심 기능 대부분 구현 완료
- 세부 최적화 및 테스트 필요

**완료된 작업:**
- ✅ 프롬프트 템플릿 처리 완료
- ✅ 토큰 계산 및 관리 로직 완료
- ✅ 메모리 시스템 통합 완료 (SupaMemory, HanuraiMemory, HypaMemory V2/V3)
- ✅ 스트리밍 처리 구현 완료
- ✅ 후처리 로직 완료 (runInlayScreen, addRerolls, sayTTS)
- ✅ Auto Continue Chat 로직 완료
- ✅ IGP (Image Generation Prompt) 처리 완료
- ✅ 그룹 채팅 처리 구현 완료 (캐릭터 순서 결정, 메시지 포맷팅, 시스템 메시지)
- ✅ ProcessContext에 chatTokenizer와 tokenizerContext 추가 완료
- ✅ API 엔드포인트 구현 완료 (POST /api/chat/send, GET /api/chat/:chatId)

**남은 작업:**
- ⏳ 스트리밍 처리 세부 최적화
- ⏳ Emotion 처리 완전 구현
- ⏳ WebSocket 스트리밍 엔드포인트 (P1)

**예상 작업량**: 1일 (세부 최적화 및 WebSocket)

### 2. Process/Trigger 모듈 (50%)

**현재 상태:**
- 기본 구조 완료 (`trigger/runner.ts`, `trigger/conditions.ts`)
- 핵심 이펙트만 구현, V2 이펙트 일부만 구현

**완료된 작업:**
- ✅ 기본 트리거 실행 구조 완료
- ✅ 조건 처리 시스템 완료 (`conditions.ts`)
- ✅ `processMultiCommand` 서버 사이드 마이그레이션 완료 (의존성 해결)
- ✅ `generateAIImage` 서버 사이드 마이그레이션 완료 (의존성 해결)
- ✅ `calcString` 서버 사이드 마이그레이션 완료 (의존성 해결)

**필요한 작업:**
- [ ] V2 이펙트 완전 구현 (v2Loop, v2GetLorebook, v2ModifyLorebook 등)
- [ ] 데이터베이스 저장 통합
- [ ] 트리거 실행 결과 저장 로직 완성

**예상 작업량**: 3-5일

### 3. Process/Auxiliary 모듈 (70%)

**현재 상태:**
- 기본 구조 완료
- 대부분의 핵심 기능 구현 완료
- 일부 고급 기능 남음

**완료된 작업:**
- ✅ `processScript`, `processScriptFull` 기본 구현 완료
- ✅ `runInlayScreen` 마이그레이션 완료 (`inlay-screen.ts`)
- ✅ `addRerolls` 마이그레이션 완료 (`reroll.ts`)
- ✅ `sayTTS` 마이그레이션 완료 (`tts.ts`, 대부분의 TTS 모드 지원)
- ✅ `processMultiCommand` 마이그레이션 완료 (`command.ts`)
- ✅ `generateAIImage` 마이그레이션 완료 (`image-generation.ts`)
- ✅ 파일 처리 기본 구현 완료 (`file-processing.ts`, PO, CSV, JSON 파싱)
- ✅ 그룹 채팅 처리 완료 (`group.ts`)
- ✅ 모듈 관리 완료 (`modules.ts`)
- ✅ 스크립트 처리 완료 (`scripts.ts`)
- ✅ 예제 메시지 처리 완료 (`example-messages.ts`)
- ✅ 추가 정보 처리 완료 (`additional-info.ts`)
- ✅ 모델 문자열 처리 완료 (`model-string.ts`)
- ✅ 문자열화 처리 완료 (`stringlize.ts`)

**남은 작업:**
- ⏳ `runImageEmbedding` 서버 사이드 마이그레이션 (`image-embedding.ts`, transformers 모듈 필요)
- ⏳ VITS TTS 완전 구현
- ⏳ 이미지 생성 완전 구현 (ComfyUI 통합 세부 구현)

**예상 작업량**: 2-3일

### 4. Model 모듈 (70%)

**현재 상태:**
- 기본 구조 완료
- 일부 provider 미완성

**필요한 작업:**
- [ ] OpenRouter 서버 사이드 완전 구현
- [ ] Ooba 서버 사이드 구현
- [ ] Local 모델 서버 사이드 구현

**예상 작업량**: 2-3일

---

## ⏳ 남은 작업 (우선순위별)

### P0 (Critical) - 핵심 기능

1. **Process/Chat 모듈 완성**
   - 프롬프트 템플릿 처리
   - 토큰 계산 및 관리
   - 메모리 시스템 통합
   - 스트리밍 처리
   - 후처리 로직

2. **클라이언트 사이드 의존성 완전 제거** ✅ 완료
   - ✅ `parseKeyValue` 마이그레이션 완료
   - ✅ `calcString` 마이그레이션 완료
   - ✅ `getMatcherMap`, `initMatcher` 마이그레이션 완료
   - ✅ `reencodeImage` 마이그레이션 완료
   - ✅ `PngChunk` 마이그레이션 완료
   - ✅ `processMultiCommand` 마이그레이션 완료
   - ✅ `generateAIImage` 마이그레이션 완료
   - ✅ `tokenizeGGUFModel` 마이그레이션 완료
   - ⏳ `runImageEmbedding` 마이그레이션 (transformers 모듈, P1)

3. **API 엔드포인트 구현** ✅ 기본 완료
   - ✅ POST `/api/chat/send` - 채팅 전송 (구현 완료)
   - ✅ GET `/api/chat/{chatId}` - 채팅 조회 (구현 완료)
   - ⏳ WebSocket `/api/chat/stream` - 스트리밍 채팅 (P1, 추후 구현)

### P1 (High) - 주요 기능

1. **Process/Trigger 모듈 완성**
   - V2 이펙트 완전 구현
   - 데이터베이스 저장 통합

2. **Process/Scripting 모듈 완성**
   - `LLMMain`, `simpleLLM` 완전 구현
   - 누락된 API 함수 구현

3. **Process/Auxiliary 모듈 완성**
   - TTS 완전 구현
   - 파일 처리 완전 구현
   - 이미지 생성 완전 구현

4. **Model 모듈 완성**
   - OpenRouter 완전 구현
   - Ooba 서버 사이드 구현

### P2 (Medium) - 보조 기능

1. **성능 최적화**
   - 프롬프트 캐싱 최적화
   - 토큰 계산 결과 캐싱
   - 데이터베이스 쿼리 최적화

2. **에러 처리 및 로깅**
   - 통합 에러 처리
   - 구조화된 로깅 시스템

---

## 📝 클라이언트 사이드 의존성 현황

### 아직 `src/ts`에서 import하는 파일들

**타입 정의만 (런타임 의존성 없음):**
- `src/server/database/types.ts`:
  - `triggerscript`, `OnnxModelFiles`, `RisuModule`, `SerializableHypaV2Data`, `SerializableHypaV3Data`
  - `LLMFlags`, `LLMFormat`, `LLMTokenizer`, `HypaModel`, `HypaV3Settings`, `HypaV3Preset`
  - `RisuPlugin`, `NAISettings`, `ColorScheme`, `PromptItem`, `PromptSettings`
  - `OobaChatCompletionRequestParams`, `OpenAIChat`, `Hotkey`, `Database`

**런타임 의존성 (완료):**
- ✅ 모든 런타임 의존성 마이그레이션 완료

**타입 정의만 (런타임 의존성 없음, 우선순위 낮음):**
- `src/server/database/types.ts`: 
  - `triggerscript`, `SerializableHypaV2Data`, `SerializableHypaV3Data`
  - `HypaModel`, `HypaV3Settings`, `HypaV3Preset`
  - `RisuPlugin`, `PromptItem`, `PromptSettings`
  - `OobaChatCompletionRequestParams`, `OpenAIChat`, `Database`
- `src/server/characters/types.ts`: `OnnxModelFiles` (타입만, 이미 서버에 정의됨)

**총 20개 파일에서 타입 정의만 `src/ts` import (런타임 의존성 없음)**

---

## 🎯 다음 단계 권장사항

### 즉시 시작 가능한 작업 (우선순위 높음)

1. **Process/Trigger 모듈 완성** ✅ 의존성 해결 완료
   - V2 이펙트 완전 구현 (v2Loop, v2GetLorebook, v2ModifyLorebook 등)
   - 데이터베이스 저장 통합
   - 트리거 실행 결과 저장 로직 완성

2. **Process/Auxiliary 모듈 완성**
   - `runImageEmbedding` 서버 사이드 마이그레이션 (transformers 모듈 필요)
   - VITS TTS 완전 구현
   - 이미지 생성 완전 구현 (ComfyUI 통합 세부 구현)

3. **Process/Scripting 모듈 완성**
   - `LLMMain`, `simpleLLM` 완전 구현
   - 누락된 API 함수 구현 (`getPersonaName`, `getPersonaDescription` 등)

4. **Model 모듈 완성**
   - OpenRouter 서버 사이드 완전 구현
   - Ooba 서버 사이드 구현
   - Local 모델 서버 사이드 구현

### 중기 작업 (1-2주)

1. **Process/Chat 모듈 완성** ✅ 대부분 완료
   - ✅ 프롬프트 템플릿 처리 완료
   - ✅ 토큰 계산 및 관리 완료
   - ✅ 메모리 시스템 통합 완료
   - ⏳ 스트리밍 처리 세부 최적화
   - ⏳ Emotion 처리 완전 구현
   - ⏳ WebSocket 스트리밍 엔드포인트 구현

2. **Process/Request 모듈 완성**
   - 스트리밍 처리 세부 구현
   - Tool calls 완전 구현
   - Multimodal 처리 완전 구현
   - 에러 처리 및 재시도 로직 강화

### 장기 작업 (2-4주)

1. **API 엔드포인트 구현**
2. **성능 최적화**
3. **에러 처리 및 로깅 시스템**

---

## 📈 진행 상황 추적

### 완료된 Phase

- ✅ **Phase 1**: 기반 구조 및 타입 정의
- ✅ **Phase 2**: Infrastructure Setup (Database, Redis, Asset 서비스)
- ✅ **Phase 3**: Lua Engine 통합

### 진행 중인 Phase

- 🟡 **Phase 4**: Process 모듈 마이그레이션 (진행률 60%)
- 🟡 **Phase 5**: Util 함수 마이그레이션 (진행률 90%)

### 예정된 Phase

- ⏳ **Phase 6**: API 엔드포인트 구현
- ⏳ **Phase 7**: 통합 테스트
- ⏳ **Phase 8**: 성능 최적화

---

## 💡 참고사항

1. **타입 정의 의존성**: 많은 파일이 타입 정의만 `src/ts`에서 import하고 있습니다. 이는 런타임 의존성이 아니므로 우선순위가 낮습니다. 하지만 장기적으로는 공통 타입 패키지로 분리하는 것이 좋습니다.

2. **점진적 마이그레이션**: 한 번에 모든 것을 옮기지 말고 단계적으로 진행하는 것이 중요합니다.

3. **테스트**: 각 모듈 마이그레이션 후 충분한 테스트가 필요합니다.

4. **문서화**: 마이그레이션된 모듈의 사용법을 문서화하는 것이 중요합니다.

---

---

## 📁 소스 구조 분석

### 원본 소스 (`src/ts`) 구조

#### 핵심 모듈

1. **`process/`** - 채팅 처리 핵심 로직
   - `index.svelte.ts` - 메인 채팅 처리 함수 (1971줄, Svelte 스토어 사용)
   - `request/` - API 요청 처리
     - `openAI.ts`, `anthropic.ts`, `google.ts`, `request.ts`
   - `memory/` - 메모리 시스템
     - `supaMemory.ts`, `hanuraiMemory.ts`, `hypamemory.ts`
     - `hypamemoryv2.ts`, `hypav2.ts`, `hypav3.ts`
     - `taskRateLimiter.ts`
   - `templates/` - 프롬프트 템플릿
     - `templates.ts`, `chatTemplate.ts`, `getRecommended.ts`, `jsonSchema.ts`, `templateCheck.ts`
   - `scripts.ts`, `scriptings.ts` - 스크립팅 시스템
   - `triggers.ts` - 트리거 시스템
   - `tts.ts`, `inlayScreen.ts`, `prereroll.ts` - 보조 기능
   - `files/` - 파일 처리 (`inlays.ts`, `multisend.ts`)
   - `models/` - 모델 관리 (`local.ts`, `modelString.ts`, `nai.ts`)
   - `mcp/` - Model Context Protocol 지원
   - `embedding/` - 임베딩 처리 (`addinfo.ts`)
   - `transformers.ts` - Transformers 모델 처리
   - `lorebook.svelte.ts` - 로어북 관리
   - `group.ts` - 그룹 채팅
   - `modules.ts` - 모듈 관리

2. **`util.ts`** - 유틸리티 함수 (1260줄)
   - `checkNullish`, `calcString`, `parseKeyValue`, `parseToggleSyntax`
   - `getPersonaPrompt`, `getUserName`, `getUserIcon`
   - `findCharacterbyId`, `hasher`, `Mutex`
   - `reencodeImage`, `PngChunk` 등

3. **`parser/`** - 파싱 시스템
   - `chatML.ts` - ChatML 파싱
   - `parser.svelte.ts` - CBS 파서 및 메인 파서

4. **`tokenizer.ts`** - 토큰화 시스템

5. **`cbs.ts`** - CBS (Curly Bracket Syntax) 시스템

6. **`storage/`** - 데이터 저장
   - `database.svelte.ts` - 데이터베이스 인터페이스 (Svelte 스토어)
   - `risuSave.ts`, `exportAsDataset.ts` 등

7. **`characters.ts`**, **`persona.ts`** - 캐릭터/페르소나 관리

8. **`model/`** - 모델 관리
   - `modellist.ts`, `types.ts`
   - `providers/` - AI 제공자 (OpenAI, Anthropic, Google)
   - `openrouter.ts`, `ooba.ts`

### 서버화 소스 (`src/server`) 구조

#### 마이그레이션된 모듈

1. **`process/`** - 서버 사이드 채팅 처리 (모듈화됨)
   ```
   process/
   ├── chat/          - 채팅 처리
   │   ├── send-chat.ts    - 메인 채팅 전송 로직
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── request/       - API 요청
   │   ├── base.ts         - 기본 요청 클래스
   │   ├── openai.ts       - OpenAI 구현
   │   ├── anthropic.ts    - Anthropic 구현
   │   ├── google.ts       - Google 구현
   │   ├── utils.ts        - 유틸리티
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── memory/        - 메모리 시스템
   │   ├── base.ts         - 기본 메모리 클래스
   │   ├── supa-memory.ts  - SupaMemory
   │   ├── hanurai-memory.ts - HanuraiMemory
   │   ├── hypa-v2.ts      - HypaMemory V2
   │   ├── hypa-v3.ts      - HypaMemory V3
   │   ├── hypa-processor.ts - HypaProcessor
   │   ├── hypa-v3-preset.ts - V3 프리셋
   │   ├── hypa-v3-helpers.ts - V3 헬퍼
   │   ├── hypa-v3-summarize.ts - V3 요약
   │   ├── hypa-processor-ex.ts - 확장 프로세서
   │   ├── task-rate-limiter.ts - 작업 속도 제한
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── prompt/        - 프롬프트 처리
   │   ├── templates.ts    - 템플릿
   │   ├── converter.ts    - 변환기
   │   ├── detector.ts     - 감지기
   │   ├── tokenizer.ts    - 토크나이저
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── lorebook/      - 로어북 시스템
   │   ├── loader.ts       - 로더
   │   ├── converter.ts    - 변환기
   │   ├── decorator.ts    - 데코레이터
   │   ├── matcher.ts      - 매처
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── trigger/       - 트리거 시스템
   │   ├── runner.ts       - 트리거 실행기
   │   ├── conditions.ts   - 조건 처리
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── scripting/     - 스크립팅
   │   ├── lua.ts          - Lua 엔진
   │   └── index.ts        - Export
   ├── auxiliary/     - 보조 기능
   │   ├── command.ts      - 명령 처리
   │   ├── tts.ts          - TTS
   │   ├── inlay-screen.ts - 인레이 스크린
   │   ├── reroll.ts       - 리롤
   │   ├── image-generation.ts - 이미지 생성
   │   ├── image-embedding.ts - 이미지 임베딩
   │   ├── file-processing.ts - 파일 처리
   │   ├── group.ts        - 그룹 채팅
   │   ├── modules.ts      - 모듈 관리
   │   ├── scripts.ts      - 스크립트 처리
   │   ├── example-messages.ts - 예제 메시지
   │   ├── additional-info.ts - 추가 정보
   │   ├── model-string.ts - 모델 문자열
   │   ├── stringlize.ts   - 문자열화
   │   ├── types.ts        - 타입 정의
   │   └── index.ts        - Export
   ├── context.ts     - 프로세스 컨텍스트
   ├── parser-context.ts - 파서 컨텍스트
   ├── state.ts       - 상태 관리
   ├── types.ts       - 타입 정의
   └── index.ts       - 통합 Export
   ```

2. **`util/`** - 서버 사이드 유틸리티 (모듈화됨)
   - `basic.ts` - 기본 유틸리티
   - `string.ts` - 문자열 처리
   - `parse.ts` - 파싱 함수
   - `image.ts` - 이미지 처리
   - `buffer.ts` - 버퍼 처리
   - `database.ts` - 데이터베이스 관련
   - `hash.ts` - 해시 함수
   - `mutex.ts` - Mutex
   - `png-chunk.ts` - PNG 청크
   - `json.ts` - JSON 처리
   - `random.ts` - 랜덤 함수
   - `url.ts` - URL 처리
   - `tags.ts` - 태그 처리
   - `concurrency.ts` - 동시성 제어
   - `crypto.ts` - 암호화
   - `index.ts` - 통합 Export

3. **`parser/`** - 서버 사이드 파서
   - `chat-ml.ts` - ChatML 파싱
   - `cbs-parser.ts` - CBS 파서
   - `cbs-blocks.ts` - CBS 블록
   - `cbs-matcher.ts` - CBS 매처
   - `markdown.ts` - Markdown 파싱
   - `image.ts` - 이미지 파싱
   - `asset.ts` - 에셋 파싱
   - `variable.ts` - 변수 파싱
   - `metadata.ts` - 메타데이터 파싱
   - `style.ts` - 스타일 파싱
   - `date-time.ts` - 날짜/시간 파싱
   - `utility.ts` - 유틸리티
   - `types.ts` - 타입 정의
   - `index.ts` - Export

4. **`tokenizer/`** - 서버 사이드 토크나이저
   - `chat-tokenizer.ts` - 채팅 토크나이저
   - `tiktoken.ts` - Tiktoken
   - `web-tokenizers.ts` - Web Tokenizers
   - `google-cloud.ts` - Google Cloud
   - `gemma.ts` - Gemma
   - `encode.ts` - 인코딩
   - `cache.ts` - 캐싱
   - `file-loader.ts` - 파일 로더
   - `utils.ts` - 유틸리티
   - `wrapper.ts` - 래퍼
   - `types.ts` - 타입 정의
   - `index.ts` - Export

5. **`cbs/`** - CBS 시스템 (완전 분리)
   - `index.ts` - 메인 등록
   - `basic.ts`, `character.ts`, `prompt.ts`, `time.ts`
   - `variable.ts`, `metadata.ts`, `comparison.ts`, `string.ts`
   - `array.ts`, `math.ts`, `random.ts`, `display.ts`
   - `control.ts`, `asset.ts`, `utility.ts`, `encryption.ts`
   - `types.ts` - 타입 정의

6. **`database/`** - 데이터베이스 어댑터
   - `types.ts` - 타입 정의
   - `access.ts` - 접근 함수
   - `defaults.ts` - 기본값
   - `preset.ts` - 프리셋
   - `initialize.ts` - 초기화
   - `index.ts` - Export
   - `database-adapter.ts` - Prisma 어댑터 (루트)

7. **`characters/`** - 캐릭터 관리
   - `create.ts` - 생성
   - `import.ts` - 임포트
   - `assets.ts` - 에셋 관리
   - `chat-io.ts` - 채팅 I/O
   - `realm.ts` - Realm 시스템
   - `utils.ts` - 유틸리티
   - `types.ts` - 타입 정의
   - `index.ts` - Export

8. **`persona/`** - 페르소나 관리
   - `import.ts` - 임포트
   - `export.ts` - 익스포트
   - `image.ts` - 이미지 처리
   - `manage.ts` - 관리 함수
   - `types.ts` - 타입 정의
   - `index.ts` - Export

9. **`model/`** - 모델 관리
   - `modellist.ts` - 모델 목록
   - `modellist-server.ts` - 서버 모델 목록
   - `openrouter.ts` - OpenRouter
   - `ooba.ts` - Ooba
   - `providers/` - AI 제공자
     - `openai.ts`, `anthropic.ts`, `google.ts`
   - `types.ts` - 타입 정의

10. **서비스 레이어**
    - `index.ts` - ServiceManager (서비스 초기화/관리)
    - `redis-service.ts` - Redis 캐싱 서비스
    - `database-adapter.ts` - Prisma 데이터베이스 어댑터
    - `asset-service.ts` - Supabase Storage 에셋 서비스
    - `lua-service.ts` - Lua 스크립트 실행 서비스

### 마이그레이션 매핑 관계

| 원본 (`src/ts`) | 서버화 (`src/server`) | 상태 | 비고 |
|----------------|---------------------|------|------|
| `process/index.svelte.ts` | `process/chat/send-chat.ts` | ✅ 85% | Svelte 의존성 제거, 모듈화 |
| `process/request/*` | `process/request/*` | ✅ 80% | 기본 구조 완료 |
| `process/memory/*` | `process/memory/*` | ✅ 70% | 모든 메모리 시스템 마이그레이션 |
| `process/triggers.ts` | `process/trigger/runner.ts` | 🟡 50% | V2 이펙트 일부만 |
| `process/scriptings.ts` | `process/scripting/lua.ts` | 🟡 60% | Lua 엔진 완료, API 일부 미구현 |
| `process/tts.ts` | `process/auxiliary/tts.ts` | ✅ 70% | 대부분 완료 |
| `process/inlayScreen.ts` | `process/auxiliary/inlay-screen.ts` | ✅ 완료 | |
| `process/prereroll.ts` | `process/auxiliary/reroll.ts` | ✅ 완료 | |
| `process/command.ts` | `process/auxiliary/command.ts` | ✅ 완료 | |
| `process/stableDiff.ts` | `process/auxiliary/image-generation.ts` | ✅ 완료 | |
| `process/transformers.ts` | `process/auxiliary/image-embedding.ts` | 🟡 진행 중 | 서버 사이드 transformers 필요 |
| `process/lorebook.svelte.ts` | `process/lorebook/*` | ✅ 완료 | 모듈화됨 |
| `process/templates/*` | `process/prompt/templates.ts` | ✅ 완료 | 통합됨 |
| `process/prompt.ts` | `process/prompt/*` | ✅ 완료 | 모듈화됨 |
| `util.ts` | `util/*` (분리됨) | ✅ 90% | 모듈화 및 분리 |
| `parser/*` | `parser/*` | ✅ 85% | CBS 파서 완료 |
| `tokenizer.ts` | `tokenizer/*` | ✅ 95% | 모듈화됨 |
| `cbs.ts` | `cbs/*` | ✅ 100% | 완전 분리 |
| `storage/database.svelte.ts` | `database/*` + `database-adapter.ts` | ✅ 100% | Prisma 어댑터 |
| `characters.ts` | `characters/*` | ✅ 90% | 모듈화됨 |
| `persona.ts` | `persona/*` | ✅ 80% | 모듈화됨 |
| `model/*` | `model/*` | 🟡 70% | 일부 provider 미완성 |

### 주요 차이점

1. **Svelte 의존성 제거**
   - 원본: `index.svelte.ts`, `database.svelte.ts` 등 Svelte 스토어 사용
   - 서버: 순수 TypeScript, 의존성 주입 패턴 사용

2. **구조 개선**
   - 원본: 큰 단일 파일 (`index.svelte.ts` 1971줄)
   - 서버: 모듈화된 구조 (`chat/`, `request/`, `memory/` 등으로 분리)

3. **서비스 레이어 추가**
   - `ServiceManager` - 모든 서비스 초기화/관리
   - `redis-service.ts` - Redis 캐싱 전략
   - `database-adapter.ts` - Prisma 기반 데이터베이스 어댑터
   - `asset-service.ts` - Supabase Storage 통합
   - `lua-service.ts` - Lua 스크립트 실행 서비스

4. **타입 정의 분리**
   - 각 모듈에 `types.ts` 파일로 타입 정의 분리
   - 공통 타입은 `process/types.ts` 등에 정의

5. **파일 네이밍 컨벤션**
   - 원본: `camelCase.ts` (예: `inlayScreen.ts`)
   - 서버: `kebab-case.ts` (예: `inlay-screen.ts`)

---

**마지막 업데이트**: 2026년 1월  
**다음 리뷰 예정일**: 진행 상황에 따라 업데이트
