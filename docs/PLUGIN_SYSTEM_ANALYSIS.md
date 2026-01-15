# RisuAI 플러그인 시스템 분석

**작성일**: 2026년 1월  
**기준**: `src/ts/plugins/` 및 관련 코드 분석

---

## 📋 개요

RisuAI의 플러그인 시스템은 **사용자/서드파티 JavaScript/TypeScript 코드로 앱의 동작을 확장**하는 기능입니다. 플러그인은 채팅 요청 전후 처리, 텍스트 변환, 커스텀 AI Provider 추가, UI 확장 등 다양한 지점에서 앱 기능에 개입할 수 있습니다.

**현재 지원 API 버전:**
- **Plugin API v3.0** (권장) - iframe sandbox 기반, 보안 중심
- **Plugin API v2.x** (레거시) - 런타임 내부 실행, 파이프라인 훅 중심

---

## 🏗️ 플러그인 시스템 아키텍처

### API v3.0 (권장)

#### 구조
```
+=====================================+
|   Main Risuai Application          |
|                                     |
|  +===============================+ |
|  |  Plugin Iframe (Hidden)       | |
|  |                               | |
|  |  - Your Plugin Code           | |
|  |  - Custom UI (optional)       | |
|  |  - Risuai API access          | |
|  +===============================+ |
|                                     |
|  Safe DOM Access via getRootDocument()
+=====================================+
```

#### 특징
- **Sandboxed iframe**: 각 플러그인이 독립된 iframe에서 실행
- **PostMessage RPC**: iframe과 메인 앱 간 통신은 postMessage 기반
- **SafeDocument/SafeElement**: 메인 앱 DOM 접근은 제한된 래퍼를 통해서만
- **자동 Sanitization**: DOMPurify로 HTML 자동 정화
- **비동기 API**: 모든 API 메서드가 Promise 반환 (postMessage 통신 때문)

#### 주요 파일
- `src/ts/plugins/apiV3/v3.ts` - v3 플러그인 로더 및 API 구현
- `src/ts/plugins/apiV3/factory.ts` - SandboxHost 클래스 (iframe 관리)
- `src/ts/plugins/apiV3/risuai.d.ts` - TypeScript 타입 정의
- `src/ts/plugins/apiV3/transpiler.ts` - TypeScript → JavaScript 변환

### API v2.x (레거시)

#### 구조
- 플러그인 코드가 메인 앱 런타임 내부에서 직접 실행
- 전역 `__pluginApis__` 객체를 통해 API 접근
- 보안 검사는 `checkCodeSafety()`로 수행

#### 주요 파일
- `src/ts/plugins/plugins.ts` - v2 플러그인 로더 및 API 구현
- `src/ts/plugins/pluginSafety.ts` - 코드 안전성 검사

---

## 🔄 플러그인 로딩 및 관리

### 플러그인 가져오기/업데이트

**코드 위치**: `src/ts/plugins/plugins.ts`

**주요 함수:**
- `importPlugin(code, options)` - 플러그인 가져오기
  - 파일 선택 또는 코드 문자열로 플러그인 로드
  - 메타데이터 파싱 (`//@name`, `//@api`, `//@arg` 등)
  - 안전성 검사 (`checkCodeSafety()`)
  - TypeScript 변환 (`pluginCodeTranspiler()`)
  - DB에 저장 (`db.plugins`)

- `updatePlugin(plugin)` - 플러그인 업데이트
  - `updateURL`에서 최신 버전 확인
  - 버전 비교 후 업데이트

- `loadPlugins()` - 플러그인 로드
  - enabled 플러그인 필터링
  - v2/v3 분리하여 각각 로드

### 플러그인 메타데이터

플러그인 파일 상단에 주석으로 정의:

```javascript
//@name my_plugin              // 필수: 내부 식별자
//@display-name My Plugin      // 선택: 표시 이름
//@api 3.0                     // 필수: API 버전
//@version 1.0.0               // 선택: 플러그인 버전
//@arg api_key string          // 선택: 플러그인 인자
//@link https://example.com     // 선택: 링크
//@update-url https://...       // 선택: 업데이트 URL
```

---

