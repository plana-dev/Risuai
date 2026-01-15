# Risuai 웹 구동 흐름 분석

**작성일**: 2026년 1월  
**범위**: 채팅 글 전송하기 전까지의 전체 흐름

---

## 📋 개요

이 문서는 Risuai 애플리케이션의 웹 구동 흐름을 분석합니다. 특히 채팅 메시지를 전송하기 전까지의 초기화, 캐릭터 선택, 채팅 선택 및 렌더링 과정을 상세히 설명합니다.

---

## 🔄 전체 흐름 다이어그램

```
1. 애플리케이션 시작 (main.ts)
   ↓
2. 데이터 초기화 (bootstrap.ts - loadData)
   ├─ 환경 감지 (Tauri/Web/Mobile)
   ├─ 저장 파일 로드
   ├─ 데이터 검증 및 마이그레이션
   ├─ 플러그인 로드
   ├─ UI 상태 초기화
   └─ loadedStore = true
   ↓
3. App.svelte 렌더링
   ├─ loadedStore 확인
   ├─ WelcomeRisu 또는 ChatScreen 표시
   └─ Sidebar 표시
   ↓
4. 캐릭터 선택 (changeChar)
   ├─ characterFormatUpdate 실행
   ├─ selectedCharID 설정
   └─ UI 업데이트
   ↓
5. 채팅 선택 및 인사말 표시
   ├─ chatPage 확인
   ├─ firstMessage 또는 alternateGreetings 표시
   └─ Chat 컴포넌트 렌더링
   ↓
6. 채팅창 렌더링
   ├─ Chats 컴포넌트
   ├─ 메시지 목록 표시
   └─ 이미지 및 에셋 렌더링
   ↓
7. 사용자 입력 대기
   └─ sendChat() 호출 준비
```

---

## 1. 애플리케이션 시작 (main.ts)

### 1.1 초기화 순서

```typescript
// src/main.ts
preLoadCheck()              // 환경 체크 및 이탈 방지 핸들러 설정
  ↓
mount(App, { target: '#app' })  // App.svelte 마운트
  ↓
loadData()                  // 데이터 로드 (비동기)
  ↓
initHotkey()                // 전역 단축키 등록
  ↓
document.getElementById('preloading').remove()  // 로딩 화면 제거
```

### 1.2 preLoadCheck()

**위치**: `src/preload.ts`

**기능**:
- 환경 감지: Tauri, Node Server, Capacitor 등
- 웹 환경에서 페이지 이탈 방지 핸들러 설정
- localStorage에 방문 기록 저장

---

## 2. 데이터 초기화 (bootstrap.ts - loadData)

### 2.1 초기화 프로세스

**위치**: `src/ts/bootstrap.ts`

**주요 단계**:

#### 2.1.1 환경별 데이터 로드

**Tauri (데스크톱) 환경**:
```typescript
1. 디렉토리 생성 확인
   - AppData/database/
   - AppData/assets/
2. 저장 파일 읽기
   - database/database.bin 읽기
   - 실패 시 백업 파일 복원
3. 업데이트 체크
4. 전체화면 모드 설정
```

**웹/모바일 환경**:
```typescript
1. LocalForage 초기화
2. 로컬 저장 파일 로드
   - database/database.bin
3. 계정 동기화 체크
   - 계정이 있으면 원격 저장 파일 로드
4. Drive Sync 체크
5. Service Worker 등록
6. 첫 설정 시 캐릭터 URL 임포트
```

#### 2.1.2 불필요한 파일 정리 (`pargeChunks()`)

- 사용하지 않는 에셋 파일 삭제
- 계정 동기화 사용 시 스킵
- Tauri: 파일 시스템 기반 정리
- 웹: LocalForage 인덱스 기반 정리

#### 2.1.3 플러그인 로드 (`loadPlugins()`)

- 설치된 플러그인 초기화
- 플러그인 API 등록

#### 2.1.4 계정 데이터 로드 (`loadRisuAccountData()`)

- 계정 정보가 있는 경우에만 실행
- 사용자 계정 데이터 동기화

#### 2.1.5 포맷 업데이트 체크 (`checkNewFormat()`)

**주요 작업**:
- 데이터 무결성 검사
- 캐릭터 데이터 포맷 마이그레이션
- ID 할당 (chaId, chat.id)
- 기본값 설정
- 버전별 마이그레이션 (formatversion 2, 3, 4, 5)

