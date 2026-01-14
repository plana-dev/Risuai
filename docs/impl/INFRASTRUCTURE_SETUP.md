# RisuAI 인프라 구축 상세 문서

## 개요

이 문서는 RisuAI 서비스 웹을 위한 인프라 구축 가이드입니다. Supabase (PostgreSQL + Storage), RedisLabs Cloud, wasmoon Lua Engine을 사용합니다.

---

## 1. 인프라 스택

### 1.1 데이터베이스: Supabase (PostgreSQL)

**사용 이유:**
- 관리형 PostgreSQL 서비스
- 자동 백업 및 복구
- Row Level Security (RLS) 지원
- 실시간 구독 기능
- 연결 풀링 지원

**환경 변수:**
```env
# Supabase 연결 정보
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Prisma 연결
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
```

### 1.2 스토리지: Supabase Storage

**사용 이유:**
- S3 호환 API
- CDN 통합
- 자동 이미지 최적화
- 파일 업로드/다운로드 제한 설정

**환경 변수:**
```env
SUPABASE_STORAGE_BUCKET=reluv-assets
SUPABASE_STORAGE_PUBLIC_URL=https://[project-ref].supabase.co/storage/v1/object/public
```

### 1.3 캐시: RedisLabs Cloud

**사용 이유:**
- 관리형 Redis 서비스
- 고가용성
- 자동 스케일링
- TLS 지원

**환경 변수:**
```env
REDIS_URL="redis://default:[password]@[host]:[port]"
REDIS_USERNAME=default
REDIS_PASSWORD=your-password
REDIS_SOCKET_URL=[host]
REDIS_SOCKET_PORT=[port]
```

### 1.4 Lua Script Engine: wasmoon

**사용 이유:**
- WebAssembly 기반 Lua 엔진
- 브라우저 및 Node.js에서 동작
- 기존 코드와 호환
- 안전한 샌드박스 환경

---

## 2. 데이터베이스 스키마 설계 개요

### 2.1 스키마 구조

`database.svelte.ts`의 필드들을 시스템별로 그룹화하여 테이블 설계:

1. **사용자 및 인증** → `User`, `UserSession`
2. **캐릭터 관리** → `Character`
3. **채팅 및 메시지** → `Chat`, `Message`, `ChatFolder`
4. **로어북** → `Lorebook`
5. **사용자 설정** → `UserSettings`, `Persona` (유저당 1개)
6. **에셋 관리** → `Asset`
7. **마켓플레이스** → `MarketplaceCharacter`, `MarketplaceReview`
8. **서비스 제공** → `ServiceModel`, `ServicePreset`, `UserModelSelection`
9. **스크립트 변수** → Redis 주 사용, DB는 백업

**참고:** 상세 Prisma 스키마는 별도 파일(`prisma/schema.prisma`)로 관리합니다.

---

## 3. 시스템별 필드 그룹화

### 3.1 기본 설정 및 캐릭터 관리 시스템

**사용 테이블:**
- `User` (기본 정보)
- `Character` (캐릭터 데이터)
- `UserSettings` (사용자 기본 설정)

**필드 매핑:**
```typescript
// database.svelte.ts → Prisma
{
  // User 테이블
  username: UserSettings.username
  userIcon: UserSettings.userIconUrl
  userNote: UserSettings.userNote
  language: UserSettings.language
  didFirstSetup: User.isActive (역방향)
  
  // Character 테이블
  characters: Character[] (전체)
  characterOrder: Character[] (정렬은 별도 처리)
  
  // 통계
  statics: UserSettings.advancedSettings.statics
  statistics: UserSettings.advancedSettings.statistics
}
```

### 3.2 API 및 모델 설정 시스템

**사용 테이블:**
- `ServiceModel` (서버에서 제공하는 모델)
- `UserModelSelection` (사용자 선택)
- `UserSettings.advancedSettings` (API 키 등)

**필드 매핑:**
```typescript
{
  // 서버에서 제공하는 모델
  aiModel: UserModelSelection (modelType: 'chat')
  subModel: UserModelSelection (modelType: 'translate')
  
  // API 키는 서버에서만 관리 (UserSettings.advancedSettings에 저장하지 않음)
  // openAIKey, claudeAPIKey 등은 서버 환경 변수로 관리
  
  // 모델별 설정
  novelai: ServiceModel.config (provider: 'novelai')
  ooba: UserSettings.advancedSettings.ooba
  hordeConfig: UserSettings.advancedSettings.hordeConfig
  customModels: ServiceModel (사용자 정의 모델)
}
```

