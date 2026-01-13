# RisuAI 서비스 웹 종합 설계 계획

## 개요

현재 구현된 RisuAI 기능을 최대한 활용하면서 서비스 웹에 적합하도록 개선하는 종합 설계 계획입니다.

---

## 1. 아키텍처 개요

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                    클라이언트 (Svelte)                   │
│  - UI 렌더링 (HTML, Markdown, Assets)                  │
│  - Display 처리                                         │
│  - 사용자 인터랙션                                      │
└────────────────────┬────────────────────────────────────┘
                     │ REST API / WebSocket
┌────────────────────┴────────────────────────────────────┐
│                    API Gateway                            │
│  - 인증/인가                                             │
│  - Rate Limiting                                         │
│  - 요청 라우팅                                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              애플리케이션 서버 (Node.js)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Chat Service │  │Char Service  │  │Market Service│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Memory Service│  │Script Service│  │Asset Service │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼───┐  ┌─────▼─────┐  ┌──▼──────────┐
│PostgreSQL │  │   Redis    │  │   Worker    │
│  (메인 DB) │  │  (캐시/세션)│  │ (비동기 작업)│
└───────────┘  └────────────┘  └─────────────┘
```

### 1.2 서버/클라이언트 역할 분리

**서버 담당:**
- ✅ 비즈니스 로직 (채팅 처리, 프롬프트 생성)
- ✅ AI 모델 요청 및 응답 처리
- ✅ 메모리 시스템 (SupaMemory, HypaMemory)
- ✅ CBS 변수 파싱 및 치환
- ✅ 스크립트 실행 (정규 스크립트, Lua 트리거)
- ✅ 데이터 검증 및 저장
- ✅ 세션 관리

**클라이언트 담당:**
- ✅ HTML/Markdown 렌더링
- ✅ 이미지/비디오/오디오 표시
- ✅ UI 애니메이션 및 인터랙션
- ✅ 실시간 스트리밍 표시
- ✅ 에셋 프리뷰

---

## 2. 데이터베이스 스키마 설계 (PostgreSQL)

### 2.1 사용자 및 인증

```sql
-- 사용자 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'free'
);

-- 사용자 세션 (JWT 토큰 관리)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    device_info JSONB
);
```

### 2.2 캐릭터 관리

```sql
-- 캐릭터 테이블
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    personality TEXT,
    scenario TEXT,
    first_message TEXT,
    notes TEXT,
    creator_notes TEXT,
    system_prompt TEXT,
    post_history_instructions TEXT,
    example_message TEXT,
    image_url TEXT,  -- DB에 저장된 이미지 URL
    cha_id VARCHAR(255) UNIQUE NOT NULL,  -- 기존 chaId와 호환
    
    -- 메타데이터
    character_version VARCHAR(50),
    creator VARCHAR(255),
    tags TEXT[],
    license VARCHAR(100),
    is_private BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT false,  -- 마켓플레이스 공개 여부
    
    -- 설정
    view_screen VARCHAR(50) DEFAULT 'none',
    utility_bot BOOLEAN DEFAULT false,
    tts_mode VARCHAR(50),
    tts_speech TEXT,
    
    -- JSONB로 저장되는 복잡한 데이터
    emotion_images JSONB,  -- [string, string][]
    additional_assets JSONB,  -- [string, string, string][]
    sd_data JSONB,  -- [string, string][]
    bias JSONB,  -- [string, number][]
    alternate_greetings TEXT[],
    custom_script JSONB,  -- customscript[]
    trigger_script JSONB,  -- triggerscript[]
    voice_config JSONB,  -- voicevoxConfig, naittsConfig 등
    lore_settings JSONB,  -- loreSettings
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_interaction_at TIMESTAMP
);

