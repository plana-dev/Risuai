# 미완료 기능 분류 (서버-클라이언트 분리 원칙 기준)

**작성일**: 2026년 1월  
**기준**: `docs/MIGRATION_PROGRESS_REPORT.md` (706-731) 완료 제외 항목 분석  
**참고**: `docs/SERVER_CLIENT_SEPARATION.md` - 서버-클라이언트 기능 분리 원칙

---

## 📋 개요

이 문서는 마이그레이션 매핑 관계에서 **완료가 아닌 항목들**을 파악하고, **서버-클라이언트 기능 분리 원칙**에 따라 분류합니다.

---

## 🔍 미완료 항목 목록

### 완료가 아닌 항목 (완료 제외)

| 원본 (`src/ts`) | 서버화 (`src/server`) | 진행률 | 상태 |
|----------------|---------------------|--------|------|
| `process/index.svelte.ts` | `process/chat/send-chat.ts` | 85% | ✅ |
| `process/request/*` | `process/request/*` | 80% | ✅ |
| `process/memory/*` | `process/memory/*` | 70% | ✅ |
| `process/triggers.ts` | `process/trigger/runner.ts` | 50% | 🟡 |
| `process/scriptings.ts` | `process/scripting/lua.ts` | 60% | 🟡 |
| `process/tts.ts` | `process/auxiliary/tts.ts` | 70% | ✅ |
| `process/transformers.ts` | `process/auxiliary/image-embedding.ts` | 진행 중 | 🟡 |
| `util.ts` | `util/*` (분리됨) | 90% | ✅ |
| `parser/*` | `parser/*` | 85% | ✅ |
| `tokenizer.ts` | `tokenizer/*` | 95% | ✅ |
| `characters.ts` | `characters/*` | 90% | ✅ |
| `persona.ts` | `persona/*` | 80% | ✅ |
| `model/*` | `model/*` | 70% | 🟡 |

---

## 🎯 분류 기준

서버-클라이언트 기능 분리 원칙에 따라 다음으로 분류:

1. **서버 권위 (Authoritative)**: 상태 변경, 비즈니스 로직, 영속성 관리
2. **클라이언트 연출 (View/Actor)**: 표시, 연출, UI 처리
3. **클라이언트 전용**: 서버에서 제외된 기능
4. **서버 구현 필요**: 서버에서 구현해야 하지만 아직 미완성

---

## 📊 미완료 기능 상세 분류

### 1. Process/Chat 모듈 (85%)

#### 서버 구현 필요 (서버 권위)

- ✅ **스트리밍 처리**: 기본 구현 완료, 세부 최적화 필요
- ✅ **프롬프트 조립**: 완료
- ✅ **메모리 시스템 통합**: 완료
- ✅ **상태 저장**: 완료
- ✅ **WebSocket 스트리밍 엔드포인트**: 구현 완료 (P1)

#### 클라이언트로 위임 (클라이언트 연출)

- ❌ **멀티모달 변환**: 클라이언트에서 처리 (서버는 받은 데이터만 전달)
- ❌ **이미지 임베딩**: 클라이언트에서 처리 (선택적, 서버에서 제외)
- ❌ **Emotion 처리**: 클라이언트 전용 (UI 상태 업데이트)

**분류**: 서버 구현 필요 (스트리밍 최적화, WebSocket) + 클라이언트로 위임 (멀티모달, 이미지 임베딩, Emotion)

---

### 2. Process/Request 모듈 (80%)

#### 서버 구현 필요 (서버 권위)

- ✅ **재시도 로직**: base.ts의 requestChatData에서 재시도 로직 구현 완료
- ✅ **Fallback 로직**: base.ts의 requestChatData에서 Fallback 로직 구현 완료 (Google provider는 base.ts에서 처리)
- ✅ **LLMFlags 체크 로직**: `reformater` 함수에서 LLMFlags 체크 로직 추가 완료 (requiresAlternateRole, mustStartWithUserInput)
- ⏳ **다른 모델 구현체**: `base.ts`에서 다른 형식들 추가 필요

#### 구현 배제 (추후 확장 기능)