### 3.3 생성 파라미터 및 프롬프트 설정 시스템

**사용 테이블:**
- `ServicePreset` (서비스 제공 프리셋)
- `UserModelSelection` (사용자가 선택한 프리셋)
- `Persona` (유저당 1개)

**설계 개념:**
- **생성 파라미터 및 프롬프트**: 서비스에서 제공하는 `ServicePreset`에서 관리
- **사용자 선택**: `UserModelSelection`에서 사용자가 선택한 프리셋 ID 저장
- **페르소나**: 유저당 1개의 `Persona`만 존재하며, `personaPrompt`는 `Persona` 테이블에 포함

**필드 매핑:**
```typescript
{
  // 서비스 제공 프리셋 (생성 파라미터, 프롬프트 포함)
  botPresets: ServicePreset[] (서비스 제공)
  botPresetsId: UserModelSelection (modelType: 'preset')
  
  // 페르소나 (유저당 1개)
  persona: Persona (userId로 조회, 1개만 존재)
  personaPrompt: Persona.personaPrompt
}
```

### 3.4 UI 및 테마 설정 시스템

**사용 테이블:**
- `UserSettings` (UI 설정)

**필드 매핑:**
```typescript
{
  // 테마
  theme: UserSettings.theme
  colorScheme: UserSettings.advancedSettings.colorScheme
  colorSchemeName: UserSettings.advancedSettings.colorSchemeName
  
  // UI 크기
  zoomsize: UserSettings.zoomsize
  iconsize: UserSettings.iconsize
  waifuWidth: UserSettings.advancedSettings.waifuWidth
  waifuWidth2: UserSettings.advancedSettings.waifuWidth2
  
  // 텍스트 테마
  textTheme: UserSettings.textTheme
  customTextTheme: UserSettings.customTextTheme
  font: UserSettings.advancedSettings.font
  customFont: UserSettings.advancedSettings.customFont
  lineHeight: UserSettings.advancedSettings.lineHeight
  
  // 배경
  customBackground: UserSettings.customBackgroundUrl
  
  // 채팅 UI
  swipe: UserSettings.advancedSettings.swipe
  sendWithEnter: UserSettings.advancedSettings.sendWithEnter
  clickToEdit: UserSettings.advancedSettings.clickToEdit
}
```

### 3.5 이미지 생성 설정 시스템

**사용 테이블:**
- `ImageGenServiceConfig` (서버 제공 서비스)
- `UserSettings.advancedSettings` (사용자 선택)

**필드 매핑:**
```typescript
{
  // 서버에서 제공하는 서비스 목록
  // sdProvider, NAIImgUrl 등은 ImageGenServiceConfig에서 관리
  
  // 사용자 선택
  sdProvider: UserSettings.advancedSettings.sdProvider
  sdSteps: UserSettings.advancedSettings.sdSteps
  sdCFG: UserSettings.advancedSettings.sdCFG
  sdConfig: UserSettings.advancedSettings.sdConfig
  NAIImgConfig: UserSettings.advancedSettings.NAIImgConfig
  stabilityModel: UserSettings.advancedSettings.stabilityModel
  dallEQuality: UserSettings.advancedSettings.dallEQuality
}
```

### 3.6 TTS 및 음성 설정 시스템

**사용 테이블:**
- `TTSServiceConfig` (서버 제공 서비스)
- `Character` (캐릭터별 TTS 설정)
- `UserSettings.advancedSettings` (전역 TTS 설정)

**필드 매핑:**
```typescript
{
  // 서버에서 제공하는 TTS 서비스
  // elevenLabKey, voicevoxUrl 등은 TTSServiceConfig에서 관리
  
  // 전역 설정
  ttsAutoSpeech: UserSettings.advancedSettings.ttsAutoSpeech
  playMessage: UserSettings.advancedSettings.playMessage
  
  // 캐릭터별 설정
  ttsMode: Character.ttsMode
  ttsSpeech: Character.ttsSpeech
  voicevoxConfig: Character.voiceConfig.voicevoxConfig
  naittsConfig: Character.voiceConfig.naittsConfig
}
```

### 3.7 번역 설정 시스템

**사용 테이블:**
- `UserSettings.advancedSettings`