-- 캐릭터 인덱스
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_cha_id ON characters(cha_id);
CREATE INDEX idx_characters_published ON characters(is_published) WHERE is_published = true;
CREATE INDEX idx_characters_tags ON characters USING GIN(tags);
```

### 2.3 채팅 및 메시지

```sql
-- 채팅 테이블
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    note TEXT,
    folder_id UUID,  -- 채팅 폴더 참조
    
    -- 메모리 데이터 (JSONB)
    supa_memory_data TEXT,
    hypa_v2_data JSONB,
    hypa_v3_data JSONB,
    last_memory TEXT,
    
    -- 스크립트 상태
    script_state JSONB,  -- {[key:string]:string|number|boolean}
    
    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_date TIMESTAMP,
    is_streaming BOOLEAN DEFAULT false
);

-- 메시지 테이블
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' | 'char'
    data TEXT NOT NULL,
    saying VARCHAR(255),  -- 그룹 채팅에서 캐릭터 ID
    name VARCHAR(255),
    time TIMESTAMP DEFAULT NOW(),
    
    -- 생성 정보
    generation_info JSONB,  -- MessageGenerationInfo
    prompt_info JSONB,  -- MessagePresetInfo
    
    -- 상태
    disabled BOOLEAN DEFAULT false,
    is_comment BOOLEAN DEFAULT false,
    
    -- 순서
    message_index INTEGER NOT NULL,
    
    UNIQUE(chat_id, message_index)
);