- ❌ **Tool calls 처리**: MCP를 통해 내부 정보(캐릭터 정보 등)를 사용하는 기능
  - 일반 채팅에서 외부 검색이 필요한 것도 아님
  - 추후 확장 기능으로 분리
  - 현재는 구현 배제

**분류**: 서버 구현 필요 (재시도, Fallback, LLMFlags 체크) + 구현 배제 (Tool calls - 추후 확장)

---

### 3. Process/Memory 모듈 (70%)

#### 서버 구현 필요 (서버 권위)

- ✅ **SupaMemory 전체 구현**: 전체 구현 완료
  - 요약 로직, 메모리 저장/로드, HypaMemory 통합 완료
  - subModel을 사용한 요약 API 기반 구현 완료
- ✅ **로컬 모델 요약**: API 기반으로 동작하도록 구현 완료 (subModel 사용)
  - `requestChatData`를 호출하여 subModel로 요약 생성
- ✅ **로컬 모델 임베딩**: API 기반으로 동작하도록 구현 완료
  - 로컬 모델 서버 API 호출 또는 커스텀 임베딩 URL 사용
  - `hypa-processor.ts`에서 로컬 모델 임베딩 API 기반 처리

**분류**: 서버 구현 필요 (모두 구현 완료, API 기반)

**결정**: API 기반으로 동작하도록 구현 완료.

---

### 4. Process/Trigger 모듈 (50%)

#### 서버 구현 필요 (서버 권위)

- ✅ **Lua 트리거 스크립트**: 기본 Lua 트리거 스크립트 구현 완료 (일부 이펙트 구현 필요)
- ✅ **displayAllowList, requestAllowList 체크**: 보안 체크 로직 구현 완료
- ✅ **데이터베이스 저장 통합**: 트리거 실행 결과 저장 로직 완료 (setVar에서 adapter.saveChat 호출)

#### 구현 배제 (추후 추가 검토)

- ❌ **V2 이펙트 완전 구현**: 
  - `v2Loop`: 루프 처리
  - `v2GetLorebook`: 로어북 가져오기
  - `v2ModifyLorebook`: 로어북 수정
  - 기타 V2 이펙트들
- ❌ **코드 실행 처리**: 추후 추가 검토 필요

**분류**: 서버 구현 필요 (Lua 트리거 스크립트, 보안 체크, DB 저장) + 구현 배제 (V2 이펙트, 코드 실행 - 추후 검토)

---

### 5. Process/Scripting 모듈 (60%)

#### 서버 구현 필요 (서버 권위)

- ✅ **누락된 API 함수 구현**:
  - ✅ `getSelectedCharID`: characterId를 인덱스로 변환하여 반환하도록 구현 완료
  - ✅ `findCharacterbyId`: 캐릭터 찾기 구현 완료
  - ⏳ 기타 누락된 API 함수들 확인 필요
- ✅ **모듈 로어북 가져오기**: `parser-context.ts`에서 모듈 로어북 가져오기 구현 완료

#### 검토 필요

- ⚠️ **LLMMain, simpleLLM 완전 구현**: 스크립트에서 LLM 호출이 타당한지 검토 필요
  - 스크립트에서 LLM을 호출하는 것이 적절한지 검토
  - 보안 및 성능 측면에서 검토 필요

**분류**: 서버 구현 필요 (API 함수, 모듈 로어북) + 검토 필요 (LLM 호출)

---

### 6. Process/Auxiliary 모듈 (70%)

#### 서버 구현 필요 (서버 권위) - API 지원만

- ✅ **외부 API 호출 지원**: 구현 완료
  - ✅ TTS API: 외부 TTS API 호출 지원 완료 (ElevenLabs, VOICEVOX, OpenAI, NovelAI, HuggingFace, GPT-SoVITS, FishSpeech)
    - `tts.ts`: 모든 외부 TTS API 지원 완료
    - 오디오 데이터를 base64로 반환 (클라이언트에서 재생)
  - ✅ ComfyUI API: 외부 ComfyUI API 호출 지원 완료
    - `image-generation.ts`: ComfyUI 이미지 생성 API 지원 완료
    - 워크플로우 구성 및 이미지 생성 완료 대기 로직 구현
  - ✅ 번역 API: 외부 번역 API 호출 지원 완료
    - `translation.ts`: DeepL, DeepLX, Google Translate, LLM 번역 지원 완료
    - 로컬 모델 번역은 클라이언트에서 처리 (Bergamot 등)

