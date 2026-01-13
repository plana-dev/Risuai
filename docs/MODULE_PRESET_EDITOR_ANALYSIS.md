# 모듈/프리셋 제작 툴 분석 및 구현 방안

## 현재 구현 상태

### 기존 편집 UI 존재 여부

RisuAI에는 이미 모듈과 프리셋을 편집할 수 있는 UI가 **앱 내부에 통합**되어 있습니다.

#### 1. 모듈 편집 UI

**위치**: `src/lib/Setting/Pages/Module/`

**주요 파일**:
- `ModuleSettings.svelte`: 모듈 목록 및 관리
- `ModuleMenu.svelte`: 모듈 편집 인터페이스

**기능**:
- ✅ 모듈 목록 표시 및 검색
- ✅ 모듈 생성/편집/삭제
- ✅ 로어북 편집 (LoreBookList 컴포넌트 사용)
- ✅ 정규식 스크립트 편집 (RegexList 컴포넌트 사용)
- ✅ 트리거 스크립트 편집 (TriggerList 컴포넌트 사용)
- ✅ 에셋 관리 (이미지, 오디오 등)
- ✅ 모듈 Import/Export (.risum, JSON)
- ✅ 전역 활성화 토글
- ✅ 네임스페이스 설정

**접근 경로**: 설정 → 모듈 설정 페이지

#### 2. 프리셋 편집 UI

**위치**: `src/lib/Setting/botpreset.svelte`

**기능**:
- ✅ 프리셋 목록 표시
- ✅ 프리셋 생성/복사/삭제
- ✅ 프리셋 이름 편집
- ✅ 프리셋 드래그 앤 드롭 정렬
- ✅ 프리셋 Import/Export (.risup, JSON)
- ✅ 프리셋 비교 기능 (diff 모드)
- ✅ Realm 공유 기능

**접근 경로**: 설정 → 봇 설정 → 프리셋 버튼

**참고**: 실제 프리셋 설정 편집은 `BotSettings.svelte`에서 이루어집니다.

---

## 독립 제작 툴의 필요성

### 현재 방식의 제한사항

1. **앱 내부 통합**: RisuAI 앱을 실행해야만 편집 가능
2. **전체 앱 의존성**: DBState, 전역 스토어 등에 의존
3. **복잡한 설정**: 모듈/프리셋 편집을 위해 전체 앱을 이해해야 함
4. **오프라인 작업 어려움**: 파일만으로는 편집 불가

### 독립 툴의 장점

1. **경량화**: 필요한 기능만 포함
2. **독립 실행**: RisuAI 앱 없이도 작동
3. **파일 중심**: .risum/.risup 파일 직접 편집
4. **배포 용이**: 웹 앱 또는 데스크톱 앱으로 배포 가능
5. **개발 편의성**: 모듈/프리셋 개발자에게 유용

---

## 독립 제작 툴 구현 방안

### 아키텍처 옵션

#### 옵션 1: 웹 기반 독립 앱 (권장)

**기술 스택**:
- Svelte 5 (기존과 동일)
- Vite
- TypeScript

**구조**:
```
module-preset-editor/
├── src/
│   ├── lib/
│   │   ├── ModuleEditor/      # 모듈 편집 UI
│   │   ├── PresetEditor/      # 프리셋 편집 UI
│   │   └── FileManager/       # 파일 로드/저장
│   ├── ts/
│   │   ├── modules.ts         # 모듈 로직 (기존 코드 재사용)
│   │   ├── presets.ts         # 프리셋 로직 (기존 코드 재사용)
│   │   └── fileHandlers.ts    # 파일 I/O
│   └── App.svelte
└── package.json
```

**장점**:
- 기존 코드 재사용 가능
- 브라우저에서 바로 실행
- 배포 간편 (정적 호스팅)

**단점**:
- 파일 시스템 접근 제한 (File API 사용)
- 브라우저 호환성 고려 필요

#### 옵션 2: Tauri 기반 데스크톱 앱

**기술 스택**:
- Svelte 5
- Tauri
- TypeScript