**필드 매핑:**
```typescript
{
  translatorType: UserSettings.advancedSettings.translatorType
  translatorInputLanguage: UserSettings.advancedSettings.translatorInputLanguage
  autoTranslate: UserSettings.advancedSettings.autoTranslate
  useAutoTranslateInput: UserSettings.advancedSettings.useAutoTranslateInput
  deeplOptions: UserSettings.advancedSettings.deeplOptions
  deeplXOptions: UserSettings.advancedSettings.deeplXOptions
  translatorPrompt: UserSettings.advancedSettings.translatorPrompt
}
```

### 3.8 메모리 및 로어북 설정 시스템

**사용 테이블:**
- `Lorebook` (로어북 데이터)
- `Chat` (메모리 데이터)
- `MemoryServiceConfig` (서버 제공 메모리 서비스)
- `UserSettings.advancedSettings` (메모리 설정)

**필드 매핑:**
```typescript
{
  // 로어북
  loreBook: Lorebook[] (characterId 또는 chatId로 조회)
  loreBookPage: UserSettings.advancedSettings.loreBookPage
  loreBookDepth: UserSettings.advancedSettings.loreBookDepth
  loreBookToken: UserSettings.advancedSettings.loreBookToken
  
  // 메모리 (채팅별)
  supaMemoryData: Chat.supaMemoryData
  hypaV2Data: Chat.hypaV2Data
  hypaV3Data: Chat.hypaV3Data
  lastMemory: Chat.lastMemory
  
  // 메모리 설정
  supaMemoryPrompt: UserSettings.advancedSettings.supaMemoryPrompt
  hypaV3Presets: UserSettings.advancedSettings.hypaV3Presets
  hypaV3PresetId: UserSettings.advancedSettings.hypaV3PresetId
  memoryAlgorithmType: UserSettings.advancedSettings.memoryAlgorithmType
}
```

### 3.9 스크립트 시스템

**사용 테이블:**
- `Character` (customscript, triggerscript)
- `Chat` (scriptState)
- Redis (실시간 변수)

**필드 매핑:**
```typescript
{
  // 정규 스크립트
  globalscript: UserSettings.advancedSettings.globalscript
  presetRegex: BotPreset.presetData.regex
  customscript: Character.customScript
  
  // 트리거 스크립트 (Lua)
  triggerscript: Character.triggerScript
  
  // 스크립트 상태 (Redis 주 사용, DB는 백업)
  scriptstate: Chat.scriptState (Redis에서 실시간 관리)
}
```

### 3.10 고급 설정 시스템

**사용 테이블:**
- `UserSettings.advancedSettings` (JSONB)

**필드 매핑:**
```typescript
{
  // 모든 나머지 설정을 advancedSettings JSONB에 저장
  seperateParameters: UserSettings.advancedSettings.seperateParameters
  seperateModels: UserSettings.advancedSettings.seperateModels
  fallbackModels: UserSettings.advancedSettings.fallbackModels
  customTokenizer: UserSettings.advancedSettings.customTokenizer
  hotkeys: UserSettings.advancedSettings.hotkeys
  // ... 기타 모든 설정
}
```

---

## 4. Supabase Storage 통합

### 4.1 Storage 버킷 설정

