# Import 마이그레이션 진행 상황

## 개요

`src/server` 모듈에서 클라이언트 사이드 파일(`src/ts/`)을 import하는 대신, 서버 사이드 모듈(`src/server`)에서 가져와서 사용하도록 마이그레이션하는 진행 상황을 추적합니다.

## 완료된 마이그레이션

### ✅ Util 함수들
- [x] `checkNullish` → `src/server/util`
- [x] `asBuffer` → `src/server/util`
- [x] `prebuiltAssetCommand` → `src/server/util`
- [x] `parseToggleSyntax` → `src/server/util`
- [x] `getPersonaPrompt` → `src/server/util/database.ts` (새로 구현)
- [x] `getUserName` → `src/server/util/database.ts` (새로 구현)
- [x] `getUserIcon` → `src/server/util/database.ts` (새로 구현)
- [x] `getAuthorNoteDefaultText` → `src/server/util/database.ts` (새로 구현)
- [x] `findCharacterbyId` → `src/server/util/database.ts` (새로 구현)

### ✅ 타입 정의들
- [x] `OpenAIChat` → `src/server/process/types`
- [x] `MultiModal` → `src/server/process/types`

### ✅ Tokenizer
- [x] `tokenize` → `src/server/tokenizer`

### ✅ Parser
- [x] `risuChatParser` → `src/server/parser` (이미 구현됨)
- [x] `parseChatML` → `src/server/parser/chat-ml.ts` (새로 구현)
- [x] `hasher` → `src/server/util/hash.ts` (새로 구현)

### ✅ Mutex
- [x] `Mutex` → `src/server/util/mutex.ts` (새로 구현)

### ✅ Process 함수들
- [x] `exampleMessage` → `src/server/process/example-messages.ts` (새로 구현)

### ✅ Model
- [x] `getModelInfo` → `src/server/model/modellist-server.ts` (userId 기반으로 재구현)
- [x] `Parameter` 타입 → `src/server/process/request/types`에서 사용

## 수정된 파일들

1. `src/server/characters/utils.ts` - `checkNullish` import 수정
2. `src/server/characters/create.ts` - `checkNullish` import 수정
3. `src/server/characters/chat-io.ts` - `checkNullish` import 수정
4. `src/server/tokenizer/chat-tokenizer.ts` - 타입 import 수정
5. `src/server/tokenizer/utils.ts` - 타입 import 수정
6. `src/server/lua-service.ts` - 여러 import 수정
7. `src/server/process/chat/send-chat.ts` - 여러 import 수정
8. `src/server/process/scripting/lua.ts` - 여러 import 수정
9. `src/server/process/request/base.ts` - `getModelInfo` async로 변경, userId 전달
10. `src/server/process/context.ts` - `getModelInfo` import 수정
11. `src/server/model/types.ts` - `Parameter` 타입 import 수정

## TODO: 남은 마이그레이션

### Parser 관련
- [x] `parseChatML` → 서버 사이드 구현 완료
- [x] `hasher` → 서버 사이드 구현 완료

### Process 함수들
- [x] `exampleMessage` → 서버 사이드 마이그레이션 완료
- [ ] `processScript`, `processScriptFull` → 서버 사이드 마이그레이션 필요
- [ ] `runImageEmbedding` → 서버 사이드 마이그레이션 필요
- [ ] `getInlayAsset` → 이미 구현됨, 통합 필요
- [ ] `hypaMemoryV2`, `hypaMemoryV3` → 서버 사이드 마이그레이션 필요

### Global API
- [ ] `readImage` → 서버 사이드 구현 필요
- [ ] `globalFetch` → 서버 사이드 HTTP 클라이언트로 교체

### Model 관련
- [x] `getModelInfo` → `src/server/model/modellist-server.ts`에서 userId 기반으로 재구현 완료
- [x] `Parameter` 타입 → `src/server/process/request/types`에서 사용

### 기타
- [ ] `getGenerationModelString` → 서버 사이드 마이그레이션
- [ ] `getModuleAssets`, `getModuleToggles` → 서버 사이드 마이그레이션
- [ ] `additionalInformations` → 서버 사이드 마이그레이션
- [ ] `generateAIImage` → `src/server/process/auxiliary/image-generation.ts`로 이동
- [ ] `writeInlayImage` → `src/server/process/auxiliary/file-processing.ts`로 이동
- [ ] `getModuleLorebooks` → 서버 사이드 마이그레이션

## 다음 단계

1. **Parser 함수들 마이그레이션** (parseChatML, hasher)
2. **Process 함수들 마이그레이션** (exampleMessage, processScript 등)
3. **Global API 교체** (readImage, globalFetch)
4. **Model 모듈 수정** (getModelInfo userId 기반)
