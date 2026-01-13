# RisuAI 백엔드 마이그레이션 분석

## 개요

이 문서는 RisuAI의 핵심 시스템들을 백엔드 서버에서 재사용 가능한지 분석하고, `database.svelte.ts`를 데이터베이스로 분리했을 때의 영향도를 평가합니다.

---

## 1. 핵심 시스템 의존성 분석

### 1.1 Database 시스템 (`src/ts/storage/database.svelte.ts`)

**현재 구조:**
- Svelte 5 `$state`를 사용한 반응형 상태 관리
- `DBState.db`로 전역 접근
- `getDatabase()`, `setDatabase()` 함수로 접근

**의존성:**
```typescript
// Svelte 의존
import { DBState } from '../stores.svelte';
export const DBState = $state({ db: {} as Database });

// 하지만 인터페이스 정의는 순수 TypeScript
export interface Database { ... }
export interface character { ... }
export interface Chat { ... }
```

**백엔드 재사용 가능성: ✅ 높음**

**분리 전략:**
1. **인터페이스 분리**: `Database`, `character`, `Chat` 등 모든 인터페이스는 순수 TypeScript이므로 그대로 사용 가능
2. **접근 패턴 변경**: 
   - 현재: `getDatabase()` → `DBState.db` 직접 접근
   - 변경: `getDatabase(userId: string)` → 데이터베이스 쿼리
3. **어댑터 패턴 적용**:
   ```typescript
   // 백엔드용 어댑터
   export function getDatabase(userId: string): Promise<Database> {
       return db.query('SELECT * FROM user_data WHERE user_id = ?', [userId]);
   }
   ```

**데이터베이스 스키마 매핑:**
- `Database` 인터페이스의 모든 필드를 관계형 테이블로 변환 가능
- JSONB 필드 활용 (PostgreSQL) 또는 문서 저장소 (MongoDB) 사용

---

### 1.2 Parser 시스템 (`src/ts/parser.svelte.ts`)

**현재 구조:**
- Markdown → HTML 변환
- DOMPurify로 HTML 정제
- KaTeX 수식 렌더링
- Highlight.js 코드 하이라이팅
- CBS 변수 파싱

**의존성:**
```typescript
import DOMPurify from 'dompurify';  // 브라우저 전용
import markdownit from 'markdown-it'
import { DBState } from './stores.svelte';  // Svelte 의존
import { getFileSrc } from './globalApi.svelte';  // 플랫폼 의존
```

**백엔드 재사용 가능성: ⚠️ 제한적**

**문제점:**
1. **DOMPurify**: Node.js 환경에서는 `jsdom` 또는 `node-html-parser` 필요
2. **파일 경로 처리**: `getFileSrc()`는 브라우저/Tauri/Capacitor 전용
3. **이미지 처리**: 브라우저 Blob API 사용

**분리 전략:**
1. **서버용 파서 분리**:
   ```typescript
   // parser-server.ts
   import { JSDOM } from 'jsdom';
   import createDOMPurify from 'dompurify';
   
   const window = new JSDOM('').window;
   const DOMPurify = createDOMPurify(window);
   ```
2. **파일 처리 어댑터**: URL 기반 파일 접근으로 변경
3. **CBS 파싱**: 순수 문자열 처리이므로 그대로 사용 가능

**사용 시나리오:**
- ✅ **CBS 변수 파싱**: 백엔드에서 프롬프트 생성 시 사용 가능
- ⚠️ **HTML 렌더링**: 서버 사이드 렌더링 시 제한적 사용
- ❌ **실시간 마크다운 변환**: 클라이언트 전용

---

### 1.3 CBS 시스템 (`src/ts/cbs.ts`)

**현재 구조:**
- 의존성 주입 패턴 사용 (`CBSRegisterArg`)
- 함수 등록 시스템
- 변수 치환 및 함수 호출

**의존성:**
```typescript
export type CBSRegisterArg = {
    registerFunction: (arg: {...}) => void,
    getDatabase: () => Database,  // 인터페이스만 사용
    getUserName: () => string,
    // ... 기타 함수들
}
```