-- 채팅 폴더
CREATE TABLE chat_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255),
    color VARCHAR(50),
    folded BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_chats_character_user ON chats(character_id, user_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_time ON messages(time);
```

### 2.4 로어북 (Lorebook)

```sql
-- 로어북 테이블
CREATE TABLE lorebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    
    name VARCHAR(255),
    key TEXT NOT NULL,
    second_key TEXT,
    content TEXT NOT NULL,
    comment TEXT,
    
    -- 설정
    mode VARCHAR(50) DEFAULT 'normal',  -- 'multiple'|'constant'|'normal'|'child'|'folder'
    insert_order INTEGER DEFAULT 0,
    always_active BOOLEAN DEFAULT false,
    selective BOOLEAN DEFAULT false,
    use_regex BOOLEAN DEFAULT false,
    activation_percent INTEGER,
    
    -- 확장
    extensions JSONB,
    lore_cache JSONB,
    folder VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_lorebooks_character ON lorebooks(character_id);
CREATE INDEX idx_lorebooks_chat ON lorebooks(chat_id);
CREATE INDEX idx_lorebooks_key ON lorebooks USING GIN(key gin_trgm_ops);  -- 트라이그램 인덱스
```

### 2.5 사용자 설정 및 프리셋

```sql
-- 사용자 설정 테이블
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- 기본 설정
    username VARCHAR(100),
    user_icon_url TEXT,
    user_note TEXT,
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(50),
    
    -- AI 설정
    default_ai_model VARCHAR(255),
    default_sub_model VARCHAR(255),
    temperature INTEGER DEFAULT 80,
    max_context INTEGER DEFAULT 4000,
    max_response INTEGER DEFAULT 500,
    frequency_penalty INTEGER DEFAULT 70,
    presence_penalty INTEGER DEFAULT 70,
    
    -- 프롬프트 설정
    main_prompt TEXT,
    jailbreak TEXT,
    global_note TEXT,
    additional_prompt TEXT,
    description_prefix TEXT,
    formating_order TEXT[],
    
    -- UI 설정
    zoomsize INTEGER DEFAULT 100,
    iconsize INTEGER DEFAULT 100,
    custom_background_url TEXT,
    text_theme VARCHAR(50) DEFAULT 'standard',
    custom_text_theme JSONB,
    
    -- 고급 설정 (JSONB)
    advanced_settings JSONB,  -- 나머지 모든 설정
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 봇 프리셋
CREATE TABLE bot_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    
    -- 프리셋 설정 (JSONB)
    preset_data JSONB NOT NULL,  -- botPreset 인터페이스
    
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 페르소나
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    persona_prompt TEXT,
    icon_url TEXT,
    note TEXT,
    large_portrait BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.6 에셋 관리 (파일 시스템 대체)

```sql
-- 에셋 테이블 (모든 파일을 DB에 저장)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    
    -- 파일 정보
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- 'image'|'video'|'audio'|'emotion'|'other'
    mime_type VARCHAR(100),
    file_size BIGINT,
    
    -- 저장 방식
    storage_type VARCHAR(50) DEFAULT 'database',  -- 'database'|'s3'|'cdn'
    storage_path TEXT,  -- S3 경로 또는 CDN URL
    file_data BYTEA,  -- 작은 파일은 직접 저장, 큰 파일은 S3
    
    -- 메타데이터
    width INTEGER,
    height INTEGER,
    duration INTEGER,  -- 비디오/오디오 길이 (초)
    
    -- 태그 및 분류
    tags TEXT[],
    is_public BOOLEAN DEFAULT false,  -- 마켓플레이스 공개
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 에셋 인덱스
CREATE INDEX idx_assets_user_character ON assets(user_id, character_id);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_public ON assets(is_public) WHERE is_public = true;

-- 에셋 URL 캐시 (CDN URL 생성용)
CREATE TABLE asset_urls (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    cdn_url TEXT NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.7 마켓플레이스

```sql
-- 마켓플레이스 캐릭터
CREATE TABLE marketplace_characters (
    character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    
    -- 마켓 정보
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    category VARCHAR(100),
    tags TEXT[],
    
    -- 통계
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    
    -- 상태
    is_featured BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending'|'approved'|'rejected'
    
    -- 가격 (향후 유료 기능)
    price DECIMAL(10,2) DEFAULT 0,
    is_premium BOOLEAN DEFAULT false,
    
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 마켓플레이스 리뷰
CREATE TABLE marketplace_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES marketplace_characters(character_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(character_id, user_id)
);

-- 인덱스
CREATE INDEX idx_marketplace_featured ON marketplace_characters(is_featured) WHERE is_featured = true;
CREATE INDEX idx_marketplace_category ON marketplace_characters(category);
CREATE INDEX idx_marketplace_tags ON marketplace_characters USING GIN(tags);
CREATE INDEX idx_marketplace_rating ON marketplace_characters(rating_average DESC);
```

### 2.8 서비스 제공 모델/메모리/TTS

```sql
-- 제공되는 AI 모델 목록
CREATE TABLE service_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(255) UNIQUE NOT NULL,  -- 'gpt-4', 'claude-3-opus' 등
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,  -- 'openai', 'anthropic', 'google' 등
    model_type VARCHAR(50) NOT NULL,  -- 'chat'|'memory'|'emotion'|'translate'
    
    -- 설정
    config JSONB NOT NULL,  -- 모델별 설정
    is_available BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    
    -- 제한
    max_tokens INTEGER,
    rate_limit_per_minute INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 사용자 모델 선택
CREATE TABLE user_model_selections (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    model_type VARCHAR(50) NOT NULL,  -- 'chat'|'memory'|'emotion'|'translate'
    model_id VARCHAR(255) REFERENCES service_models(model_id),
    PRIMARY KEY (user_id, model_type)
);

-- 메모리 서비스 설정
CREATE TABLE memory_service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,  -- 'supamemory'|'hypav2'|'hypav3'|'hanurai'
    config JSONB NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TTS 서비스 설정
CREATE TABLE tts_service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,  -- 'openai'|'elevenlabs'|'voicevox'|'naitts'
    config JSONB NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 이미지 생성 서비스 설정
CREATE TABLE image_gen_service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,  -- 'stable-diffusion'|'dalle'|'midjourney'|'novelai'
    config JSONB NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Redis 캐싱 전략

### 3.1 세션별 Database 캐싱

```typescript
// Redis 키 구조
const REDIS_KEYS = {
    // 사용자-캐릭터별 세션 데이터
    sessionData: (userId: string, characterId: string) => 
        `session:${userId}:${characterId}:data`,
    
    // 현재 채팅 상태
    currentChat: (userId: string, characterId: string) => 
        `session:${userId}:${characterId}:chat`,
    
    // 스크립트 변수
    scriptVars: (userId: string, characterId: string, chatId: string) => 
        `session:${userId}:${characterId}:${chatId}:vars`,
    
    // 메모리 캐시
    memoryCache: (userId: string, characterId: string, chatId: string) => 
        `session:${userId}:${characterId}:${chatId}:memory`,
    
    // 프롬프트 캐시
    promptCache: (userId: string, characterId: string, chatId: string) => 
        `session:${userId}:${characterId}:${chatId}:prompt`
};

// 캐시 TTL
const CACHE_TTL = {
    sessionData: 3600,  // 1시간
    currentChat: 1800,  // 30분
    scriptVars: 7200,   // 2시간
    memoryCache: 3600,  // 1시간
    promptCache: 300    // 5분
};
```

### 3.2 캐시 업데이트 전략

```typescript
// 세션 데이터 로드
async function getSessionData(userId: string, characterId: string): Promise<Database> {
    const cacheKey = REDIS_KEYS.sessionData(userId, characterId);
    
    // Redis에서 먼저 확인
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }
    
    // DB에서 로드
    const db = await loadDatabaseFromPostgres(userId, characterId);
    
    // Redis에 캐시
    await redis.setex(cacheKey, CACHE_TTL.sessionData, JSON.stringify(db));
    
    return db;
}

// 세션 데이터 업데이트
async function updateSessionData(
    userId: string, 
    characterId: string, 
    updates: Partial<Database>
): Promise<void> {
    const cacheKey = REDIS_KEYS.sessionData(userId, characterId);
    
    // Redis 업데이트
    const current = await getSessionData(userId, characterId);
    const updated = { ...current, ...updates };
    await redis.setex(cacheKey, CACHE_TTL.sessionData, JSON.stringify(updated));
    
    // Worker에 DB 저장 작업 큐잉
    await queueDatabaseUpdate(userId, characterId, updates);
}
```

---

## 4. 스크립트 변수 관리 (Redis → Worker → DB)

### 4.1 스크립트 변수 변경 흐름

```
스크립트 실행 (정규 스크립트/Lua 트리거)
    ↓
변수 변경 감지
    ↓
Redis에 즉시 저장 (실시간 접근)
    ↓
Worker 큐에 작업 추가
    ↓
Worker가 배치로 DB 업데이트
```

### 4.2 구현

```typescript
// 스크립트 서비스
class ScriptService {
    // 변수 변경 감지 및 저장
    async updateScriptVariable(
        userId: string,
        characterId: string,
        chatId: string,
        key: string,
        value: string | number | boolean
    ): Promise<void> {
        const varKey = REDIS_KEYS.scriptVars(userId, characterId, chatId);
        
        // Redis에 즉시 저장
        await redis.hset(varKey, key, JSON.stringify(value));
        await redis.expire(varKey, CACHE_TTL.scriptVars);
        
        // Worker 큐에 DB 업데이트 작업 추가
        await this.queueVariableUpdate(userId, characterId, chatId, key, value);
    }
    
    // 변수 조회
    async getScriptVariable(
        userId: string,
        characterId: string,
        chatId: string,
        key: string
    ): Promise<string | null> {
        const varKey = REDIS_KEYS.scriptVars(userId, characterId, chatId);
        const value = await redis.hget(varKey, key);
        return value ? JSON.parse(value) : null;
    }
    
    // Worker 큐잉
    private async queueVariableUpdate(
        userId: string,
        characterId: string,
        chatId: string,
        key: string,
        value: any
    ): Promise<void> {
        await bullQueue.add('update-script-variable', {
            userId,
            characterId,
            chatId,
            key,
            value,
            timestamp: Date.now()
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });
    }
}

// Worker (Bull Queue)
import Queue from 'bull';

const dbUpdateQueue = new Queue('update-script-variable', {
    redis: redisConfig
});

dbUpdateQueue.process(async (job) => {
    const { userId, characterId, chatId, key, value } = job.data;
    
    // 배치 업데이트를 위해 잠시 대기 (같은 채팅의 여러 변수 변경을 묶음)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // DB 업데이트
    await db.query(`
        UPDATE chats 
        SET script_state = script_state || $1::jsonb
        WHERE id = $2
    `, [{ [key]: value }, chatId]);
    
    return { success: true };
});
```

---

## 5. 서버/클라이언트 API 설계

### 5.1 채팅 API

```typescript
// POST /api/v1/chat/send
interface SendChatRequest {
    characterId: string;
    chatId?: string;  // 새 채팅이면 없음
    message: string;
    options?: {
        temperature?: number;
        maxTokens?: number;
        useStreaming?: boolean;
    };
}

interface SendChatResponse {
    chatId: string;
    messageId: string;
    response: string;  // 스트리밍이 아니면 전체 응답
    streamingUrl?: string;  // 스트리밍이면 WebSocket URL
    generationInfo: {
        model: string;
        inputTokens: number;
        outputTokens: number;
    };
}

// GET /api/v1/chat/:chatId/messages
interface GetMessagesResponse {
    messages: Array<{
        id: string;
        role: 'user' | 'char';
        data: string;  // 원본 텍스트 (CBS 변수 포함)
        time: string;
    }>;
}

// 서버는 CBS 변수 파싱은 하지만 HTML 렌더링은 하지 않음
// 클라이언트가 받은 data를 파싱하여 HTML로 렌더링
```

### 5.2 에셋 API

```typescript
// POST /api/v1/assets/upload
interface UploadAssetRequest {
    characterId: string;
    file: File;
    name: string;
    type: 'image' | 'video' | 'audio' | 'emotion';
}

interface UploadAssetResponse {
    assetId: string;
    url: string;  // CDN URL 또는 데이터 URL
    thumbnailUrl?: string;
}

// GET /api/v1/assets/:assetId
// 바이너리 데이터 반환 또는 리다이렉트

// GET /api/v1/characters/:characterId/assets
interface GetAssetsResponse {
    assets: Array<{
        id: string;
        name: string;
        type: string;
        url: string;
    }>;
}
```

### 5.3 캐릭터 API

```typescript
// POST /api/v1/characters
interface CreateCharacterRequest {
    name: string;
    description: string;
    // ... 기타 필드
}

// GET /api/v1/characters/:characterId
interface GetCharacterResponse {
    character: {
        id: string;
        name: string;
        description: string;
        imageUrl: string;
        // ... 기타 필드
        // HTML 렌더링 관련 필드는 제외
    };
}

// PUT /api/v1/characters/:characterId
// 캐릭터 업데이트

// POST /api/v1/characters/:characterId/publish
// 마켓플레이스에 공개
```

---

## 6. 서비스 제공 모델/메모리/TTS 관리

### 6.1 모델 선택 시스템

```typescript
// 서버에서 제공하는 모델 목록
interface ServiceModel {
    id: string;
    name: string;
    provider: string;
    type: 'chat' | 'memory' | 'emotion' | 'translate';
    isAvailable: boolean;
    isPremium: boolean;
    config: {
        endpoint?: string;
        apiKey?: string;  // 서버에서 관리
        // ...
    };
}

// 사용자가 모델 선택
// POST /api/v1/users/models/select
interface SelectModelRequest {
    chatModel?: string;
    memoryModel?: string;
    emotionModel?: string;
    translateModel?: string;
}

// 서버는 선택된 모델로 요청 처리
// 사용자는 API 키를 제공하지 않음
```

### 6.2 메모리 서비스

```typescript
// 메모리 서비스는 서버에서 제공
// 사용자는 설정만 선택

interface MemoryServiceConfig {
    type: 'supamemory' | 'hypav2' | 'hypav3' | 'hanurai';
    settings: {
        // 각 메모리 타입별 설정
    };
}

// POST /api/v1/chat/:chatId/memory/update
// 서버가 메모리 시스템으로 처리
```

---

## 7. 마켓플레이스 시스템

### 7.1 캐릭터 공유 플로우

```typescript
// 1. 사용자가 캐릭터 생성/편집
// POST /api/v1/characters

// 2. 마켓플레이스에 공개
// POST /api/v1/marketplace/characters/:characterId/publish
interface PublishCharacterRequest {
    title: string;
    description: string;
    category: string;
    tags: string[];
    thumbnailUrl?: string;
    isPremium?: boolean;
    price?: number;
}

// 3. 마켓플레이스에서 검색/조회
// GET /api/v1/marketplace/characters
interface SearchCharactersQuery {
    query?: string;
    category?: string;
    tags?: string[];
    sort?: 'popular' | 'recent' | 'rating';
    page?: number;
    limit?: number;
}

// 4. 캐릭터 가져오기 (복사)
// POST /api/v1/marketplace/characters/:characterId/import
// 사용자의 캐릭터 목록에 복사본 생성
```

### 7.2 마켓플레이스 기능

- ✅ 검색 및 필터링
- ✅ 카테고리별 분류
- ✅ 인기/최신/평점 정렬
- ✅ 리뷰 및 평점
- ✅ 검증된 크리에이터 표시
- ✅ 프리미엄 캐릭터 (향후 유료화)

---

## 8. 파일 시스템 제거 및 DB 저장

### 8.1 에셋 저장 전략

```typescript
// 작은 파일 (< 1MB): PostgreSQL BYTEA에 직접 저장
// 큰 파일 (> 1MB): S3 또는 CDN에 저장, DB에는 메타데이터만

class AssetService {
    async uploadAsset(
        userId: string,
        characterId: string,
        file: Buffer,
        metadata: AssetMetadata
    ): Promise<Asset> {
        const fileSize = file.length;
        
        if (fileSize < 1024 * 1024) {  // 1MB 미만
            // DB에 직접 저장
            const result = await db.query(`
                INSERT INTO assets (user_id, character_id, name, type, file_data, file_size)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [userId, characterId, metadata.name, metadata.type, file, fileSize]);
            
            return {
                id: result.rows[0].id,
                url: `/api/v1/assets/${result.rows[0].id}`
            };
        } else {
            // S3에 업로드
            const s3Key = `assets/${userId}/${characterId}/${metadata.name}`;
            await s3.putObject(s3Key, file);
            
            // DB에 메타데이터만 저장
            const result = await db.query(`
                INSERT INTO assets (user_id, character_id, name, type, storage_type, storage_path, file_size)
                VALUES ($1, $2, $3, $4, 's3', $5, $6)
                RETURNING *
            `, [userId, characterId, metadata.name, metadata.type, s3Key, fileSize]);
            
            return {
                id: result.rows[0].id,
                url: await this.generateCDNUrl(result.rows[0].id)
            };
        }
    }
    
    async getAsset(assetId: string): Promise<Buffer> {
        const asset = await db.query('SELECT * FROM assets WHERE id = $1', [assetId]);
        
        if (asset.rows[0].storage_type === 'database') {
            return asset.rows[0].file_data;
        } else {
            // S3에서 가져오기
            return await s3.getObject(asset.rows[0].storage_path);
        }
    }
}
```

---

## 9. 개선 아이디어 및 추가 기능

### 9.1 실시간 협업

```typescript
// WebSocket을 통한 실시간 채팅 동기화
// 여러 사용자가 같은 캐릭터와 채팅할 수 있음 (선택적)