**장점**:
- 네이티브 파일 시스템 접근
- 기존 RisuAI와 유사한 환경
- 오프라인 작업 용이

**단점**:
- 빌드 복잡도 증가
- 플랫폼별 빌드 필요

#### 옵션 3: Electron 기반 데스크톱 앱

**기술 스택**:
- Svelte 5
- Electron
- TypeScript

**장점**:
- 크로스 플랫폼
- 파일 시스템 접근 용이

**단점**:
- 번들 크기 큼
- 리소스 사용량 높음

---

## 구현 계획 (웹 기반 권장)

### Phase 1: 핵심 기능

#### 1.1 파일 로드/저장

```typescript
// src/ts/fileHandlers.ts

// .risum 파일 읽기
export async function loadModuleFile(file: File): Promise<RisuModule> {
    const buffer = await file.arrayBuffer()
    return await readModule(Buffer.from(buffer))
}

// .risum 파일 저장
export async function saveModuleFile(module: RisuModule): Promise<Blob> {
    const buffer = await exportModule(module, { alertEnd: false, saveData: false })
    return new Blob([buffer], { type: 'application/octet-stream' })
}

// .risup 파일 읽기
export async function loadPresetFile(file: File): Promise<botPreset> {
    const buffer = await file.arrayBuffer()
    // importPreset 로직 재사용
}

// .risup 파일 저장
export async function savePresetFile(preset: botPreset): Promise<Blob> {
    // downloadPreset 로직 재사용
}
```

#### 1.2 모듈 편집 UI

**재사용 가능한 컴포넌트**:
- `ModuleMenu.svelte` → 약간 수정하여 재사용
- `LoreBookList.svelte` → 그대로 재사용
- `RegexList.svelte` → 그대로 재사용
- `TriggerList.svelte` → 그대로 재사용

**새로 필요한 것**:
- 파일 드래그 앤 드롭 영역
- 파일 저장 버튼
- 미리보기 기능

#### 1.3 프리셋 편집 UI

**재사용 가능한 컴포넌트**:
- 프리셋 목록 UI (일부)

**새로 필요한 것**:
- 프리셋 설정 편집 폼
- 모델 선택 UI
- 파라미터 슬라이더/입력
- 프롬프트 편집기

### Phase 2: 고급 기능

1. **JSON 형식 지원**: .risum/.risup 외에 JSON 형식도 편집
2. **템플릿 기능**: 기본 모듈/프리셋 템플릿 제공
3. **검증 기능**: 파일 형식 검증 및 오류 표시
4. **미리보기**: 모듈/프리셋 미리보기 기능
5. **배치 처리**: 여러 파일 동시 편집

### Phase 3: 편의 기능

1. **히스토리**: 편집 히스토리 관리
2. **다크 모드**: 테마 지원
3. **다국어**: 언어 지원
4. **플러그인**: 확장 기능 지원

---

## 재사용 가능한 코드

### 직접 재사용 가능

1. **모듈 로직**:
   - `src/ts/process/modules.ts`의 `exportModule`, `readModule`
   - `src/ts/process/modules.ts`의 `RisuModule` 인터페이스

2. **프리셋 로직**:
   - `src/ts/storage/database.svelte.ts`의 `downloadPreset`, `importPreset`
   - `src/ts/storage/database.svelte.ts`의 `botPreset` 인터페이스

3. **UI 컴포넌트**:
   - `src/lib/SideBars/LoreBook/LoreBookList.svelte`
   - `src/lib/SideBars/Scripts/RegexList.svelte`
   - `src/lib/SideBars/Scripts/TriggerList.svelte`
   - `src/lib/Setting/Pages/Module/ModuleMenu.svelte` (수정 필요)

### 수정 필요

1. **의존성 제거**:
   - `DBState` 의존성 제거
   - 전역 스토어 의존성 제거
   - `getDatabase()`, `setDatabase()` 호출 제거

2. **파일 I/O 변경**:
   - 브라우저 File API 사용
   - 다운로드 링크 생성 방식 변경

---

## 구현 예시 구조

### 메인 앱 구조

