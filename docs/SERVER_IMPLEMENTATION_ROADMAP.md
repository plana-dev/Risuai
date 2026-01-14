# 서버 사이드 모듈 세부 구현 로드맵

## 개요

`src/server`에 구현된 각 모듈의 세부 구현 완성 단계를 정리하고 우선순위를 매깁니다.

## 우선순위 기준

1. **P0 (Critical)**: 핵심 기능, 채팅 처리에 필수
2. **P1 (High)**: 주요 기능, 사용자 경험에 중요
3. **P2 (Medium)**: 보조 기능, 선택적 기능
4. **P3 (Low)**: 향후 개선, 최적화

---

## 1. Process 모듈

### 1.1 Request 모듈 (P0 - Critical)

**현재 상태**: 기본 구조만 구현, 실제 API 호출 미구현

#### Phase 1.1.1: OpenAI API 구현
- **파일**: `src/server/process/request/openai.ts`
- **원본**: `src/ts/process/request/openAI.ts` (1471 lines)
- **작업 내용**:
  - [ ] 스트리밍 처리 구현
  - [ ] Tool calls 처리
  - [ ] Multimodal 처리 (이미지, 비디오, 오디오)
  - [ ] Function calling 구현
  - [ ] 에러 처리 및 재시도 로직
  - [ ] 토큰 계산 및 제한 처리

#### Phase 1.1.2: Anthropic API 구현
- **파일**: `src/server/process/request/anthropic.ts`
- **원본**: `src/ts/process/request/anthropic.ts` (982 lines)
- **작업 내용**:
  - [ ] Claude API 스트리밍 처리
  - [ ] Tool use 처리
  - [ ] Multimodal 처리
  - [ ] 에러 처리 및 재시도 로직

#### Phase 1.1.3: Google Cloud Vertex AI API 구현
- **파일**: `src/server/process/request/google.ts`
- **원본**: `src/ts/process/request/google.ts` (1205 lines)
- **작업 내용**:
  - [ ] Vertex AI API 호출
  - [ ] 스트리밍 처리
  - [ ] Function calling
  - [ ] 에러 처리

#### Phase 1.1.4: Base Request 모듈 완성
- **파일**: `src/server/process/request/base.ts`
- **작업 내용**:
  - [ ] 다른 모델 구현체들 import 및 통합
  - [ ] Fallback 로직 구현
  - [ ] 재시도 전략 구현
  - [ ] 스트리밍 응답 처리

**예상 작업량**: 각 API당 2-3일, 총 8-12일

---

### 1.2 Chat 모듈 (P0 - Critical)

**현재 상태**: 기본 구조만 구현, 핵심 로직 대부분 TODO

#### Phase 1.2.1: 프롬프트 템플릿 처리
- **파일**: `src/server/process/chat/send-chat.ts`
- **작업 내용**:
  - [ ] 프롬프트 템플릿 파싱 및 적용
  - [ ] 템플릿 카드 타입별 처리 (persona, description, lorebook, chat, memory, cache 등)
  - [ ] Position parser 구현
  - [ ] Inner format 처리

#### Phase 1.2.2: 토큰 계산 및 관리
- **작업 내용**:
  - [ ] ChatTokenizer 통합
  - [ ] 토큰 계산 로직 구현
  - [ ] 토큰 제한 처리 (maxContext 초과 시 메시지 제거)
  - [ ] 토큰 재계산 로직

#### Phase 1.2.3: 메모리 시스템 통합
- **작업 내용**:
  - [ ] SupaMemory 통합
  - [ ] HypaMemory V2/V3 통합
  - [ ] HanuraiMemory 통합
  - [ ] 메모리 시스템 선택 로직

#### Phase 1.2.4: 스트리밍 처리
- **작업 내용**:
  - [ ] 스트리밍 응답 처리
  - [ ] 실시간 메시지 업데이트
  - [ ] 중단 처리 (AbortSignal)
  - [ ] 에러 처리

#### Phase 1.2.5: 후처리 로직
- **작업 내용**:
  - [ ] Emotion 처리
  - [ ] Image generation (ComfyUI) 통합
  - [ ] TTS 처리
  - [ ] Script 실행 (processScript, processScriptFull)

#### Phase 1.2.6: 그룹 채팅 처리
- **작업 내용**:
  - [ ] 그룹 채팅 로직 구현
  - [ ] 여러 캐릭터 순차 처리
  - [ ] 그룹 채팅 메시지 포맷팅

**예상 작업량**: 10-15일

---

### 1.3 Trigger 모듈 (P1 - High)

**현재 상태**: 핵심 이펙트만 구현, V2 이펙트 일부만 구현