#### 클라이언트로 위임 (클라이언트 연출)

- ❌ **이미지 임베딩**: 클라이언트 처리로 위임 (서버에서 제외)
- ❌ **TTS 재생**: 클라이언트 전용 (서버는 API 호출만, 재생은 클라이언트)
- ❌ **이미지 생성 (UI 연출용)**: 클라이언트 전용 (Stable Diffusion 등)
- ❌ **이모션 출력**: 클라이언트 전용 (UI 상태 업데이트)
- ❌ **번역 (로컬 모델)**: 로컬 모델 사용 시 클라이언트에서 처리하는 것이 좋음
  - 서버는 외부 번역 API 호출만 지원
  - 로컬 모델 번역은 클라이언트에서 처리

**분류**: 서버 구현 필요 (외부 API 호출 지원 완료) + 클라이언트로 위임 (재생, 표시, 로컬 모델 번역)

**결정**: 외부 API 호출 지원 완료.

---

### 7. Process/Transformers 모듈 (진행 중)

#### 클라이언트로 위임 (클라이언트 연출)

- ❌ **이미지 임베딩**: 클라이언트 처리로 위임 (서버에서 제외)
  - 서버 사이드 transformers 모듈 마이그레이션 불필요
  - 클라이언트에서 처리하도록 결정

**분류**: 클라이언트로 위임 (서버에서 제외)

---

### 8. Util 모듈 (90%)

#### 서버 구현 필요 (서버 권위)

- ✅ **누락된 유틸 함수**: 구현 완료
  - `findCharacterIndexbyId`: 캐릭터 ID로 인덱스 찾기 추가 완료
  - `getCharacterIndexObject`: 캐릭터 인덱스 객체 생성 추가 완료
  - `getUserIconProtrait`: 사용자 아이콘 포트레이트 가져오기 추가 완료
  - `blobToUint8Array`: Blob을 Uint8Array로 변환 추가 완료
  - `replacePlaceholders`: 플레이스홀더 치환 함수 추가 완료 (placeholder.ts)

**분류**: 서버 구현 필요 (모두 구현 완료)

**결정**: 모두 구현 완료.

---

### 9. Parser 모듈 (85%)

#### 서버 구현 필요 (서버 권위)

- ✅ **파서 기능**: 서버에 대부분 구현 완료
  - `parseChatML`: ChatML 파싱 구현 완료
  - `risuChatParser`: CBS 파서 구현 완료
  - 에셋 파싱, 변수 처리, 메타데이터 등 대부분 구현 완료
- ✅ **에셋 ID 관리**: 클라이언트에서 처리할 수 있도록 에셋 ID만 관리 (구현 완료)

#### 구현 배제

- ❌ **에셋 파싱 최적화**: 이미지 리사이징 및 최적화 로직은 필요 없음
  - 클라이언트에서 처리할 수 있도록 에셋 ID만 관리

**분류**: 서버 구현 필요 (대부분 구현 완료)

**결정**: 대부분 구현 완료. 추가 확인 필요 시 진행.

---

### 10. Tokenizer 모듈 (95%)

#### 서버 구현 필요 (서버 권위)

- ✅ **플러그인 토크나이저 제거**: `pluginTokenizer` 처리 로직 제거 완료
- ✅ **public/token 사용 가능 여부 체크**: `public/token` 디렉토리를 서버에서 사용 가능 (file-loader.ts에서 FileSystemTokenizerLoader 사용)
- ⏳ **누락된 토크나이저**: 일부 토크나이저 누락 가능성

**분류**: 서버 구현 필요 (플러그인 토크나이저 제거 완료, public/token 사용 가능 확인 완료, 누락된 토크나이저 확인 필요)

**결정**: pluginTokenizer 제거 완료, `public/token` 사용 가능 확인 완료

---

### 11. Characters 모듈 (90%)