#### 2.1.6 UI 상태 초기화

```typescript
updateColorScheme()          // 색상 테마 적용
updateTextThemeAndCSS()      // 텍스트 테마 및 CSS 업데이트
updateAnimationSpeed()       // 애니메이션 속도 설정
updateHeightMode()           // 높이 모드 설정 (auto/vh/dvh/lvh/svh)
updateErrorHandling()        // 에러 핸들링 설정
updateGuisize()              // GUI 크기 설정
```

#### 2.1.7 최종 설정

```typescript
selectedCharID.set(-1)       // 캐릭터 선택 초기화
startObserveDom()            // DOM 관찰 시작
assignIds()                  // ID 할당 (중복 체크)
makeColdData()               // Cold Data 생성
saveDb()                     // 데이터베이스 저장
moduleUpdate()               // 모듈 업데이트
loadedStore.set(true)        // 로드 완료 플래그
```

---

## 3. App.svelte 렌더링

### 3.1 컴포넌트 구조

**위치**: `src/App.svelte`

**조건부 렌더링**:

```svelte
{#if !$loadedStore}
  <!-- 로딩 화면 -->
{:else if $selectedCharID === -1}
  <!-- 캐릭터 미선택 상태 -->
  {#if didFirstSetup}
    <WelcomeRisu />          <!-- 환영 화면 -->
  {:else}
    <GridChars />            <!-- 캐릭터 그리드 -->
  {/if}
{:else}
  <!-- 캐릭터 선택 상태 -->
  <ChatScreen />            <!-- 채팅 화면 -->
{/if}
```

### 3.2 주요 컴포넌트

- **Sidebar**: 캐릭터 목록 및 사이드바
- **ChatScreen**: 채팅 화면 (DefaultChatScreen 또는 기타)
- **WelcomeRisu**: 첫 설정 시 환영 화면
- **GridChars**: 캐릭터 그리드 뷰
- **Settings**: 설정 화면
- **AlertComp**: 알림 컴포넌트

---

## 4. 캐릭터 선택 (changeChar)

### 4.1 캐릭터 선택 흐름

**위치**: `src/ts/characters.ts`

```typescript
export function changeChar(index: number, arg: { reseter?: () => any } = {}) {
    // 1. 채팅 중이면 선택 불가
    if (get(doingChat)) {
        return;
    }
    
    // 2. 리셋 함수 실행 (선택적)
    reseter();
    
    // 3. 캐릭터 포맷 업데이트
    characterFormatUpdate(index, {
        updateInteraction: true,  // 상호작용 시간 업데이트
    });
    
    // 4. 선택된 캐릭터 ID 설정
    selectedCharID.set(index);
}
```

### 4.2 characterFormatUpdate()

**위치**: `src/ts/characters.ts`

**주요 작업**:

#### 4.2.1 기본 구조 검증
- 채팅 목록 확인: `chats.length === 0`이면 기본 채팅 생성
- 채팅 페이지 검증: `chatPage`가 유효하지 않으면 0으로 설정
- 메시지 배열 확인: 없으면 빈 배열 생성
- 타입 확인: 없으면 'character'로 설정
- ID 확인: `chaId`가 없으면 UUID 생성

#### 4.2.2 캐릭터 타입별 처리

**일반 캐릭터 (`type === 'character'`)**:
- `sdData`: Stable Diffusion 설정 (없으면 기본값)
- `utilityBot`: 유틸리티 봇 여부 (기본값: false)
- `triggerscript`: 트리거 스크립트 배열
- `alternateGreetings`: 대체 인사말 배열
- `systemPrompt`, `scenario`, `personality`: 프롬프트 필드
- `tags`, `creator`, `characterVersion`: 메타데이터
- `voicevoxConfig`: VOICEVOX 설정
- `globalLore`: 글로벌 로어북 (updateLorebooks 호출)
- `newGenData`: 없으면 `updateInlayScreen` 호출
- `ttsMode`: TTS 모드 설정 (legacy 'none' → '' 마이그레이션)

**그룹 채팅 (`type === 'group'`)**:
- `characterTalks`: 각 캐릭터의 대화 비율 배열
- `characterActive`: 각 캐릭터의 활성화 상태 배열