#### Phase 1.3.1: V2 이펙트 완성
- **파일**: `src/server/process/trigger/runner.ts`
- **작업 내용**:
  - [ ] Loop 처리 (v2Loop, v2LoopNTimes) 완전 구현
  - [ ] 나머지 V2 이펙트들 구현:
    - [ ] v2GetLorebook, v2ModifyLorebook 등 Lorebook 관련
    - [ ] v2GetCharacterDesc, v2SetCharacterDesc 등 캐릭터 관련
    - [ ] v2GetPersonaDesc, v2SetPersonaDesc 등 페르소나 관련
    - [ ] v2MakeArrayVar, v2GetArrayVar 등 배열 관련
    - [ ] v2MakeDictVar, v2GetDictVar 등 딕셔너리 관련
    - [ ] v2Calculate, v2ReplaceString 등 문자열 관련
  - [ ] displayAllowList, requestAllowList 체크 구현

#### Phase 1.3.2: 데이터베이스 저장 통합
- **작업 내용**:
  - [ ] setVar 시 데이터베이스 저장
  - [ ] 캐릭터 수정 시 데이터베이스 저장
  - [ ] 채팅 수정 시 데이터베이스 저장

**예상 작업량**: 5-7일

---

### 1.4 Scripting 모듈 (P1 - High)

**현재 상태**: Lua 엔진 기본 구조 완성, 일부 API 미구현

#### Phase 1.4.1: 누락된 API 구현
- **파일**: `src/server/process/scripting/lua.ts`
- **작업 내용**:
  - [ ] getPersonaName, getPersonaDescription 구현
  - [ ] LLMMain, simpleLLM 완전 구현 (requestChatData 통합)
  - [ ] 캐릭터 수정 API (setName, setDescription 등) 데이터베이스 저장
  - [ ] findCharacterbyId 구현

#### Phase 1.4.2: 데이터베이스 통합
- **작업 내용**:
  - [ ] 모든 setVar 호출 시 데이터베이스 저장
  - [ ] 캐릭터 수정 시 데이터베이스 저장

**예상 작업량**: 3-5일

---

### 1.5 Memory 모듈 (P1 - High)

**현재 상태**: SupaMemory, HanuraiMemory 기본 구현 완료, HypaMemory V2/V3 미구현

#### Phase 1.5.1: HypaMemory V2/V3 구현
- **파일**: `src/server/process/memory/`
- **작업 내용**:
  - [ ] HypaMemory V2 구현 (원본: `src/ts/process/memory/hypav2.ts`)
  - [ ] HypaMemory V3 구현 (원본: `src/ts/process/memory/hypav3.ts`)
  - [ ] Redis 통합 (벡터 저장)

#### Phase 1.5.2: 의존성 마이그레이션
- **작업 내용**:
  - [ ] transformers 모듈 서버 사이드 마이그레이션
  - [ ] stringlize 모듈 서버 사이드 마이그레이션
  - [ ] globalFetch 서버 사이드 HTTP 클라이언트로 교체

**예상 작업량**: 5-7일

---

### 1.6 Auxiliary 모듈 (P2 - Medium)

**현재 상태**: 기본 구조 완성, 일부 기능 TODO

#### Phase 1.6.1: TTS 완성
- **파일**: `src/server/process/auxiliary/tts.ts`
- **작업 내용**:
  - [ ] VITS TTS 구현
  - [ ] translateVox 함수 서버 사이드 마이그레이션

#### Phase 1.6.2: 파일 처리 완성
- **파일**: `src/server/process/auxiliary/file-processing.ts`
- **작업 내용**:
  - [ ] PO 파일 파싱 로직 구현
  - [ ] CSV 파싱 로직 구현
  - [ ] JSON 구조 정의 및 파싱
  - [ ] 이미지 리사이징 및 최적화

#### Phase 1.6.3: 이미지 생성 완성
- **파일**: `src/server/process/auxiliary/image-generation.ts`
- **작업 내용**:
  - [ ] ComfyUI 워크플로우 템플릿 관리
  - [ ] 프롬프트 생성 (LLM 사용) 통합

**예상 작업량**: 4-6일

---

## 2. Model 모듈

### 2.1 Model List 및 Provider (P1 - High)

**현재 상태**: getDatabase() 호출 문제로 인해 일부 기능 비활성화

#### Phase 2.1.1: Model List 서버 사이드 구현
- **파일**: `src/server/model/modellist.ts`
- **작업 내용**:
  - [ ] getDatabase() 대신 userId 기반 데이터베이스 로드
  - [ ] 모델 정보 조회 로직 구현
  - [ ] 모델 플래그 관리

#### Phase 2.1.2: OpenRouter 서버 사이드 구현
- **파일**: `src/server/model/openrouter.ts`
- **작업 내용**:
  - [ ] getDatabase() 대신 userId 기반 데이터베이스 로드
  - [ ] OpenRouter API 통합

**예상 작업량**: 2-3일

---

## 3. 기타 모듈

### 3.1 클라이언트 사이드 의존성 제거 (P0 - Critical)

**현재 상태**: 많은 모듈이 클라이언트 사이드 파일을 import

#### Phase 3.1.1: Util 함수 마이그레이션
- **작업 내용**:
  - [ ] `getPersonaPrompt`, `getUserName`, `getAuthorNoteDefaultText` 서버 사이드 구현
  - [ ] `findCharacterbyId` 서버 사이드 구현
  - [ ] `parseToggleSyntax`, `prebuiltAssetCommand` 서버 사이드 구현
  - [ ] `additionalInformations` 서버 사이드 마이그레이션
  - [ ] `getGenerationModelString` 서버 사이드 마이그레이션
  - [ ] `getModuleAssets`, `getModuleToggles` 서버 사이드 마이그레이션