#### 서버 구현 필요 (서버 권위)

- ✅ **캐릭터 처리 기능**: 대부분 구현 완료
  - `createBlankChar`, `createBlankGroup`: create.ts에 구현 완료
  - `characterFormatUpdate`: create.ts에 구현 완료
  - `dumpCharImage`, `changeCharImage`, `rmCharEmotion`: assets.ts에 구현 완료
  - `updateLorebooks`: utils.ts에 구현 완료
  - `importCharacter`, `exportCharacter`: import.ts에 구현 완료
  - 채팅 IO 함수들: chat-io.ts에 구현 완료
- ❌ **클라이언트 전용 기능**: 제외
  - `createNewCharacter`: 데이터베이스 직접 조작 (서버에서는 API 엔드포인트로 처리)
  - `getCharImage`: 이미지 URL 가져오기 (클라이언트 전용)
  - `selectCharImg`: 파일 선택 (클라이언트 전용)

**분류**: 서버 구현 필요 (대부분 구현 완료)

**결정**: 대부분 구현 완료. 클라이언트 전용 기능은 제외.

---

### 12. Persona 모듈 (80%)

#### 서버 구현 필요 (서버 권위)

- ✅ **Persona 처리 기능**: 대부분 구현 완료
  - `exportPersona`: export.ts에 구현 완료
  - `importPersona`: import.ts에 구현 완료
  - 이미지 처리: image.ts에 구현 완료
  - 타입 정의: types.ts에 구현 완료
- ❌ **클라이언트 전용 기능**: 제외
  - `selectUserImg`: 파일 선택 (클라이언트 전용)
  - `saveUserPersona`, `changeUserPersona`: 데이터베이스 직접 조작 (서버에서는 API 엔드포인트로 처리)

**분류**: 서버 구현 필요 (대부분 구현 완료)

**결정**: 대부분 구현 완료. 클라이언트 전용 기능은 제외.

---

### 13. Model 모듈 (70%)

#### 서버 구현 필요 (서버 권위)

- ✅ **OpenRouter 서버 사이드 완전 구현**: 구현 완료
  - `openrouter.ts`: userId 기반으로 데이터베이스 접근하도록 수정
  - `getFreeOpenRouterModel`: userId 파라미터 추가
  - `openai.ts`에서 OpenRouter 처리 완료 (openrouter 모델일 때 특별 처리)
- ✅ **Ooba 서버 사이드 구현**: 구현 완료
  - `ooba.ts`: requestOoba, requestOobaLegacy 구현 완료
  - `base.ts`에 Ooba, OobaLegacy 형식 추가
- ✅ **Local 모델 서버 사이드 구현**: 기본 구조 구현 완료 (선택적)
  - `local.ts`: 로컬 모델 서버 API 호출 구현
  - localhost:7239 또는 localhost:10026 사용
  - `base.ts`에서 local_로 시작하는 모델 ID 처리

**분류**: 서버 구현 필요 (모두 구현 완료)

**결정**: 모두 구현 완료.

---

## 📊 분류 요약

### 서버 구현 필요 (서버 권위)

| 모듈 | 미완료 기능 | 우선순위 |
|------|-----------|---------|
| **Process/Chat** | WebSocket 스트리밍 엔드포인트 완료 | P1 |
| **Process/Request** | 재시도, Fallback, LLMFlags 체크 완료 (Tool calls는 추후 확장) | P1 |
| **Process/Memory** | SupaMemory 전체 구현 완료, API 기반으로 모두 구현 완료 | P1 |
| **Process/Trigger** | Lua 트리거 스크립트 완료, 보안 체크 완료, DB 저장 완료 (V2 이펙트는 추후 검토) | P1 |
| **Process/Scripting** | 누락된 API 함수 완료, 모듈 로어북 완료 (LLM 호출은 검토 필요) | P1 |
| **Process/Auxiliary** | 외부 API 호출 지원 완료 (TTS, ComfyUI, 번역 등) | P2 |
| **Util** | 누락된 유틸 함수 완료 | P2 |
| **Parser** | 누락된 파서 기능 완료, 에셋 ID 관리 완료 (이미지 리사이징은 배제) | P2 |
| **Tokenizer** | pluginTokenizer 제거 완료, public/token 체크 완료 | P2 |
| **Characters** | 누락된 캐릭터 처리 기능 완료 | P2 |
| **Persona** | 누락된 Persona 처리 기능 완료 | P2 |
| **Model** | OpenRouter 완료, Ooba 완료, Local 모델 완료 | P1 |