#### 4.2.3 공통 처리
- `customscript`: 커스텀 스크립트 배열
- `lastInteraction`: 상호작용 시간 업데이트 (arg.updateInteraction이 true일 때)
- 각 채팅의 `fmIndex` 설정 (없으면 `firstMsgIndex` 또는 -1)
- 각 채팅의 `id` 확인 및 생성
- 각 채팅의 `localLore` 확인 및 초기화

### 4.3 selectedCharID Store

**위치**: `src/ts/stores.svelte.ts`

```typescript
export const selectedCharID = writable(-1)
```

**사용**:
- `-1`: 캐릭터 미선택
- `0 이상`: 선택된 캐릭터 인덱스

**반응형 업데이트**:
- `selectedCharID`가 변경되면 자동으로 UI 업데이트
- `DefaultChatScreen.svelte`에서 `$selectedCharID` 사용

---

## 5. 채팅 선택 및 인사말 표시

### 5.1 채팅 선택

**위치**: `src/lib/ChatScreens/DefaultChatScreen.svelte`

**현재 채팅 정보**:
```typescript
let currentCharacter = $derived(DBState.db.characters[$selectedCharID])
let currentChat = $derived(
    currentCharacter?.chats[currentCharacter.chatPage]?.message ?? []
)
```

**채팅 선택 로직**:
- `currentCharacter.chatPage`: 현재 선택된 채팅 인덱스
- `changeChatTo(IdOrIndex)`: 채팅 변경 함수

### 5.2 인사말 표시 조건

**위치**: `src/lib/ChatScreens/DefaultChatScreen.svelte` (819-860줄)

**조건**:
```svelte
{#if DBState.db.characters[$selectedCharID]
    .chats[DBState.db.characters[$selectedCharID].chatPage]
    .message.length <= loadPages}
    
    {#if DBState.db.characters[$selectedCharID].type !== 'group'}
        <Chat
            message={
                chat.fmIndex === -1 
                    ? character.firstMessage 
                    : character.alternateGreetings[chat.fmIndex]
            }
            firstMessage={true}
            ...
        />
    {/if}
{/if}
```

**인사말 선택 로직**:
- `chat.fmIndex === -1`: 기본 인사말 (`firstMessage`) 사용
- `chat.fmIndex >= 0`: 대체 인사말 (`alternateGreetings[fmIndex]`) 사용

**Cold Storage 처리**:
- 메시지가 `coldStorageHeader`로 시작하면 `preLoadChat()` 호출
- Cold Storage에서 채팅 데이터 로드
- 로드 중에는 "Loading chat data..." 메시지 표시

### 5.3 Chat 컴포넌트 렌더링

**위치**: `src/lib/ChatScreens/Chat.svelte`

**주요 Props**:
- `message`: 인사말 텍스트
- `name`: 캐릭터 이름
- `img`: 캐릭터 이미지
- `role`: 'char' (캐릭터 메시지)
- `firstMessage`: true (인사말 플래그)
- `largePortrait`: 큰 포트레이트 표시 여부

**렌더링 내용**:
- 캐릭터 이미지
- 인사말 텍스트 (마크다운 파싱)
- 대체 인사말 스와이프 기능 (있는 경우)
- Reroll 버튼 (대체 인사말이 있는 경우)

---

## 6. 채팅창 렌더링

### 6.1 Chats 컴포넌트

**위치**: `src/lib/ChatScreens/Chats.svelte`

**주요 기능**:
- 메시지 목록 렌더링
- 가상 스크롤링 (성능 최적화)
- 메시지 지연 로딩 (`loadPages`)
- 동적 컴포넌트 마운트/언마운트
- 해시 기반 메시지 추적 (중복 렌더링 방지)

**렌더링 방식**:
- `mount()` API를 사용한 동적 컴포넌트 생성
- 각 메시지마다 `Chat` 컴포넌트 마운트
- 메시지 해시를 사용하여 변경 감지
- 불필요한 컴포넌트 자동 언마운트

### 6.2 메시지 렌더링

**위치**: `src/lib/ChatScreens/DefaultChatScreen.svelte`

**메시지 목록**:
```svelte
<Chats
    bind:instance={chatsInstance}
    messages={currentChat.slice(0, loadPages)}
    ...
/>
```

**렌더링 조건**:
- `loadPages`: 초기 로드 페이지 수 (기본 30)
- 스크롤 시 추가 메시지 로드
- 가상 스크롤링으로 성능 최적화

