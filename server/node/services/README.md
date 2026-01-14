# RisuAI Node Server Services

이 디렉토리는 RisuAI 서비스 웹을 위한 백엔드 서비스들을 포함합니다.

## 서비스 구조

### 1. Redis Service (`redis-service.js`)

RedisLabs Cloud 연결 및 캐시 전략 구현

**주요 기능:**
- 세션 데이터 캐싱 (TTL: 1시간)
- 채팅 상태 캐싱 (TTL: 30분)
- 스크립트 변수 캐싱 (TTL: 2시간)
- 메모리 캐시 (TTL: 1시간)
- 프롬프트 캐시 (TTL: 5분)

**사용 예시:**
```javascript
const { getRedisService } = require('./services/redis-service');
const redis = getRedisService();
await redis.connect();

// 세션 데이터 저장
await redis.setSessionData(userId, characterId, data);

// 세션 데이터 조회
const data = await redis.getSessionData(userId, characterId);
```

### 2. Database Adapter (`database-adapter.js`)

Prisma를 사용하여 Database 인터페이스와 매핑

**주요 기능:**
- Prisma 모델을 Database 인터페이스로 변환
- Redis 캐시와 통합
- 데이터 로드/저장 전략 구현

**사용 예시:**
```javascript
const { getDatabaseAdapter } = require('./services/database-adapter');
const db = getDatabaseAdapter();
await db.initialize();

// 사용자 데이터 로드
const database = await db.loadUserDatabase(userId);

// 사용자 데이터 저장
await db.saveUserDatabase(userId, database);
```

### 3. Asset Service (`asset-service.js`)

Supabase Storage 통합

**주요 기능:**
- 파일 업로드/다운로드
- Signed URL 생성
- 이미지 최적화 URL 생성
- 파일 메타데이터 관리

**사용 예시:**
```javascript
const { getAssetService } = require('./services/asset-service');
const asset = getAssetService();
await asset.initialize();

// 파일 업로드
const result = await asset.uploadFile(
  userId,
  characterId,
  fileData,
  fileName,
  mimeType
);

// Signed URL 생성
const url = await asset.createSignedUrl(path, 3600);
```

### 4. DB Sync Worker (`../workers/db-sync-worker.js`)

DB 동기화 워커 프로세스

**주요 기능:**
- Redis의 변경사항을 DB에 비동기로 동기화
- 스크립트 변수 동기화
- 배치 처리로 성능 최적화

**자동 시작:**
서버 시작 시 자동으로 시작되며, 5초마다 큐를 확인하여 DB에 동기화합니다.

## 서비스 관리

### Service Manager (`index.js`)

모든 서비스를 한 곳에서 초기화하고 관리

**사용 예시:**
```javascript
const { getServiceManager } = require('./services/index');
const serviceManager = getServiceManager();

// 모든 서비스 초기화
await serviceManager.initialize();

// 서비스 인스턴스 접근
const redis = serviceManager.getRedis();
const database = serviceManager.getDatabase();
const asset = serviceManager.getAsset();

// 서비스 종료
await serviceManager.shutdown();
```

## 환경 변수

다음 환경 변수들이 필요합니다:

```env
# Supabase
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Prisma)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."
# 또는
REDIS_USERNAME=default
REDIS_PASSWORD=your-password
REDIS_SOCKET_URL=host
REDIS_SOCKET_PORT=6379
REDIS_TLS=true

# Supabase Storage
SUPABASE_STORAGE_BUCKET=risuai-assets
SUPABASE_STORAGE_PUBLIC_URL=https://...
```

## 의존성

필요한 npm 패키지:
- `ioredis` - Redis 클라이언트
- `@supabase/supabase-js` - Supabase 클라이언트
- `@prisma/client` - Prisma 클라이언트
- `dotenv` - 환경 변수 관리

## 주의사항

1. **Redis 연결**: Redis 서비스는 서버 시작 시 자동으로 연결됩니다.
2. **DB 동기화**: Worker는 비동기로 동작하므로 즉시 반영되지 않을 수 있습니다.
3. **에러 처리**: 각 서비스는 에러 발생 시 적절히 로깅하고 처리합니다.
4. **Graceful Shutdown**: 서버 종료 시 모든 서비스가 정상적으로 종료됩니다.