#### Phase 3.1.2: Process 함수 마이그레이션
- **작업 내용**:
  - [ ] `exampleMessage` 서버 사이드 마이그레이션
  - [ ] `processScript`, `processScriptFull` 서버 사이드 마이그레이션
  - [ ] `runImageEmbedding` 서버 사이드 마이그레이션
  - [ ] `getInlayAsset` 서버 사이드 마이그레이션 (이미 구현됨, 통합 필요)

#### Phase 3.1.3: Parser 함수 마이그레이션
- **작업 내용**:
  - [ ] `risuChatParser` 서버 사이드 마이그레이션 (일부 완료, 완성 필요)
  - [ ] `parseChatML` 서버 사이드 마이그레이션

#### Phase 3.1.4: Memory 함수 마이그레이션
- **작업 내용**:
  - [ ] `hypaMemoryV2`, `hypaMemoryV3` 서버 사이드 마이그레이션
  - [ ] `runEmbedding`, `runSummarizer` 서버 사이드 마이그레이션
  - [ ] `stringlizeChat` 서버 사이드 마이그레이션

**예상 작업량**: 8-12일

---

## 4. 통합 및 테스트

### 4.1 API 엔드포인트 구현 (P0 - Critical)

#### Phase 4.1.1: 채팅 API
- **작업 내용**:
  - [ ] POST `/api/chat/send` - 채팅 전송
  - [ ] GET `/api/chat/{chatId}` - 채팅 조회
  - [ ] WebSocket `/api/chat/stream` - 스트리밍 채팅

#### Phase 4.1.2: 이미지 생성 API
- **작업 내용**:
  - [ ] POST `/api/image/generate` - 이미지 생성
  - [ ] GET `/api/image/{imageId}` - 이미지 조회

#### Phase 4.1.3: TTS API
- **작업 내용**:
  - [ ] POST `/api/tts/generate` - TTS 생성
  - [ ] GET `/api/tts/{ttsId}` - TTS 오디오 조회

#### Phase 4.1.4: 파일 처리 API
- **작업 내용**:
  - [ ] POST `/api/file/upload` - 파일 업로드
  - [ ] GET `/api/inlay/{assetId}` - Inlay 에셋 조회
  - [ ] POST `/api/file/multisend` - Multisend 파일 처리

**예상 작업량**: 5-7일

---

### 4.2 에러 처리 및 로깅 (P1 - High)

#### Phase 4.2.1: 통합 에러 처리
- **작업 내용**:
  - [ ] 에러 타입 정의
  - [ ] 에러 핸들러 구현
  - [ ] 에러 로깅 시스템

#### Phase 4.2.2: 로깅 시스템
- **작업 내용**:
  - [ ] 구조화된 로깅
  - [ ] 로그 레벨 관리
  - [ ] 로그 저장소 통합

**예상 작업량**: 2-3일

---

### 4.3 성능 최적화 (P2 - Medium)

#### Phase 4.3.1: 캐싱 전략 개선
- **작업 내용**:
  - [ ] 프롬프트 캐싱 최적화
  - [ ] 토큰 계산 결과 캐싱
  - [ ] Lorebook 결과 캐싱

#### Phase 4.3.2: 데이터베이스 쿼리 최적화
- **작업 내용**:
  - [ ] N+1 쿼리 문제 해결
  - [ ] 인덱스 최적화
  - [ ] 배치 처리 구현

**예상 작업량**: 3-5일

---

## 우선순위별 작업 계획

### Phase A: 핵심 기능 완성 (P0)
1. Request 모듈 완성 (OpenAI, Anthropic, Google)
2. Chat 모듈 완성 (프롬프트 템플릿, 토큰 계산, 메모리 통합, 스트리밍)
3. 클라이언트 사이드 의존성 제거 (Util, Process 함수)
4. API 엔드포인트 구현

**예상 기간**: 25-35일

### Phase B: 주요 기능 완성 (P1)
1. Trigger 모듈 완성 (V2 이펙트, 데이터베이스 통합)
2. Scripting 모듈 완성 (누락된 API, 데이터베이스 통합)
3. Memory 모듈 완성 (HypaMemory V2/V3)
4. Model 모듈 서버 사이드 구현

**예상 기간**: 15-20일

### Phase C: 보조 기능 및 최적화 (P2)
1. Auxiliary 모듈 완성
2. 성능 최적화
3. 에러 처리 및 로깅

**예상 기간**: 10-15일

---

## 총 예상 작업량

- **Phase A (P0)**: 25-35일
- **Phase B (P1)**: 15-20일
- **Phase C (P2)**: 10-15일
- **총계**: 50-70일

---

## 다음 단계

Phase A부터 시작하여 핵심 기능을 완성하는 것을 권장합니다.