### 클라이언트로 위임 (클라이언트 연출)

| 모듈 | 위임 기능 | 비고 |
|------|---------|------|
| **Process/Chat** | 멀티모달 변환, 이미지 임베딩, Emotion 처리 | 서버는 받은 데이터만 전달 |
| **Process/Auxiliary** | 이미지 임베딩, TTS 재생, 이미지 생성 (UI 연출), 이모션 출력 | 서버는 생성만, 재생/표시는 클라이언트 |
| **Process/Transformers** | 이미지 임베딩 | 클라이언트 처리로 위임 |

---

## 🎯 우선순위별 작업 계획

### P0 (Critical) - 핵심 기능

1. **Process/Request 모듈 완성**
   - ✅ 재시도 및 Fallback 로직 완료
   - ✅ LLMFlags 체크 로직 완료
   - Tool calls는 추후 확장 기능으로 분리 (현재 구현 배제)

2. **Process/Trigger 모듈 완성**
   - ✅ Lua 트리거 스크립트 구현 완료 (기본 구조)
   - ✅ 보안 체크 완료 (displayAllowList, requestAllowList)
   - ✅ 데이터베이스 저장 통합 완료
   - V2 이펙트, 코드 실행은 추후 추가 검토 (현재 구현 배제)

3. **Process/Memory 모듈 완성**
   - ✅ SupaMemory 전체 구현 완료
   - ✅ API 기반으로 모두 구현 완료 (로컬 모델은 API 기반으로 동작)

4. **Process/Scripting 모듈 완성**
   - ✅ 누락된 API 함수 구현 완료 (getSelectedCharID, findCharacterbyId)
   - ✅ 모듈 로어북 가져오기 완료
   - LLM 호출은 타당성 검토 필요

5. **Model 모듈 완성**
   - ✅ OpenRouter 완전 구현 완료
   - ✅ Ooba 서버 사이드 구현 완료
   - ✅ Local 모델 지원 완료 (선택적, 로컬 모델 서버 필요)

### P1 (High) - 주요 기능

1. **Process/Chat 모듈 완성**
   - WebSocket 스트리밍 엔드포인트
   - 스트리밍 처리 세부 최적화

2. **Process/Auxiliary 모듈 완성**
   - ✅ 외부 API 호출 지원 완료 (TTS, ComfyUI, 번역 등)
   - ✅ 클라이언트에서 호출하여 사용할 수 있도록 API 지원 완료
   - ✅ 번역은 로컬 모델 사용 시 클라이언트에서 처리 (외부 API만 서버 지원)

### P2 (Medium) - 보조 기능

1. **Util, Parser, Tokenizer 모듈 완성**
   - ✅ Util: 누락된 함수 확인 및 구현 완료
   - ✅ Parser: 누락된 기능 확인 및 구현 완료, 에셋 ID 관리 완료 (이미지 리사이징은 배제)
   - ✅ Tokenizer: pluginTokenizer 제거 완료, public/token 체크 완료

2. **Characters, Persona 모듈 완성**
   - ✅ Characters: 누락된 처리 기능 확인 및 구현 완료
   - ✅ Persona: 누락된 처리 기능 확인 및 구현 완료

---

## 🔄 클라이언트로 위임된 기능

다음 기능들은 **서버에서 구현하지 않고 클라이언트에서 처리**합니다:

### Process/Chat 모듈

- **멀티모달 변환**: 클라이언트에서 Inlay 태그 추출 및 multimodals 배열 구성
- **이미지 임베딩**: 클라이언트에서 이미지 임베딩 실행 (선택적)
- **Emotion 처리**: 클라이언트 전용 (UI 상태 업데이트)

### Process/Auxiliary 모듈