### 6.3 이미지 및 에셋 렌더링

**이미지 표시**:
- 캐릭터 이미지: `getCharImage(character.image, 'css')`
  - `getFileSrc(loc)`: 에셋 ID를 URL로 변환
  - CSS 배경 이미지로 표시
- 에셋 이미지: 에셋 ID를 통해 로드
- Emotion 이미지: `emotionImages` 배열에서 선택
- 사용자 아이콘: `getUserIcon()` 또는 `getUserIconProtrait()`

**에셋 처리**:
- 에셋 ID만 관리 (서버 사이드)
- 클라이언트에서 실제 이미지 로드 및 표시
- 에셋 서비스를 통한 URL 생성
- `hideAllImages` 설정 시 이미지 숨김 처리

---

## 7. 주요 Store 및 상태 관리

### 7.1 핵심 Store

**위치**: `src/ts/stores.svelte.ts`

```typescript
// 로드 상태
export const loadedStore = writable(false)

// 선택된 캐릭터 ID
export const selectedCharID = writable(-1)

// 데이터베이스 상태
export const DBState = writable<{ db: Database }>({ db: null })

// 채팅 진행 상태
export const doingChat = writable(false)

// UI 상태
export const settingsOpen = writable(false)
export const sideBarStore = writable(0)
export const MobileGUI = writable(false)
```

### 7.2 반응형 업데이트

**Svelte 5 Runes 사용**:
```typescript
// $derived: 파생 상태
let currentCharacter = $derived(
    DBState.db.characters[$selectedCharID]
)

// $effect: 사이드 이펙트
$effect(() => {
    if (ScrollToMessageStore.value !== -1) {
        scrollToMessage(ScrollToMessageStore.value)
    }
})
```

---

## 8. 상세 흐름: 캐릭터 선택부터 인사말 표시까지

### 8.1 사용자가 캐릭터 클릭

```
사용자 클릭 (Sidebar.svelte)
  ↓
changeChar(char.index, { reseter })
  ↓
characterFormatUpdate(index, { updateInteraction: true })
  ├─ 캐릭터 데이터 검증
  ├─ 기본값 설정
  └─ lastInteraction 업데이트
  ↓
selectedCharID.set(index)
  ↓
App.svelte 반응형 업데이트
  ├─ $selectedCharID 변경 감지
  └─ ChatScreen 컴포넌트 렌더링
  ↓
DefaultChatScreen.svelte 렌더링
  ├─ currentCharacter = $derived(...)
  ├─ currentChat = $derived(...)
  └─ chatPage 확인
  ↓
인사말 표시 조건 체크
  ├─ message.length <= loadPages?
  └─ type !== 'group'?
  ↓
Chat 컴포넌트 렌더링
  ├─ firstMessage 또는 alternateGreetings[fmIndex]
  ├─ 캐릭터 이미지
  └─ 인사말 텍스트
```

### 8.2 채팅 선택 시

```
사용자가 채팅 목록에서 채팅 선택
  ↓
changeChatTo(chatId 또는 index)
  ↓
DBState.db.characters[selectedCharID].chatPage = index
  ↓
ReloadGUIPointer.set(Math.random())  // UI 강제 리렌더링
  ↓
DefaultChatScreen.svelte 반응형 업데이트
  ├─ currentChat = $derived(...)  // 새 채팅 메시지
  └─ chatPage 변경 감지
  ↓
인사말 표시 조건 재확인
  ├─ message.length === 0? → 인사말 표시
  └─ message.length > 0? → 기존 메시지 표시
```

---

## 9. 데이터 구조

### 9.1 Database 구조

```typescript
interface Database {
    characters: (character | groupChat)[]
    // ... 기타 필드
}

interface character {
    chaId: string                    // 캐릭터 고유 ID
    name: string                     // 캐릭터 이름
    image: string                    // 이미지 경로
    firstMessage: string             // 기본 인사말
    alternateGreetings: string[]     // 대체 인사말 배열
    chats: Chat[]                    // 채팅 목록
    chatPage: number                 // 현재 선택된 채팅 인덱스
    // ... 기타 필드
}

interface Chat {
    id: string                       // 채팅 고유 ID
    message: Message[]                // 메시지 배열
    fmIndex: number                  // 선택된 인사말 인덱스 (-1: 기본)
    // ... 기타 필드
}
```