## 🎯 플러그인이 사용되는 지점

### 1. 채팅 요청 파이프라인

**코드 위치**: `src/ts/process/request/request.ts`

#### BeforeRequest Replacer
```typescript
// LLM 호출 직전에 메시지 배열 수정
if(pluginV2.replacerbeforeRequest.size > 0){
    for(const replacer of pluginV2.replacerbeforeRequest){
        arg.formated = await replacer(arg.formated, model)
    }
}
```

**사용 사례:**
- 시스템 프롬프트 자동 삽입
- 정책 문구 추가
- 메시지 필터링/변환

#### AfterRequest Replacer
```typescript
// LLM 응답 문자열 후처리
if(da.type === 'success' && pluginV2.replacerafterRequest.size > 0){
    for(const replacer of pluginV2.replacerafterRequest){
        da.result = await replacer(da.result, model)
    }
}
```

**사용 사례:**
- 응답 텍스트 변환
- 금지어 필터링
- 포맷팅 추가

### 2. 스크립팅/표시 단계 텍스트 가공

**코드 위치**: `src/ts/process/scripts.ts`

```typescript
// processScriptFull()에서 mode별로 플러그인 핸들러 실행
if(pluginV2[mode].size > 0){
    for(const plugin of pluginV2[mode]){
        const res = await plugin(data)
        if(res !== null && res !== undefined){
            data = res
        }
    }
}
```

**지원 모드:**
- `editinput` - 사용자 입력 처리 전
- `editprocess` - 처리 중
- `editoutput` - AI 출력 처리 후
- `editdisplay` - 화면 표시 전

**사용 사례:**
- 마크다운 변환
- 이모지 변환
- 텍스트 필터링

### 3. 커스텀 AI Provider 추가

**코드 위치**: `src/ts/plugins/plugins.ts`, `src/ts/process/request/request.ts`

```typescript
// 플러그인에서 Provider 등록
Risuai.addProvider('MyCustomProvider', async (args, abortSignal) => {
    // 커스텀 LLM API 호출
    return { success: true, content: response }
}, {
    tokenizer: 'custom',
    tokenizerFunc: async (content) => [/* token ids */]
})
```

**사용 사례:**
- 자체 LLM 서버 통합
- 새로운 AI 모델 지원
- 프록시 서버 연동

**동작 흐름:**
1. 플러그인이 `addProvider()`로 Provider 등록
2. `pluginV2.providers`에 저장
3. 사용자가 `db.currentPluginProvider`로 선택
4. `requestChatData()`에서 선택된 Provider 호출

### 4. 토크나이저 연동

**코드 위치**: `src/ts/tokenizer.ts`

```typescript
// 커스텀 Provider의 토크나이저 사용
if (db.aiModel === 'custom' && pluginTokenizer) {
    if (pluginTokenizer === 'custom') {
        result = await pluginV2.providerOptions
            .get(db.currentPluginProvider)
            ?.tokenizerFunc?.(data) ?? [0];
    }
}
```

**사용 사례:**
- 커스텀 모델의 토크나이저 구현
- 특수 토큰 처리

### 5. UI 확장

**API v3.0 기능:**

#### 설정 메뉴 항목 추가
```javascript
Risuai.registerSetting(
    'My Plugin Settings',
    async () => {
        await Risuai.showContainer('fullscreen');
        // UI 구성
    },
    '<svg>...</svg>', // 아이콘
    'html' // 아이콘 타입
);
```

#### 플로팅 액션 버튼 추가
```javascript
Risuai.registerButton({
    name: 'Quick Action',
    icon: 'https://example.com/icon.png',
    iconType: 'img',
    location: 'action' // 'action', 'chat', 'hamburger'
}, async () => {
    // 버튼 클릭 시 동작
});
```

#### Iframe UI 표시
```javascript
// 플러그인 iframe을 전체화면으로 표시
await Risuai.showContainer('fullscreen');

// iframe 내부에서 UI 구성 (표준 DOM API 사용)
document.body.innerHTML = '<div>My Plugin UI</div>';
```

---

## 🔐 보안 모델

### API v3.0 보안