- **이미지 임베딩**: 클라이언트 처리로 위임 (서버에서 제외)
- **TTS 재생**: 클라이언트 전용 (서버는 오디오 데이터 생성만)
- **이미지 생성 (UI 연출용)**: 클라이언트 전용 (Stable Diffusion 등)
- **이모션 출력**: 클라이언트 전용 (UI 상태 업데이트)

### Process/Transformers 모듈

- **이미지 임베딩**: 클라이언트 처리로 위임 (서버에서 제외)

**참고**: 서버는 클라이언트가 구성한 데이터를 그대로 LLM에 전달하거나, 생성한 데이터를 클라이언트로 전송합니다.

---

## 📝 체크리스트

### 서버 구현 체크리스트

- [x] Process/Request: 재시도 및 Fallback 로직 완전 구현 ✅
- [x] Process/Request: LLMFlags 체크 로직 구현 ✅
- [x] Process/Request: Tool calls는 추후 확장 기능으로 분리 (현재 구현 배제)
- [x] Process/Trigger: Lua 트리거 스크립트 구현 (기본 구조 완료, 일부 이펙트 구현 필요)
- [x] Process/Trigger: 보안 체크 로직 구현 (displayAllowList, requestAllowList 추가 완료)
- [x] Process/Trigger: 데이터베이스 저장 통합 (setVar에서 adapter.saveChat 호출 완료)
- [ ] Process/Trigger: V2 이펙트, 코드 실행은 추후 검토 (현재 구현 배제)
- [x] Process/Memory: SupaMemory 전체 구현 완료 (API 기반) ✅
- [x] Process/Memory: 로컬 모델 지원 완료 (API 기반으로 구현) ✅
- [x] Process/Scripting: 누락된 API 함수 구현 ✅
- [ ] Process/Scripting: LLM 호출 타당성 검토
- [x] Process/Auxiliary: 외부 API 호출 지원만 (TTS, ComfyUI 등) ✅
- [x] Process/Auxiliary: 번역은 로컬 모델 사용 시 클라이언트에서 처리 ✅
- [x] Process/Chat: WebSocket 스트리밍 엔드포인트 구현 ✅
- [x] Model: OpenRouter, Ooba, Local 모델 완전 구현 완료 ✅
- [x] Util: 누락된 함수 확인 및 구현 완료 ✅
- [x] Parser: 누락된 기능 확인 및 구현, 에셋 ID 관리 (이미지 리사이징은 배제) ✅
- [x] Tokenizer: pluginTokenizer 제거, public/token 체크 및 구현 완료 ✅
- [x] Characters: 누락된 처리 기능 확인 및 구현 완료 ✅
- [x] Persona: 누락된 처리 기능 확인 및 구현 완료 ✅

### 클라이언트 위임 체크리스트

- [ ] Process/Chat: 멀티모달 변환 로직 제거 (클라이언트로 위임)
- [ ] Process/Chat: 이미지 임베딩 로직 제거 (클라이언트로 위임)
- [ ] Process/Chat: Emotion 처리 로직 제거 (클라이언트로 위임)
- [ ] Process/Auxiliary: 이미지 임베딩 로직 제거 (클라이언트로 위임)
- [ ] Process/Auxiliary: TTS 재생 로직 제거 (클라이언트로 위임)
- [ ] Process/Auxiliary: 이미지 생성 (UI 연출) 로직 제거 (클라이언트로 위임)
- [ ] Process/Auxiliary: 이모션 출력 로직 제거 (클라이언트로 위임)
- [ ] Process/Transformers: 이미지 임베딩 로직 제거 (클라이언트로 위임)

---

---

## ✅ 구현 완료 항목 (2026년 1월 업데이트)

### 완료된 작업

1. **Tokenizer 모듈** ✅
   - ✅ `pluginTokenizer` 제거 완료
     - `encode.ts`: pluginTokenizer 관련 코드 제거
     - `context.ts`: pluginTokenizer 필드 제거
     - `types.ts`: pluginTokenizer 필드 제거 (주석으로 표시)
   - ✅ `public/token` 디렉토리 사용 가능 확인
     - `file-loader.ts`의 `FileSystemTokenizerLoader`가 `public` 폴더에서 파일 읽기
     - 모든 토크나이저 파일 경로가 `/token/*` 형식으로 사용 가능