**백엔드 재사용 가능성: ✅ 매우 높음**

**장점:**
1. **의존성 주입 패턴**: 이미 분리되어 있음
2. **순수 함수**: 대부분의 로직이 순수 함수
3. **인터페이스 기반**: 구체적 구현에 의존하지 않음

**분리 전략:**
```typescript
// 백엔드용 CBS 등록
registerCBS({
    registerFunction: (arg) => { /* 서버 구현 */ },
    getDatabase: () => getDatabaseFromDB(userId),
    getUserName: () => getUserFromDB(userId).username,
    // ... 기타 함수들
});
```

**사용 가능한 기능:**
- ✅ 모든 CBS 함수 ({{char}}, {{user}}, {{random}}, 등)
- ✅ 변수 치환
- ✅ 조건부 로직
- ✅ 수학 연산

---

### 1.4 Process 시스템 (`src/ts/process/`)

#### 1.4.1 채팅 처리 (`process/index.svelte.ts`)

**현재 구조:**
- 4단계 프로세스 (데이터 준비 → 프롬프트 구성 → AI 요청 → 후처리)
- Svelte stores에 강하게 의존

**의존성:**
```typescript
import { DBState } from '../stores.svelte';
import { selectedCharID } from '../stores.svelte';
import { getDatabase, getCurrentCharacter } from '../storage/database.svelte';
```

**백엔드 재사용 가능성: ✅ 높음 (리팩토링 필요)**

**분리 전략:**
```typescript
// 현재
export async function sendChat() {
    const db = getDatabase();  // 전역 상태
    const char = getCurrentCharacter();  // 전역 상태
    // ...
}

// 변경 후
export async function sendChat(params: {
    userId: string,
    characterId: string,
    chatId: string,
    message: string,
    getDatabase: (userId: string) => Promise<Database>,
    getCharacter: (userId: string, charId: string) => Promise<Character>
}) {
    const db = await params.getDatabase(params.userId);
    const char = await params.getCharacter(params.userId, params.characterId);
    // ...
}
```

**리팩토링 필요 사항:**
1. 모든 `getDatabase()` 호출을 파라미터로 변경
2. `selectedCharID` 같은 전역 상태 제거
3. 사용자 ID 기반 접근으로 변경

---

#### 1.4.2 AI 요청 처리 (`process/request/request.ts`)

**현재 구조:**
- 다양한 AI 모델 지원 (OpenAI, Claude, Gemini 등)
- 스트리밍 지원
- 프록시 처리

**의존성:**
```typescript
import { getDatabase } from '../../storage/database.svelte';
import { globalFetch } from '../../globalApi.svelte';
```

**백엔드 재사용 가능성: ✅ 매우 높음**

**분리 전략:**
1. **fetch 함수 교체**: `globalFetch` → 표준 `fetch` 또는 `axios`
2. **Database 접근**: 파라미터로 전달
3. **스트리밍**: Node.js `ReadableStream` 사용

**사용 가능한 기능:**
- ✅ 모든 AI 모델 요청 로직
- ✅ 스트리밍 처리
- ✅ 에러 핸들링
- ✅ 재시도 로직

---

#### 1.4.3 프롬프트 처리 (`process/prompt.ts`)

**현재 구조:**
- 프롬프트 템플릿 관리
- 토큰 계산
- 프리셋 변환

**의존성:**
```typescript
import { getDatabase, presetTemplate } from '../storage/database.svelte';
```

**백엔드 재사용 가능성: ✅ 매우 높음**

**분리 전략:**
- Database 인터페이스만 사용하므로 파라미터로 전달하면 됨

---

### 1.5 Model 시스템 (`src/ts/model/`)

**현재 구조:**
- 모델 목록 관리
- 모델 정보 조회
- 프로바이더별 모델 정의

**의존성:**
```typescript
import { getDatabase } from '../storage/database.svelte';
```