### 9.2 Store 구조

```typescript
// 선택된 캐릭터 인덱스
selectedCharID: -1 | number

// 데이터베이스 상태
DBState: {
    db: Database
}

// 로드 상태
loadedStore: boolean
```

---

## 10. 주요 함수 및 컴포넌트

### 10.1 초기화 함수

| 함수 | 위치 | 기능 |
|------|------|------|
| `loadData()` | `src/ts/bootstrap.ts` | 전체 데이터 초기화 |
| `checkNewFormat()` | `src/ts/bootstrap.ts` | 데이터 포맷 마이그레이션 |
| `assignIds()` | `src/ts/bootstrap.ts` | ID 할당 |
| `pargeChunks()` | `src/ts/bootstrap.ts` | 불필요한 파일 정리 |

### 10.2 캐릭터 관련 함수

| 함수 | 위치 | 기능 |
|------|------|------|
| `changeChar()` | `src/ts/characters.ts` | 캐릭터 선택 |
| `characterFormatUpdate()` | `src/ts/characters.ts` | 캐릭터 포맷 업데이트 |
| `getCharImage()` | `src/ts/characters.ts` | 캐릭터 이미지 URL 가져오기 |

### 10.3 채팅 관련 함수

| 함수 | 위치 | 기능 |
|------|------|------|
| `changeChatTo()` | `src/ts/globalApi.svelte.ts` | 채팅 변경 |
| `createSimpleCharacter()` | `src/ts/stores.svelte.ts` | 간단한 캐릭터 객체 생성 |

### 10.4 주요 컴포넌트

| 컴포넌트 | 위치 | 기능 |
|----------|------|------|
| `App.svelte` | `src/App.svelte` | 메인 앱 컴포넌트 |
| `DefaultChatScreen.svelte` | `src/lib/ChatScreens/` | 기본 채팅 화면 |
| `Chat.svelte` | `src/lib/ChatScreens/` | 개별 메시지 컴포넌트 |
| `Chats.svelte` | `src/lib/ChatScreens/` | 메시지 목록 컴포넌트 |
| `Sidebar.svelte` | `src/lib/SideBars/` | 사이드바 (캐릭터 목록) |

---

## 11. 렌더링 최적화

### 11.1 지연 로딩 (Lazy Loading)

**메시지 지연 로딩**:
- 초기 로드: `loadPages = 30` (30개 메시지)
- 스크롤 시 추가 로드
- 가상 스크롤링으로 성능 최적화

### 11.2 반응형 업데이트

**Svelte 5 Runes**:
- `$derived`: 파생 상태 (자동 재계산)
- `$effect`: 사이드 이펙트 (상태 변경 시 실행)
- `$state`: 반응형 상태

**예시**:
```typescript
let currentCharacter = $derived(
    DBState.db.characters[$selectedCharID]
)
// selectedCharID가 변경되면 자동으로 currentCharacter 업데이트
```

---

## 12. 이미지 및 에셋 처리

### 12.1 캐릭터 이미지

**로드 과정**:
```
character.image (에셋 ID)
  ↓
getCharImage(image, 'css')
  ↓
에셋 서비스에서 URL 생성
  ↓
<img src={url} />
```

### 12.2 에셋 관리

**서버 사이드**:
- 에셋 ID만 관리
- 에셋 서비스를 통한 URL 생성

**클라이언트 사이드**:
- 실제 이미지 로드 및 표시
- 이미지 최적화 (리사이징 등)

---

## 13. 인사말 처리 상세

### 13.1 인사말 타입

1. **기본 인사말** (`firstMessage`):
   - 캐릭터의 기본 인사말
   - `chat.fmIndex === -1`일 때 사용

2. **대체 인사말** (`alternateGreetings`):
   - 여러 개의 대체 인사말
   - `chat.fmIndex >= 0`일 때 사용
   - 스와이프로 변경 가능

### 13.2 인사말 표시 조건

```typescript
// 인사말이 표시되는 조건
if (
    message.length <= loadPages &&  // 메시지가 적을 때
    character.type !== 'group'      // 그룹 채팅이 아닐 때
) {
    // 인사말 표시
    const greeting = chat.fmIndex === -1
        ? character.firstMessage
        : character.alternateGreetings[chat.fmIndex]
}
```

### 13.3 인사말 Reroll