2. **Process/Request 모듈** ✅
   - ✅ 재시도 로직: `base.ts`의 `requestChatData`에서 구현 완료
     - `trys` 카운터로 재시도 횟수 관리
     - `database.requestRetrys` 설정에 따라 재시도
     - `failByServerError`일 경우 `antiServerOverloads` 설정에 따라 재시도 횟수 조정
   - ✅ Fallback 로직: `base.ts`의 `requestChatData`에서 구현 완료
     - `fallBackModels` 배열을 순회하며 폴백 모델 시도
     - `fallbackWhenBlankResponse` 설정에 따라 빈 응답 시 폴백
   - ✅ LLMFlags 체크 로직: `reformater` 함수에 추가 완료
     - `requiresAlternateRole`: 같은 역할의 연속된 메시지를 병합
     - `mustStartWithUserInput`: 첫 메시지가 user여야 하는 경우 빈 user 메시지 추가

3. **Process/Scripting 모듈** ✅
   - ✅ `getSelectedCharID`: characterId를 인덱스로 변환하여 반환하도록 구현 완료
     - `lua.ts`의 parser contexts에서 characterId를 사용하여 인덱스 계산
   - ✅ `findCharacterbyId`: 캐릭터 찾기 구현 완료
     - `lua.ts`의 parser contexts에서 database.characters에서 찾기
   - ✅ `getModuleLorebooks`: parser-context.ts에서 모듈 로어북 가져오기 구현 완료
     - `getModuleLorebooks` 유틸 함수를 사용하여 모듈 로어북 반환

4. **Process/Trigger 모듈** ✅
   - ✅ Lua 트리거 스크립트: 기본 구조 구현 완료
     - `runner.ts`에서 트리거 실행 로직 구현
     - 조건 체크, 이펙트 실행 로직 구현
   - ✅ 보안 체크 로직: displayAllowList, requestAllowList 구현 완료
     - `safeSubset` 정의 및 displayAllowList, requestAllowList 추가
     - display/request 모드에서 허용된 이펙트만 실행하도록 체크
   - ✅ 데이터베이스 저장 통합: setVar에서 adapter.saveChat 호출 완료
     - 변수 변경 시 자동으로 데이터베이스에 저장

5. **Process/Memory 모듈** ✅
   - ✅ SupaMemory 전체 구현 완료
     - 요약 로직, 메모리 저장/로드, HypaMemory 통합 완료
     - subModel을 사용한 요약 API 기반 구현 완료
   - ✅ 로컬 모델 요약: API 기반으로 동작하도록 구현 완료
     - `requestChatData`를 호출하여 subModel로 요약 생성
     - `supa-memory.ts`의 `summarize` 함수에서 subModel 사용
   - ✅ 로컬 모델 임베딩: API 기반으로 동작하도록 구현 완료
     - 로컬 모델 서버 API 호출 (localhost:10026/embeddings)
     - 커스텀 임베딩 URL 사용 지원
     - `hypa-processor.ts`에서 로컬 모델 임베딩 API 기반 처리
   - ✅ MemoryVector 타입 개선
     - `content` 필드 추가 (하위 호환성을 위해 `text` 필드도 유지)
     - `alreadySaved` 플래그 추가 (Redis 캐시 관리)

6. **Model 모듈** ✅
   - ✅ OpenRouter 서버 사이드 완전 구현 완료
     - `openrouter.ts`: userId 기반으로 데이터베이스 접근하도록 수정
     - `getFreeOpenRouterModel`: userId 파라미터 추가
     - `openai.ts`에서 OpenRouter 처리 완료 (openrouter 모델일 때 특별 처리)
   - ✅ Ooba 서버 사이드 구현 완료
     - `ooba.ts`: requestOoba, requestOobaLegacy 구현 완료
     - `base.ts`에 Ooba, OobaLegacy 형식 추가
     - ProcessContext 없이 동작하도록 수정 (arg.currentChar 사용)
   - ✅ Local 모델 서버 사이드 구현 완료
     - `local.ts`: 로컬 모델 서버 API 호출 구현
     - localhost:7239 또는 localhost:10026 사용
     - `base.ts`에서 local_로 시작하는 모델 ID 처리