**백엔드 재사용 가능성: ✅ 매우 높음**

**분리 전략:**
- `getDatabase()` 호출을 파라미터로 변경
- 모델 목록은 정적 데이터이므로 그대로 사용 가능

---

### 1.6 Tokenizer 시스템 (`src/ts/tokenizer.ts`)

**현재 구조:**
- 다양한 토크나이저 지원 (Tiktoken, Mistral, Claude 등)
- 캐싱 기능
- 정확한 토큰 계산

**의존성:**
```typescript
import { getDatabase } from './storage/database.svelte';
import { risuChatParser } from './parser.svelte';
```

**백엔드 재사용 가능성: ✅ 매우 높음**

**분리 전략:**
1. `getDatabase()` → 파라미터로 전달
2. `risuChatParser` → CBS 파싱만 필요하므로 분리된 CBS 사용

**사용 가능한 기능:**
- ✅ 모든 토크나이저
- ✅ 토큰 계산
- ✅ 캐싱 (Redis 활용 가능)

---

### 1.7 Memory 시스템 (`src/ts/process/memory/`)

**현재 구조:**
- SupaMemory
- HypaMemory V2/V3
- HanuraiMemory

**의존성:**
```typescript
// 대부분 Database 인터페이스만 사용
import { getDatabase } from '../../storage/database.svelte';
```

**백엔드 재사용 가능성: ✅ 매우 높음**

**분리 전략:**
- Database를 파라미터로 전달
- 벡터 DB (Pinecone, Weaviate 등)와 통합 가능

---

## 2. Database 분리 시 영향도 분석

### 2.1 직접 의존하는 파일 목록

**높은 의존성 (즉시 수정 필요):**
- `src/ts/storage/database.svelte.ts` - 핵심
- `src/ts/stores.svelte.ts` - DBState 정의
- `src/ts/process/index.svelte.ts` - 채팅 처리
- `src/ts/globalApi.svelte.ts` - 데이터 로드/저장

**중간 의존성 (파라미터화 필요):**
- `src/ts/process/request/request.ts`
- `src/ts/process/prompt.ts`
- `src/ts/process/scripts.ts`
- `src/ts/process/lorebook.svelte.ts`
- `src/ts/tokenizer.ts`
- `src/ts/model/modellist.ts`
- `src/ts/util.ts`

**낮은 의존성 (최소 수정):**
- `src/ts/cbs.ts` - 이미 의존성 주입 패턴
- `src/ts/process/memory/*` - 인터페이스만 사용

### 2.2 분리 전략

#### Phase 1: 인터페이스 분리
```typescript
// shared/types/database.ts
export interface Database { ... }
export interface character { ... }
export interface Chat { ... }
```

#### Phase 2: 접근 패턴 변경
```typescript
// 현재
function processChat() {
    const db = getDatabase();  // 전역
    // ...
}

// 변경 후
function processChat(db: Database, userId: string, charId: string) {
    // ...
}
```

#### Phase 3: 어댑터 레이어 생성
```typescript
// backend/adapters/database.ts
export class DatabaseAdapter {
    async getDatabase(userId: string): Promise<Database> {
        // DB 쿼리
    }
    
    async saveDatabase(userId: string, data: Database): Promise<void> {
        // DB 저장
    }
}
```

---

## 3. 백엔드 재사용 가능성 요약

| 시스템 | 재사용 가능성 | 수정 난이도 | 우선순위 |
|--------|--------------|------------|---------|
| **Database 인터페이스** | ✅ 매우 높음 | 낮음 | 높음 |
| **CBS 시스템** | ✅ 매우 높음 | 낮음 | 높음 |
| **Model 시스템** | ✅ 매우 높음 | 낮음 | 높음 |
| **Tokenizer** | ✅ 매우 높음 | 낮음 | 높음 |
| **Memory 시스템** | ✅ 매우 높음 | 낮음 | 중간 |
| **Process/Request** | ✅ 높음 | 중간 | 높음 |
| **Process/Prompt** | ✅ 높음 | 중간 | 높음 |
| **Process/Scripts** | ✅ 높음 | 중간 | 중간 |
| **Parser (CBS 부분)** | ✅ 높음 | 낮음 | 중간 |
| **Parser (HTML 렌더링)** | ⚠️ 제한적 | 높음 | 낮음 |