// WebSocket 이벤트
interface WebSocketEvents {
    'chat:message': { chatId: string; message: Message };
    'chat:typing': { chatId: string; userId: string };
    'chat:update': { chatId: string; updates: Partial<Chat> };
}
```

### 9.2 캐릭터 버전 관리

```sql
-- 캐릭터 버전 히스토리
CREATE TABLE character_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL,  -- 전체 캐릭터 데이터 스냅샷
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);
```

### 9.3 사용량 추적 및 제한

```sql
-- 사용량 추적
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    api_call_count INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

-- 제한 설정
CREATE TABLE user_limits (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    max_characters INTEGER DEFAULT 10,
    max_chats_per_character INTEGER DEFAULT 50,
    max_messages_per_day INTEGER DEFAULT 100,
    max_tokens_per_day INTEGER DEFAULT 100000
);
```

### 9.4 캐릭터 템플릿 시스템

```typescript
// 서버에서 제공하는 캐릭터 템플릿
// 사용자가 빠르게 시작할 수 있도록

// GET /api/v1/templates/characters
interface CharacterTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    templateData: Partial<Character>;
}
```

### 9.5 배치 처리 최적화

```typescript
// 여러 채팅의 메모리 업데이트를 배치로 처리
// Worker에서 주기적으로 실행