1. **Iframe Sandbox**
   - 플러그인은 독립된 iframe에서 실행
   - 메인 앱 컨텍스트에 직접 접근 불가

2. **SafeDocument/SafeElement**
   - 메인 앱 DOM 접근은 래퍼를 통해서만
   - 제한된 메서드만 제공
   - 자동 HTML Sanitization (DOMPurify)

3. **Attribute 제한**
   - `x-` prefix만 허용 (예: `x-plugin-id`)
   - `onclick`, `href` 등 위험한 속성 차단

4. **이벤트 제한**
   - 허용된 이벤트만 등록 가능
   - 키보드 이벤트는 랜덤 지연 적용 (타이밍 공격 방지)

5. **Database 접근 제한**
   - `allowedDbKeys`로 접근 가능한 키만 허용
   - 읽기/쓰기 모두 제한

### API v2.x 보안

1. **코드 안전성 검사**
   - `checkCodeSafety()`로 위험한 패턴 검사
   - 일부 제한적 보안

2. **Database 접근 제한**
   - `allowedDbKeys`로 제한

---

## 💾 데이터 저장

### Plugin Storage (권장)

**특징:**
- Save-file specific (세이브파일별로 분리)
- 디바이스 간 동기화
- `db.pluginCustomStorage`에 저장

**사용:**
```javascript
await Risuai.pluginStorage.setItem('key', 'value');
const value = await Risuai.pluginStorage.getItem('key');
```

### Safe Local Storage

**특징:**
- Device-specific (디바이스별)
- 플러그인 간 공유
- `localStorage` 기반 (prefix: `safe_plugin_`)

**사용:**
```javascript
await Risuai.safeLocalStorage.setItem('key', 'value');
const value = await Risuai.safeLocalStorage.getItem('key');
```

---

## 📊 플러그인 시스템 통계

### 등록 가능한 훅

| 훅 타입 | API v2 | API v3 | 설명 |
|---------|--------|--------|------|
| **BeforeRequest Replacer** | ✅ | ✅ | 요청 전 메시지 배열 수정 |
| **AfterRequest Replacer** | ✅ | ✅ | 응답 후 텍스트 수정 |
| **EditInput Handler** | ✅ | ✅ | 입력 처리 전 |
| **EditProcess Handler** | ✅ | ✅ | 처리 중 |
| **EditOutput Handler** | ✅ | ✅ | 출력 처리 후 |
| **EditDisplay Handler** | ✅ | ✅ | 표시 전 |
| **Custom Provider** | ✅ | ✅ | 커스텀 AI Provider |
| **Custom Tokenizer** | ✅ | ✅ | 커스텀 토크나이저 |
| **UI Extension** | ❌ | ✅ | 설정 메뉴/버튼 추가 |
| **DOM Access** | 제한적 | ✅ (Safe) | 메인 앱 DOM 접근 |

---

## 🔌 플러그인 등록 구조

### pluginV2 객체 구조

```typescript
export const pluginV2 = {
    providers: Map<string, ProviderFunction>,           // 커스텀 Provider
    providerOptions: Map<string, ProviderOptions>,      // Provider 옵션 (토크나이저 등)
    editdisplay: Set<EditFunction>,                      // Display 핸들러
    editoutput: Set<EditFunction>,                      // Output 핸들러
    editprocess: Set<EditFunction>,                     // Process 핸들러
    editinput: Set<EditFunction>,                       // Input 핸들러
    replacerbeforeRequest: Set<ReplacerFunction>,       // BeforeRequest Replacer
    replacerafterRequest: Set<ReplacerFunction>,        // AfterRequest Replacer
    unload: Set<UnloadFunction>,                        // 언로드 핸들러
    loaded: boolean                                     // 로드 상태
}
```

---

## 🚀 플러그인 활용 예시

### 예시 1: 시스템 프롬프트 자동 추가

```javascript
//@name auto_system_prompt
//@api 3.0

(async () => {
    Risuai.addRisuReplacer('beforeRequest', async (messages, type) => {
        // 시스템 메시지가 없으면 추가
        if (!messages.some(m => m.role === 'system')) {
            return [
                { role: 'system', content: 'You are a helpful assistant.' },
                ...messages
            ];
        }
        return messages;
    });
})();
```

