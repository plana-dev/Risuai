# Phase 3 구현 완료 보고서

## 개요

Phase 3: Lua Engine 통합을 완료했습니다. 서버 사이드에서 Lua 스크립트를 실행할 수 있는 서비스를 구현했습니다.

## 구현 내용

### 1. wasmoon 서버 통합

**파일**: `src/server/lua-service.ts`

- LuaFactory 싱글톤 패턴으로 관리
- json.lua 라이브러리 사전 로드
- 서버 환경에 맞게 LuaFactory 초기화

```typescript
async function makeLuaFactory(): Promise<void> {
  const _luaFactory = new LuaFactory();
  // json.lua 파일 로드
  await mountFile('json.lua');
  luaFactory = _luaFactory;
}
```

### 2. Lua API 함수 등록

기존 `src/ts/process/scriptings.ts`의 API 함수들을 서버 환경에 맞게 재구현:

**기본 API:**
- `getChatVar`, `setChatVar` - Redis를 사용한 스크립트 변수 관리
- `getChatMain`, `getFullChatMain` - 채팅 데이터 접근
- `setChat`, `addChat`, `removeChat` - 채팅 메시지 조작
- `getTokens` - 토큰 카운팅
- `cbs` - CBS 파싱
- `hash` - 해시 함수

**Low Level Access API:**
- `request` - HTTP 요청 (제한: 5회/분, HTTPS만 허용)
- `LLMMain`, `simpleLLM` - LLM 요청 (TODO: 실제 구현 필요)

**캐릭터 정보 API:**
- `getName`, `getDescription`, `getCharacterFirstMessage`
- `getPersonaName`, `getPersonaDescription`
- `getAuthorsNote`
- `getCharacterLastMessage`, `getUserLastMessage`

### 3. 트리거 스크립트 실행 로직

**구현된 함수:**

1. **`runServerScript`** - 서버 사이드 Lua 스크립트 실행
   - Redis를 사용한 스크립트 변수 관리
   - Database 어댑터를 통한 데이터 접근
   - 보안 ID 기반 접근 제어

2. **`runLuaEditTrigger`** - Edit 모드 트리거 실행
   - `editInput`, `editOutput`, `editDisplay`, `editRequest` 모드 지원
   - character의 `triggerscript`에서 Lua 타입 트리거 실행

3. **`runLuaButtonTrigger`** - 버튼 클릭 트리거 실행
   - `onButtonClick` 모드로 실행
   - lowLevelAccess 지원

## 파일 구조

```
src/
├── server/
│   ├── lua-service.ts          # Lua 엔진 서비스
│   └── index.ts                # 서비스 export 추가
└── routes/
    └── api/
        └── script/
            └── +server.ts      # Lua 스크립트 실행 API
```

## API 사용 예제

### 1. Lua 스크립트 실행

```typescript
// POST /api/script
{
  "action": "runScript",
  "userId": "user123",
  "characterId": "char456",
  "chatId": "chat789",
  "code": "function onInput(id) return 'Hello' end",
  "mode": "input"
}
```

### 2. Edit 트리거 실행

```typescript
// POST /api/script
{
  "action": "runEditTrigger",
  "userId": "user123",
  "characterId": "char456",
  "chatId": "chat789",
  "mode": "editInput",
  "data": "User message"
}
```

### 3. 버튼 클릭 트리거 실행

```typescript
// POST /api/script
{
  "action": "runButtonTrigger",
  "userId": "user123",
  "characterId": "char456",
  "chatId": "chat789",
  "data": "button_data"
}
```

## 기존 코드와의 차이점

### 클라이언트 사이드 (`src/ts/process/scriptings.ts`)
- 브라우저 API 사용 (Image, Blob, URL 등)
- Svelte stores 사용
- 로컬 데이터베이스 접근
- 모듈 트리거 지원 (`getModuleTriggers`)

### 서버 사이드 (`src/server/lua-service.ts`)
- Node.js 환경에 최적화
- Redis를 통한 스크립트 변수 관리
- Database 어댑터를 통한 데이터 접근
- character의 `triggerscript`만 사용 (모듈 트리거는 클라이언트에서 처리)

## 보안 기능

1. **접근 제어**: `scriptingSafeIds`, `scriptingLowLevelIds`, `scriptingEditDisplayIds`로 API 접근 제어
2. **요청 제한**: HTTP 요청은 5회/분으로 제한
3. **URL 검증**: HTTPS만 허용, 특정 도메인 차단
4. **스크립트 변수 격리**: 사용자별, 캐릭터별, 채팅별로 변수 격리

## 제한사항

1. **LLM API**: `LLMMain`, `simpleLLM` 함수는 아직 구현되지 않음 (TODO)
2. **이미지 처리**: 브라우저 전용 API (`getCharacterImageMain`, `getPersonaImageMain`)는 서버에서 사용 불가
3. **모듈 트리거**: 서버에서는 character의 `triggerscript`만 사용, 모듈 트리거는 클라이언트에서 처리
4. **Alert 함수**: `alertError`, `alertNormal` 등은 서버에서 사용 불가 (로깅으로 대체)

## 다음 단계

1. **LLM API 구현**: 실제 LLM 요청 처리 로직 추가
2. **에러 처리 개선**: 더 상세한 에러 메시지 및 로깅
3. **성능 최적화**: 엔진 재사용 및 캐싱 전략
4. **테스트 코드 작성**: 단위 테스트 및 통합 테스트

---

**작성일**: 2026년 1월 14일  
**상태**: Phase 3 완료 ✅