- **버킷 이름**: `risuai-assets`
- **Public**: false (인증 필요)
- **File size limit**: 50MB
- **Allowed MIME types**: image/*, video/*, audio/*

### 4.2 RLS 정책

- 사용자는 자신의 에셋만 업로드/조회 가능
- 경로 구조: `{userId}/{characterId}/{filename}`

### 4.3 에셋 관리 개념

- **업로드**: Supabase Storage에 파일 저장 후 DB에 메타데이터 저장
- **조회**: Signed URL 생성 (만료 시간 설정 가능)
- **권한**: 사용자별 접근 제어

---

## 5. Redis 캐싱 전략

### 5.1 캐시 키 구조

- `session:{userId}:{characterId}:data` - 세션 데이터 (TTL: 1시간)
- `session:{userId}:{characterId}:chat` - 현재 채팅 상태 (TTL: 30분)
- `session:{userId}:{characterId}:{chatId}:vars` - 스크립트 변수 (TTL: 2시간)
- `session:{userId}:{characterId}:{chatId}:memory` - 메모리 캐시 (TTL: 1시간)
- `session:{userId}:{characterId}:{chatId}:prompt` - 프롬프트 캐시 (TTL: 5분)

### 5.2 캐싱 전략

- **읽기**: Redis → DB 순서로 조회
- **쓰기**: Redis 즉시 업데이트 → Worker 큐에 DB 저장 작업 추가
- **스크립트 변수**: Redis에서 실시간 관리, 배치로 DB 동기화

---

## 6. wasmoon Lua Engine 통합

### 6.1 Lua Factory 초기화

- 싱글톤 패턴으로 LuaFactory 관리
- Lua 라이브러리(`json.lua` 등) 사전 로드

### 6.2 Lua API 함수 등록

- `getChatVar`, `setChatVar` - 스크립트 변수 접근
- `getChatMain`, `getFullChat` - 채팅 데이터 접근
- `LLMMain` - AI 요청 (서버에서 처리)
- 기타 CBS 함수들

### 6.3 트리거 스크립트 실행

- 캐릭터의 `triggerScript`에서 Lua 타입 트리거 실행
- 모드별 분기: `editRequest`, `editInput`, `editOutput`, `editDisplay`

---

## 7. Database 어댑터 개념

### 7.1 데이터 로드 전략

- **Redis 우선**: 세션 데이터는 Redis에서 먼저 조회
- **DB 조회**: Redis 미스 시 Prisma로 조회 후 Redis 캐시
- **데이터 변환**: Prisma 모델 → Database 인터페이스 형태로 변환

### 7.2 데이터 저장 전략

- **Redis 즉시 업데이트**: 빠른 응답을 위해 Redis 먼저 업데이트
- **Worker 큐**: DB 저장은 Worker 프로세스에서 비동기 처리

---

## 8. 환경 설정

### 8.1 .env 파일

```env
# Supabase
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Prisma)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

# Redis (RedisLabs Cloud)
REDIS_URL="redis://default:[password]@[host]:[port]"
REDIS_USERNAME=default
REDIS_PASSWORD=your-password
REDIS_SOCKET_URL=[host]
REDIS_SOCKET_PORT=[port]

# Supabase Storage
SUPABASE_STORAGE_BUCKET=reluv-assets
SUPABASE_STORAGE_PUBLIC_URL=https://[project-ref].supabase.co/storage/v1/object/public

# AI API Keys (서버에서만 사용)
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Environment
NODE_ENV=production
PORT=3000
```

### 8.2 Prisma 초기화

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 마이그레이션 실행
npx prisma migrate dev --name init

# 프로덕션 마이그레이션
npx prisma migrate deploy
```

---

## 9. 배포 및 운영

### 9.1 Supabase 설정

1. **프로젝트 생성**
   - Supabase Dashboard에서 새 프로젝트 생성
   - 리전 선택 (ap-south-1 권장)

2. **데이터베이스 설정**
   - Prisma 마이그레이션 실행
   - RLS 정책 설정
   - 인덱스 최적화

3. **Storage 설정**
   - `reluv-assets` 버킷 생성
   - RLS 정책 설정
   - 파일 크기 제한 설정

### 9.2 RedisLabs Cloud 설정

1. **데이터베이스 생성**
   - RedisLabs Cloud에서 새 데이터베이스 생성
   - TLS 활성화
   - 비밀번호 설정

2. **연결 정보 확인**
   - 호스트, 포트, 비밀번호 확인
   - 환경 변수에 설정

### 9.3 Worker 프로세스

- **스크립트 변수 업데이트**: Redis → DB 동기화
- **Database 업데이트**: 세션 데이터 변경사항을 DB에 반영
- **배치 처리**: 같은 채팅의 여러 변경사항을 묶어서 처리

---

## 10. 마이그레이션 체크리스트

### Phase 1: 인프라 설정
- [ ] Supabase 프로젝트 생성
- [ ] RedisLabs Cloud 데이터베이스 생성
- [ ] 환경 변수 설정
- [ ] Prisma 스키마 작성
- [ ] 마이그레이션 실행

### Phase 2: 기본 서비스 구현
- [ ] Database 어댑터 구현
- [ ] Redis 캐싱 서비스 구현
- [ ] Asset 서비스 구현 (Supabase Storage)
- [ ] Worker 프로세스 설정

### Phase 3: Lua Engine 통합
- [x] wasmoon 서버 통합
- [x] Lua API 함수 등록
- [x] 트리거 스크립트 실행 로직

### Phase 4: 테스트
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 부하 테스트

---

**작성일**: 2024년
**버전**: 1.0
**상태**: 설계 완료