---

## 4. 마이그레이션 로드맵

### Step 1: 공통 타입 분리 (1-2주)
- [ ] `Database`, `character`, `Chat` 등 인터페이스를 별도 패키지로 분리
- [ ] 공유 타입 패키지 생성 (`@risuai/types`)

### Step 2: CBS 시스템 분리 (1주)
- [ ] CBS를 독립 패키지로 분리
- [ ] 백엔드용 CBS 등록 함수 작성

### Step 3: Process 시스템 리팩토링 (2-3주)
- [ ] 모든 `getDatabase()` 호출을 파라미터로 변경
- [ ] 전역 상태 의존성 제거
- [ ] 사용자 ID 기반 접근으로 변경

### Step 4: Model/Tokenizer 분리 (1주)
- [ ] Model 목록을 정적 데이터로 분리
- [ ] Tokenizer를 독립 함수로 변경

### Step 5: 백엔드 통합 (2-3주)
- [ ] 데이터베이스 어댑터 구현
- [ ] API 엔드포인트 작성
- [ ] 테스트 작성

---

## 5. 권장 아키텍처

### 5.1 패키지 구조

```
risuai-backend/
├── packages/
│   ├── types/           # 공통 타입 정의
│   ├── cbs/            # CBS 시스템
│   ├── tokenizer/      # 토크나이저
│   ├── process/        # 채팅 처리 로직
│   └── model/          # 모델 관리
├── server/
│   ├── adapters/       # 데이터베이스 어댑터
│   ├── api/            # API 엔드포인트
│   └── services/       # 비즈니스 로직
└── shared/
    └── utils/          # 공통 유틸리티
```

### 5.2 의존성 주입 패턴

```typescript
// 서비스 생성
class ChatService {
    constructor(
        private dbAdapter: DatabaseAdapter,
        private cbsRegistry: CBSRegistry,
        private tokenizer: Tokenizer
    ) {}
    
    async processChat(userId: string, charId: string, message: string) {
        const db = await this.dbAdapter.getDatabase(userId);
        const char = await this.dbAdapter.getCharacter(userId, charId);
        
        // 기존 로직 재사용
        return await sendChat({
            db,
            char,
            message,
            cbsRegistry: this.cbsRegistry,
            tokenizer: this.tokenizer
        });
    }
}
```

---

## 6. 결론

### ✅ 가능한 것들

1. **Database 인터페이스**: 그대로 사용 가능
2. **CBS 시스템**: 의존성 주입 패턴으로 완전 분리 가능
3. **Model/Tokenizer**: 최소 수정으로 재사용 가능
4. **Process 로직**: 리팩토링 후 대부분 재사용 가능
5. **Memory 시스템**: 벡터 DB와 통합 가능

### ⚠️ 제한사항

1. **Parser HTML 렌더링**: 서버에서는 제한적 사용 (SSR 시에만)
2. **브라우저 전용 기능**: 파일 선택, 다이얼로그 등은 API로 대체
3. **실시간 UI 업데이트**: WebSocket으로 대체 필요

### 📊 예상 작업량

- **총 작업 시간**: 8-12주
- **핵심 로직 재사용률**: 약 70-80%
- **새로 작성 필요**: 약 20-30% (어댑터, API 엔드포인트)

### 🎯 권장 접근 방법

1. **점진적 마이그레이션**: 한 시스템씩 분리
2. **인터페이스 우선**: 타입 정의부터 분리
3. **의존성 주입**: 전역 상태 제거
4. **테스트 우선**: 각 단계마다 테스트 작성

---

**작성일**: 2024년
**버전**: 1.0
**상태**: 분석 완료