async function batchUpdateMemories() {
    // Redis에서 변경된 메모리 데이터 수집
    const memoryUpdates = await collectMemoryUpdates();
    
    // 배치로 DB 업데이트
    await db.query(`
        UPDATE chats 
        SET hypa_v3_data = $1::jsonb
        WHERE id = ANY($2::uuid[])
    `, [memoryUpdates.data, memoryUpdates.chatIds]);
}
```

---

## 10. 마이그레이션 계획

### Phase 1: 인프라 구축 (2-3주)
- [ ] PostgreSQL 스키마 생성
- [ ] Redis 설정
- [ ] Worker (Bull Queue) 설정
- [ ] 기본 API 서버 구축

### Phase 2: 핵심 기능 마이그레이션 (4-6주)
- [ ] Database 어댑터 구현
- [ ] 채팅 처리 로직 마이그레이션
- [ ] CBS 시스템 통합
- [ ] 스크립트 실행 시스템

### Phase 3: 에셋 및 파일 시스템 (2-3주)
- [ ] 에셋 저장 시스템
- [ ] S3/CDN 통합
- [ ] 파일 업로드/다운로드 API

### Phase 4: 마켓플레이스 (3-4주)
- [ ] 마켓플레이스 API
- [ ] 검색 및 필터링
- [ ] 리뷰 시스템

### Phase 5: 클라이언트 통합 (3-4주)
- [ ] API 클라이언트 구현
- [ ] 실시간 동기화 (WebSocket)
- [ ] UI 렌더링 로직 분리

### Phase 6: 테스트 및 최적화 (2-3주)
- [ ] 통합 테스트
- [ ] 성능 최적화
- [ ] 부하 테스트

---

## 11. 기술 스택

### 백엔드
- **런타임**: Node.js 20+
- **프레임워크**: Express.js 또는 Fastify
- **데이터베이스**: PostgreSQL 15+
- **캐시**: Redis 7+
- **큐**: Bull (Redis 기반)
- **파일 저장**: AWS S3 또는 MinIO
- **인증**: JWT + Refresh Token

### 클라이언트
- **프레임워크**: Svelte 5 (기존 유지)
- **상태 관리**: Svelte Stores (로컬 상태만)
- **API 통신**: Fetch API + WebSocket

### 인프라
- **컨테이너**: Docker
- **오케스트레이션**: Kubernetes (선택적)
- **모니터링**: Prometheus + Grafana
- **로깅**: ELK Stack 또는 Loki

---

## 12. 보안 고려사항

### 12.1 데이터 보호
- 모든 API 키는 서버에서만 관리
- 사용자 데이터는 암호화 저장
- 에셋 접근은 인증 필요
- 마켓플레이스 공개 에셋만 공개 URL

### 12.2 Rate Limiting
- 사용자별 API 호출 제한
- 모델별 토큰 사용량 제한
- 스팸 방지

### 12.3 콘텐츠 모더레이션
- 마켓플레이스 콘텐츠 검토
- 부적절한 콘텐츠 필터링
- 신고 시스템

---

**작성일**: 2024년
**버전**: 1.0
**상태**: 설계 완료
