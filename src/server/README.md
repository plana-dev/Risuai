# RisuAI 서버 서비스

이 디렉토리는 RisuAI 서비스 웹을 위한 백엔드 서비스들을 포함합니다. 모든 서비스는 TypeScript로 작성되어 기존 코드와 통합 가능합니다.

## 서비스 구조

### 1. Redis Service (`redis-service.ts`)

RedisLabs Cloud 연결 및 캐시 전략 구현

**주요 기능:**
- 세션 데이터 캐싱 (TTL: 1시간)
- 채팅 상태 캐싱 (TTL: 30분)
- 스크립트 변수 캐싱 (TTL: 2시간)
- 메모리 캐시 (TTL: 1시간)
- 프롬프트 캐시 (TTL: 5분)

### 2. Database Adapter (`database-adapter.ts`)

Prisma를 사용하여 Database 인터페이스와 매핑

**주요 기능:**
- Prisma 모델을 Database 인터페이스로 변환
- Redis 캐시와 통합
- 데이터 로드/저장 전략 구현

### 3. Asset Service (`asset-service.ts`)

Supabase Storage 통합 (기존 `src/lib/supabase/storage.ts` 활용)

**주요 기능:**
- 파일 업로드/다운로드
- Signed URL 생성
- 이미지 최적화 URL 생성
- 파일 메타데이터 관리

**기존 구현 활용:**
- `uploadToStorage` - 파일 업로드
- `generateStoragePath` - 경로 생성
- `deleteFromStorage` - 파일 삭제
- `supabase` 클라이언트 - 기존 클라이언트 재사용

### 4. Service Manager (`index.ts`)

모든 서비스를 한 곳에서 초기화하고 관리

## SvelteKit API Routes에서 사용

서비스들은 SvelteKit API routes에서 직접 사용할 수 있습니다:

```typescript
// src/routes/api/database/+server.ts
import { getDatabaseAdapter } from '../../../../server/index.js';

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  const db = getDatabaseAdapter();
  const database = await db.loadUserDatabase(userId);
  return json({ data: database });
};
```

## 환경 변수

다음 환경 변수들이 필요합니다:

```env
# Supabase (SvelteKit $env 사용)
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_SECRET_KEY=your-service-role-key

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
```

## 주의사항

1. **서비스 초기화**: 서비스들은 싱글톤 패턴으로 구현되어 있으며, 첫 사용 시 자동으로 초기화됩니다.
2. **에러 처리**: 각 서비스는 에러 발생 시 적절히 로깅하고 처리합니다.
3. **타입 안정성**: 모든 서비스는 TypeScript로 작성되어 타입 안정성을 보장합니다.
4. **기존 코드 통합**: 
   - Database 인터페이스는 기존 `database.svelte.ts`와 호환됩니다.
   - Supabase 클라이언트는 기존 `src/lib/supabase/client.ts`를 사용합니다.
   - Storage 함수는 기존 `src/lib/supabase/storage.ts`를 활용합니다.