### 예시 2: 응답 텍스트 변환

```javascript
//@name markdown_converter
//@api 3.0

(async () => {
    Risuai.addRisuScriptHandler('output', async (content) => {
        // **bold** → <strong>bold</strong>
        return content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    });
})();
```

### 예시 3: 커스텀 AI Provider

```javascript
//@name custom_llm
//@api 3.0
//@arg api_key string Your API key

(async () => {
    Risuai.addProvider('CustomLLM', async (args, abortSignal) => {
        const apiKey = await Risuai.getArgument('api_key');
        const response = await Risuai.nativeFetch('https://api.example.com/chat', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                messages: args.prompt_chat,
                temperature: args.temperature,
                max_tokens: args.max_tokens
            }),
            signal: abortSignal
        });
        const data = await response.json();
        return {
            success: true,
            content: data.response
        };
    });
})();
```

---

## 🔍 서버 모듈에서의 고려사항

### 결정: 서버 모듈에서 플러그인 시스템 제외

**서버 모듈 (`src/server`)에서는 플러그인 시스템을 사용하지 않기로 결정했습니다.**

#### 제외 사유

1. **보안 위험**
   - 서버에서 사용자 코드 실행은 심각한 보안 위험
   - iframe sandbox는 브라우저 전용 (서버에서 불가)
   - VM2 등 샌드박스 솔루션도 완벽하지 않으며 복잡도 증가

2. **서비스 웹 특성**
   - 서비스 웹은 다중 사용자 환경
   - 사용자별 플러그인 실행은 리소스 관리 및 격리 문제
   - 클라이언트에서 플러그인 실행이 더 적합

3. **아키텍처 단순화**
   - 플러그인 시스템 제외로 서버 코드 단순화
   - 유지보수 및 디버깅 용이

#### 영향

**플러그인 훅이 사용되던 지점들:**

1. **BeforeRequest/AfterRequest Replacer**
   - 서버에서는 플러그인 훅 없이 직접 처리
   - 필요 시 서버 사이드 미들웨어/인터셉터 패턴으로 대체 가능

2. **Edit 핸들러 (input/process/output/display)**
   - 서버에서는 플러그인 훅 없이 직접 처리
   - 텍스트 변환은 서버 로직으로 처리

3. **커스텀 Provider**
   - 플러그인 없이 직접 Provider 구현
   - `src/server/process/request/`에 Provider 추가

4. **커스텀 토크나이저**
   - 플러그인 없이 직접 토크나이저 구현
   - `src/server/tokenizer/`에 토크나이저 추가

#### 대안

플러그인 기능이 필요한 경우:
- **클라이언트 사이드**: 클라이언트에서 플러그인 실행 후 결과를 서버로 전송
- **서버 확장**: 플러그인 대신 서버 사이드 확장 API 제공 (향후 고려)

#### 서버 코드 정리 필요

현재 서버 코드에 플러그인 관련 참조가 일부 남아있음 (정리 필요):

- `src/server/tokenizer/types.ts`: `pluginTokenizer` 타입 정의
- `src/server/tokenizer/cache.ts`: `pluginTokenizer` 캐시 키 사용
- `src/server/process/context.ts`: `pluginTokenizer: undefined` (TODO 주석)
- `src/server/tokenizer/encode.ts`: `pluginTokenizer` 처리 로직 (플러그인 없이 동작하도록 수정 필요)
- `src/server/process/auxiliary/scripts.ts`: 플러그인 처리 TODO 주석

**권장 작업:**
- 플러그인 관련 타입/로직 제거 또는 주석 처리
- 커스텀 토크나이저가 필요하면 플러그인 없이 직접 구현

---

## 📝 참고 자료

- **플러그인 개발 가이드**: `plugins.md`
- **API v3.0 타입 정의**: `src/ts/plugins/apiV3/risuai.d.ts`
- **마이그레이션 가이드**: `src/ts/plugins/migrationGuide.md`
- **플러그인 안전성 검사**: `src/ts/plugins/pluginSafety.ts`

---

**마지막 업데이트**: 2026년 1월