7. **Util 모듈** ✅
   - ✅ 누락된 유틸 함수 추가 완료
     - `findCharacterIndexbyId`: 캐릭터 ID로 인덱스 찾기 추가
     - `getCharacterIndexObject`: 캐릭터 인덱스 객체 생성 추가
     - `getUserIconProtrait`: 사용자 아이콘 포트레이트 가져오기 추가
     - `blobToUint8Array`: Blob을 Uint8Array로 변환 추가
     - `replacePlaceholders`: 플레이스홀더 치환 함수 추가 (placeholder.ts)

8. **Parser 모듈** ✅
   - ✅ 파서 기능 대부분 구현 완료 확인
     - `parseChatML`: ChatML 파싱 구현 완료
     - `risuChatParser`: CBS 파서 구현 완료
     - 에셋 파싱, 변수 처리, 메타데이터 등 대부분 구현 완료

9. **Characters 모듈** ✅
   - ✅ 캐릭터 처리 기능 대부분 구현 완료 확인
     - `createBlankChar`, `createBlankGroup`: create.ts에 구현 완료
     - `characterFormatUpdate`: create.ts에 구현 완료
     - `dumpCharImage`, `changeCharImage`, `rmCharEmotion`: assets.ts에 구현 완료
     - `updateLorebooks`: utils.ts에 구현 완료
     - 채팅 IO 함수들: chat-io.ts에 구현 완료

10. **Persona 모듈** ✅
   - ✅ Persona 처리 기능 대부분 구현 완료 확인
     - `exportPersona`: export.ts에 구현 완료
     - `importPersona`: import.ts에 구현 완료
     - `saveUserPersona`, `changeUserPersona`: manage.ts에 구현 완료
     - 이미지 처리: image.ts에 구현 완료

11. **Process/Auxiliary 모듈** ✅
   - ✅ 외부 API 호출 지원 완료
     - TTS API: ElevenLabs, VOICEVOX, OpenAI, NovelAI, HuggingFace, GPT-SoVITS, FishSpeech 지원 완료
     - ComfyUI API: 이미지 생성 API 지원 완료
     - 번역 API: DeepL, DeepLX, Google Translate, LLM 번역 지원 완료
     - `translation.ts`: 번역 모듈 추가 완료
     - `tts.ts`: 모든 외부 TTS API 지원 완료
     - `image-generation.ts`: ComfyUI 이미지 생성 지원 완료

12. **Process/Chat 모듈** ✅
   - ✅ WebSocket 스트리밍 엔드포인트 구현 완료
     - `server/node/routes/chat.ts`: WebSocket 서버 설정 및 스트리밍 처리 구현
     - `src/server/process/chat/types.ts`: StreamingCallback 타입 추가
     - `src/server/process/chat/send-chat.ts`: 스트리밍 콜백 지원 추가
     - `server/node/server.cjs`: WebSocket 서버 초기화 추가
     - WebSocket 경로: `/api/chat/stream`
     - 스트리밍 청크를 실시간으로 WebSocket으로 전송

---

---

## 📝 구현 완료 요약

### 완료된 주요 모듈

1. ✅ **Tokenizer 모듈**: pluginTokenizer 제거, public/token 사용 가능 확인
2. ✅ **Process/Request 모듈**: 재시도, Fallback, LLMFlags 체크 로직 완료
3. ✅ **Process/Scripting 모듈**: 누락된 API 함수 구현 완료
4. ✅ **Process/Trigger 모듈**: Lua 트리거 스크립트, 보안 체크, DB 저장 완료
5. ✅ **Process/Memory 모듈**: SupaMemory 전체 구현, 로컬 모델 요약/임베딩 API 기반 구현 완료

### 진행 중인 모듈

- ✅ **Process/Chat 모듈**: WebSocket 스트리밍 엔드포인트 구현 완료
- ⏳ **Process/Auxiliary 모듈**: 외부 API 호출 지원 구현 필요

---

**마지막 업데이트**: 2026년 1월