**기능**:
- 대체 인사말이 있는 경우 Reroll 버튼 표시
- 다음/이전 인사말로 변경
- `chat.fmIndex` 업데이트

---

## 14. 채팅창 렌더링 상세

### 14.1 메시지 목록 구조

```
Chats 컴포넌트
  ├─ 인사말 (message.length === 0일 때)
  ├─ 메시지 목록 (message.slice(0, loadPages))
  │   ├─ Chat 컴포넌트 (각 메시지)
  │   ├─ 이미지 렌더링
  │   ├─ 텍스트 파싱 (마크다운, CBS 등)
  │   └─ 에셋 렌더링
  └─ 스크롤 처리
```

### 14.2 메시지 렌더링

**Chat 컴포넌트 Props**:
- `message`: 메시지 텍스트
- `name`: 발신자 이름
- `img`: 발신자 이미지
- `role`: 'user' | 'char'
- `idx`: 메시지 인덱스
- `firstMessage`: 인사말 여부

**렌더링 내용**:
- 발신자 아바타
- 메시지 텍스트 (파싱된)
- 에셋 (이미지, 비디오 등)
- 메타데이터 (시간, 생성 정보 등)

---

## 15. 상태 동기화

### 15.1 Store 구독

**자동 업데이트**:
```typescript
// selectedCharID 변경 시
selectedCharID.subscribe((index) => {
    // UI 자동 업데이트
    // DefaultChatScreen 재렌더링
})

// DBState 변경 시
DBState.subscribe((state) => {
    // 데이터베이스 상태 변경 감지
    // 필요한 경우 UI 업데이트
})
```

### 15.2 강제 리렌더링

**ReloadGUIPointer**:
```typescript
ReloadGUIPointer.set(Math.random())
// UI 강제 리렌더링 트리거
```

---

## 16. 에러 처리

### 16.1 초기화 에러

**처리 방식**:
- `loadData()`에서 try-catch로 에러 처리
- 에러 발생 시 `alertError()` 표시
- 백업 파일 복원 시도

### 16.2 데이터 무결성

**검증 단계**:
- `checkNewFormat()`: 포맷 검증 및 마이그레이션
- `assignIds()`: ID 중복 체크 및 재할당
- 기본값 설정으로 누락된 필드 보완

---

## 17. 성능 최적화

### 17.1 지연 로딩

- 메시지 지연 로딩 (`loadPages`)
- 이미지 지연 로딩
- 컴포넌트 지연 로딩

### 17.2 가상 스크롤링

- `Chats.svelte`에서 가상 스크롤링 구현
- 화면에 보이는 메시지만 렌더링
- 스크롤 시 추가 메시지 로드

### 17.3 메모이제이션

- Svelte 5의 `$derived`로 자동 메모이제이션
- 불필요한 재계산 방지

---

## 18. 플랫폼별 차이점

### 18.1 Tauri (데스크톱)

- 파일 시스템 기반 저장
- 네이티브 API 사용
- 전체화면 모드 지원

### 18.2 웹

- LocalForage 기반 저장
- Service Worker 지원
- 브라우저 API 사용

### 18.3 모바일 (Capacitor)

- 네이티브 스토리지 사용
- 제스처 지원
- 모바일 GUI 모드

---

## 📝 요약

### 초기화 단계

1. **main.ts**: 애플리케이션 시작
2. **bootstrap.ts**: 데이터 로드 및 초기화
3. **App.svelte**: 메인 UI 렌더링

### 캐릭터 선택 단계

1. **Sidebar**: 캐릭터 목록 표시
2. **changeChar()**: 캐릭터 선택 처리
3. **characterFormatUpdate()**: 캐릭터 데이터 업데이트
4. **selectedCharID**: Store 업데이트

### 채팅 선택 및 렌더링 단계

1. **chatPage**: 현재 채팅 인덱스 확인
2. **인사말 표시**: 메시지가 없으면 인사말 표시
3. **Chat 컴포넌트**: 인사말 렌더링
4. **Chats 컴포넌트**: 메시지 목록 렌더링

### 주요 특징

- **반응형 업데이트**: Svelte 5 Runes 사용
- **지연 로딩**: 성능 최적화
- **에셋 관리**: 서버는 ID만, 클라이언트는 실제 렌더링
- **플랫폼별 최적화**: 환경에 따른 다른 처리

---

**마지막 업데이트**: 2026년 1월