```svelte
<!-- src/App.svelte -->
<script lang="ts">
    import ModuleEditor from './lib/ModuleEditor/ModuleEditor.svelte'
    import PresetEditor from './lib/PresetEditor/PresetEditor.svelte'
    
    let mode = $state<'module' | 'preset'>('module')
    let currentFile: File | null = $state(null)
</script>

<div class="app">
    <nav>
        <button onclick={() => mode = 'module'}>모듈 편집</button>
        <button onclick={() => mode = 'preset'}>프리셋 편집</button>
    </nav>
    
    {#if mode === 'module'}
        <ModuleEditor />
    {:else}
        <PresetEditor />
    {/if}
</div>
```

### 모듈 편집기 구조

```svelte
<!-- src/lib/ModuleEditor/ModuleEditor.svelte -->
<script lang="ts">
    import { loadModuleFile, saveModuleFile } from '../../ts/fileHandlers'
    import ModuleMenu from '../ModuleMenu/ModuleMenu.svelte' // 재사용
    import type { RisuModule } from '../../ts/process/modules'
    
    let module: RisuModule | null = $state(null)
    
    async function handleFileLoad(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
            module = await loadModuleFile(file)
        }
    }
    
    async function handleSave() {
        if (module) {
            const blob = await saveModuleFile(module)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${module.name}.risum`
            a.click()
        }
    }
</script>

<div class="module-editor">
    <input type="file" accept=".risum,.json" onchange={handleFileLoad} />
    
    {#if module}
        <ModuleMenu bind:currentModule={module} />
        <button onclick={handleSave}>저장</button>
    {/if}
</div>
```

---

## 기술적 고려사항

### 1. 의존성 관리

**필요한 패키지**:
- `rpack` (RPack 인코딩/디코딩)
- `msgpackr` (MessagePack 인코딩/디코딩)
- `fflate` (압축)
- `uuid` (UUID 생성)
- 기타 RisuAI 의존성

**해결 방안**:
- 필요한 코드만 추출하여 독립 패키지로 분리
- 또는 RisuAI의 일부를 서브모듈로 사용

### 2. 파일 크기

**문제**: .risum/.risup 파일은 바이너리 형식

**해결**:
- 브라우저에서 ArrayBuffer로 처리
- File API 사용
- Blob URL로 다운로드

### 3. 에셋 처리

**문제**: 모듈의 에셋은 로컬 저장소에 저장됨

**해결**:
- 브라우저: Data URL 또는 Blob URL 사용
- 데스크톱: 로컬 파일 경로 사용

---

## 추천 구현 방식

### 단계별 접근

1. **1단계: 최소 기능 구현**
   - .risum 파일 읽기/쓰기
   - 기본 모듈 편집 UI
   - 파일 저장 기능

2. **2단계: 기능 확장**
   - .risup 파일 지원
   - JSON 형식 지원
   - UI 개선

3. **3단계: 고급 기능**
   - 검증 기능
   - 미리보기
   - 템플릿

### 권장 기술 스택

**웹 기반 독립 앱** (가장 빠른 구현):
- Svelte 5 + Vite
- 기존 RisuAI 코드 재사용
- 브라우저 File API
- 정적 호스팅 (Vercel, Netlify 등)

---

## 결론

### 현재 상태
- ✅ RisuAI 앱 내부에 편집 UI 존재
- ❌ 독립 실행 가능한 제작 툴 없음

### 구현 가능성
- ✅ **완전히 구현 가능**
- ✅ 기존 코드 대부분 재사용 가능
- ✅ 웹 기반으로 빠르게 개발 가능

### 추천 사항
1. **웹 기반 독립 앱**으로 시작
2. **기존 UI 컴포넌트 재사용**
3. **점진적 기능 추가**
4. **필요시 Tauri로 데스크톱 앱 전환**

### 예상 개발 시간
- **최소 기능**: 1-2주
- **완전한 기능**: 1-2개월
- **고급 기능 포함**: 2-3개월

---

## 다음 단계

1. 프로젝트 구조 설계
2. 필요한 코드 추출 및 의존성 정리
3. 최소 기능 프로토타입 구현
4. UI 컴포넌트 통합
5. 테스트 및 개선

