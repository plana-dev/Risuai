# RisuAI `src/` 구현 분석 문서 (코드 미포함)

본 문서는 `c:\Works\ReLuv\RisuAI\src\` 폴더의 **실제 구현 코드**를 기반으로 작성했습니다.  
요청 조건에 따라 **구현 코드는 포함하지 않으며**, 코드에 근거하지 않은 **추측/상상 설명은 배제**합니다.

---

## 1) 프로젝트 개요

이 `src/` 프로젝트는 Svelte 기반 UI를 중심으로, 로컬/웹/네이티브(tauri, capacitor) 환경을 고려한 런타임 분기와 공통 데이터/프로세스 레이어를 갖습니다.

- **UI 레이어**: `App.svelte`가 최상위 화면 분기, `lib/` 하위 컴포넌트들이 채팅/사이드바/설정/플레이그라운드/기타 모달을 구성합니다.
- **상태/도메인 레이어**: `ts/`에 DB/스토어, 채팅 생성 파이프라인, 플러그인/모듈, 번역/TTS, 동기화/드라이브/업데이트 등이 구현되어 있습니다.
- **다중 런타임 지원**: 웹(일반 브라우저), tauri(데스크톱), capacitor(네이티브), `__NODE__` 플래그 기반 NodeServer 모드가 코드 상에서 분기 처리됩니다.

---

## 2) 주요 디렉터리/파일 역할

### 2.1 엔트리포인트

- `main.ts`
  - 폴리필/DB 모듈 선로딩 후, `App.svelte`를 DOM에 마운트합니다.
  - 데이터 초기화(`loadData`) 및 핫키 초기화(`initHotkey`)를 시작합니다.
  - 테스트 훅(`declareTest`) 호출 및 프리로딩 DOM 제거를 수행합니다.
- `preload.ts`
  - 실행 환경(tauri/node/capacitor/web) 감지 후, 로컬스토리지 플래그(`mainpage`) 설정 및 웹 환경에서 `beforeunload` 방지 이벤트를 설정합니다.
- `App.svelte`
  - 앱의 최상위 화면 분기(로딩/첫 설정/설정/모바일 UI/기본 채팅 UI)와 전역 오버레이(알림/모달)를 담당합니다.
- `LiteMain.svelte`
  - “Lite Test” UI로 보이는 별도 화면 구성(허브 목록 조회 및 캐릭터 다운로드/채팅 화면 진입)을 구현합니다.

### 2.2 UI 컴포넌트 (`lib/`)

- `lib/ChatScreens/*`
  - 채팅 화면(입력/메시지 렌더/리롤/첨부/번역 입력/스크린샷/메뉴 등) 및 테마/배경/비주얼노벨 모드 분기.
- `lib/SideBars/*`
  - 사이드바 네비게이션(홈/설정/캐릭터 그리드/플레이그라운드), 캐릭터 목록/폴더/정렬(드래그&드롭), 캐릭터 설정(봇메이커), 개발 도구 UI 등.
- `lib/Setting/*`
  - 설정 화면과 설정 페이지들.
- `lib/Playground/*`
  - 여러 실험/도구 페이지(정규식/번역/토크나이저/MCP 등).
- `lib/Others/*`
  - 알림 컴포넌트, 북마크/채팅 목록, 플러그인 경고 모달, 웰컴 화면, 저장 아이콘, Hypa 관련 모달/프로그레스 등.

### 2.3 핵심 로직 (`ts/`)

- `ts/stores.svelte.ts`
  - 전역 UI 상태(Svelte store + `$state` 기반), `DBState.db`(실제 데이터베이스 객체)를 포함합니다.
  - Custom CSS 주입(`CustomCSSStore` 구독으로 `<style id="customcss">` 삽입/갱신) 같은 DOM 반영도 수행합니다.
- `ts/storage/*`
  - DB 타입/기본값 세팅, 저장/로드 포맷(압축 포함), 자동 스토리지 선택(브라우저/tauri/node/account/capacitor) 등을 구현합니다.
- `ts/process/*`
  - 채팅 생성 파이프라인(`sendChat`), 요청 레이어(모델별 request), 스크립트/트리거/모듈/파일(inlay) 등 실행 흐름이 구현되어 있습니다.
- `ts/plugins/*`
  - 플러그인 로딩 및 샌드박스/훅/프로바이더 등록을 구현합니다.
- `ts/translator/*`
  - 번역(일반 텍스트/HTML) 및 LLM 번역, 캐시 등을 구현합니다.
- `ts/sync/multiuser.ts`
  - PeerJS 기반 멀티유저 동기화(룸 생성/참가, 캐릭터/에셋/채팅 전송, 안전 체크)를 구현합니다.
- `ts/drive/*`
  - 구글 드라이브 백업/로드 플로우 및 파일 업/다운로드를 구현합니다.
- `ts/update.ts`
  - tauri 업데이트 체크/설치/재시작을 구현합니다.

---

## 3) 앱 부팅(Startup) 흐름

### 3.1 `main.ts` 기준 부팅 시퀀스

구현상 초기화는 아래 순서로 진행됩니다.

- **환경/스토리지 준비**
  - 폴리필/DB 모듈을 먼저 로드합니다(`ts/polyfill`, `ts/storage/database.svelte`).
  - `preLoadCheck()` 호출로 런타임 환경을 판별하고 웹 환경에서는 이탈 방지 핸들러를 설정합니다.
- **UI 마운트**
  - `App.svelte`를 `#app` 요소에 마운트합니다.
- **데이터 로드 및 런타임 기능 활성화**
  - `loadData()` 호출로 DB/파일/플러그인/상태 업데이트를 순차적으로 수행합니다.
  - `initHotkey()`로 전역 단축키 핸들러를 등록합니다.
  - `declareTest()` 호출(현재 구현은 비어 있음).
- **프리로딩 UI 제거**
  - `#preloading` 요소를 제거합니다.

### 3.2 `preload.ts`의 `preLoadCheck()`

- `window.__TAURI_INTERNALS__`, `globalThis.__NODE__`, `Capacitor.isNativePlatform()` 등을 이용해 환경을 감지합니다.
- 웹(특정 도메인 `risuai.xyz` + 비-tauri/비-node/비-capacitor)일 때:
  - `beforeunload` 이벤트를 등록하여 페이지 이탈을 방지하려는 동작을 수행합니다.
- 웹이 아니면 `localStorage.mainpage = 'visited'`로 기록합니다.
- URL 파라미터 `mainpage`가 있으면 그 값을 로컬스토리지에 기록합니다.

### 3.3 `ts/globalApi.svelte.ts`의 `loadData()` (핵심 초기화)

`loadData()`는 `loadedStore`가 아직 `false`일 때 한 번만 실행되도록 구성되어 있습니다. 주요 단계는 다음과 같습니다.

- **파일/디렉터리 준비(tauri)**
  - AppData 영역에 `database/`, `assets/` 디렉터리를 준비하고, DB 파일이 없으면 초기 DB 파일을 생성합니다.
- **스토리지/DB 로드 및 계정/동기화 체크**
  - 내부적으로 `AutoStorage` 기반 저장소를 사용합니다(환경별 저장소 선택).
  - 드라이브 OAuth 콜백(`checkDriverInit`) 처리를 우선 확인하고, 해당 플로우인 경우 함수가 조기 종료될 수 있습니다.
- **서비스 워커 등록(웹)**
  - 웹이고 native가 아닐 때 `registerSw()`를 통해 `/sw.js`를 등록하고 `/sw/init` 상태를 확인합니다.
- **URL 기반 Import 처리**
  - `didFirstSetup`가 완료된 경우 `characterURLImport()`로 쿼리/해시 기반 캐릭터/모듈/프리셋 import를 처리합니다.
- **불필요 파일 정리**
  - `pargeChunks()` 호출 시도(실패 시 콘솔 로깅).
- **플러그인 로딩**
  - `loadPlugins()`를 호출하여 플러그인 시스템을 초기화합니다.
- **계정 데이터 로딩**
  - DB에 `account`가 있으면 계정 관련 데이터를 로드합니다.
- **스토리지 영구화 요청(PWA/Standalone)**
  - standalone 모드 감지 시 `navigator.storage.persist()`를 시도합니다.
- **포맷/마이그레이션 및 UI 상태 반영**
  - `checkNewFormat()` 호출로 포맷 업데이트를 수행합니다.
  - `updateColorScheme()`, `updateTextThemeAndCSS()`, `updateAnimationSpeed()`, `updateGuisize()` 등 GUI 관련 반영을 수행합니다.
- **모바일/라이트 모드 전환**
  - 화면 너비/환경 변수에 따라 `MobileGUI`를 켜고 제스처 핸들러(`initMobileGesture`)를 설정합니다.
- **최종 로드 완료 처리**
  - `loadedStore = true`, `selectedCharID = -1`(홈 상태)로 설정합니다.
  - DOM 관찰/ID 할당/콜드데이터 구성/저장 루프/모듈 업데이트 등의 후속 초기화를 실행합니다.
  - TOS 표시 환경 변수(`VITE_RISU_TOS`)가 켜져 있으면 TOS 확인 알림을 띄웁니다.

---

## 4) 최상위 UI 분기(`App.svelte`)와 전역 오버레이

`App.svelte`는 전역 스토어 상태에 따라 화면을 다음과 같이 분기합니다.

- **특정 날짜 이벤트 화면**: 4월 1일에 별도의 화면 분기(aprilFools).
- **로딩 화면**: `$loadedStore`가 `false`이면 “Loading…” 및 `LoadingStatusState.text`를 표시합니다.
- **커스텀 GUI 설정 메뉴**: `$CustomGUISettingMenuStore`가 `true`이면 해당 메뉴 화면으로 전환합니다.
- **첫 설정(온보딩)**: DB의 `didFirstSetup`이 완료되지 않으면 `WelcomeRisu` 화면을 표시합니다.
- **설정 화면**: `$settingsOpen`이면 `Settings` 화면을 표시합니다.
- **모바일 UI**: `$MobileGUI`이면 `MobileHeader/Body/Footer`로 구성된 모바일 레이아웃을 표시합니다.
- **기본 UI**: 위 조건이 모두 아니면 사이드바(`Sidebar`) + 채팅 화면(`ChatScreen`) 조합을 표시합니다.
  - 중간에 `gridOpen`이 켜지면 캐릭터 그리드(`GridCatalog`)를 표시합니다.

전역 오버레이/모달은 조건부로 함께 표시됩니다.

- `AlertComp`(알림)
- Realm 팝업/프레임
- 프리셋/페르소나 리스트
- 북마크 목록
- Hypa V3 모달 및 진행 표시
- 저장 팝업 아이콘
- 플러그인 경고 모달

또한 `App.svelte`는 **드래그&드롭 파일 import**를 구현합니다.

- `<main>` 영역 `drop` 이벤트에서 파일을 받아 `importCharacterProcess({ name, data })`를 호출하고, 이후 `checkCharOrder()`로 캐릭터 정렬 상태를 정리합니다.

---

## 5) 사이드바(`lib/SideBars/Sidebar.svelte`) 동작

사이드바는 크게 두 축을 제공합니다.

### 5.1 네비게이션(홈/설정/캐릭터/플레이그라운드)

- 홈 버튼: `selectedCharID = -1`, `PlaygroundStore = 0` 등으로 리셋.
- 설정 버튼: `settingsOpen` 토글.
- 캐릭터 그리드 버튼: `openGrid()` 호출(상위에서 주입).
- 플레이그라운드 버튼: `PlaygroundStore`를 특정 값으로 설정.

### 5.2 캐릭터 목록/폴더/정렬 관리

- DB의 `characterOrder`를 기반으로 캐릭터 목록을 구성하며, 항목은 “캐릭터” 또는 “폴더(폴더 내부 캐릭터 목록)” 형태를 가질 수 있습니다.
- 드래그&드롭으로:
  - 캐릭터 이동/삽입(`inserter`)
  - 캐릭터를 폴더로 묶기(`createFolder`)
  - 폴더 열기/닫기(`openFolders`)
- 폴더 항목은 컨텍스트 메뉴를 통해 이름 변경/색상 변경/폴더 이미지 설정을 수행합니다.
- 동기화/검증:
  - 정렬 변경 후 `DBState.db.characterOrder` 갱신 및 `checkCharOrder()` 호출이 이루어집니다.

### 5.3 사이드 패널 내용

선택 상태/모드에 따라 오른쪽 패널에 다음이 표시됩니다.

- 선택 캐릭터 없음/설정 오픈: 환영 텍스트
- 플레이그라운드 캐릭터(`chaId === '§playground'`): 채팅 목록 패널(`SideChatList`)
- 멀티유저 연결 상태: 룸 ID/호스트·게스트 정보 표시
- 일반 채팅 상태:
  - 채팅 / 캐릭터(봇메이커) / 개발도구(옵션) 탭
  - QuickSettings가 열려 있으면 `QuickSettingsGUI` 표시

또한 `DynamicGUI` 환경에서는 사이드바 닫기 애니메이션 및 배경 오버레이 클릭으로 닫기가 구현되어 있습니다.

---

## 6) 채팅 화면(`lib/ChatScreens/ChatScreen.svelte`) 구조

`ChatScreen.svelte`는 테마/모드에 따라 채팅 레이아웃을 변경합니다.

- **비주얼노벨 모드**: `ShowVN`이 켜지면 `VisualNovelMain`을 표시합니다.
- **waifu / waifuMobile 테마**:
  - 배경 이미지(기본 또는 커스텀)를 적용합니다.
  - 캐릭터의 `viewScreen` 설정에 따라 감정 이미지(`TransitionImage`) 영역을 함께 구성합니다.
  - `DefaultChatScreen`은 반투명 배경/블러 등의 스타일로 감싸서 표시됩니다.
- **기본 테마**:
  - 배경 DOM(`BackgroundDom`)과 사이드바 화살표(`SideBarArrow`)가 기본적으로 깔립니다.
  - 특정 조건에서 `ResizeBox`로 viewScreen과 채팅 영역의 분할 크기를 조절합니다.

채팅 목록(`ChatList`)과 모듈 메뉴(`ModuleChatMenu`)는 `DefaultChatScreen`에서 제어하는 바인딩 값(`openChatList`, `openModuleList`)에 의해 별도 오버레이로 열립니다.

---

## 7) 채팅 입력/전송 UI(`lib/ChatScreens/DefaultChatScreen.svelte`)

`DefaultChatScreen`은 채팅 UX의 대부분을 구현합니다. 핵심 동작은 다음과 같습니다.

### 7.1 입력 처리

- 기본 입력은 텍스트 영역(`textarea`) 또는 고급 에디터(`AdvancedChatEditor`)로 수행합니다.
- `sendWithEnter` 설정에 따라 Enter/Shift+Enter 전송 규칙이 달라집니다.
- 입력이 `/`로 시작하면 `processMultiCommand()`로 명령 처리 시도를 합니다(처리되면 입력을 비우고 전송을 중단).
- 파일/에셋 입력:
  - 이미지 붙여넣기(paste)에서 이미지 파일을 감지하여 `postChatFile()`로 업로드/변환 후 inlay 형태로 입력에 반영합니다.
  - 메뉴의 “파일 올리기”에서도 동일하게 `postChatFile()`을 호출해 inlay/텍스트 삽입을 수행합니다.
  - `fileInput`에 모인 항목은 전송 직전에 `{{inlayed::...}}` 형식으로 입력에 합쳐집니다.
- 입력이 비어 있고 특정 조건을 만족하면(그룹이 아니고 `useSayNothing` 등) 사용자 메시지로 “*says nothing*”을 자동 추가합니다.
- 멀티유저 연결(`ConnectionOpenStore`) 시 메시지에 사용자 이름(`DBState.db.username`)을 함께 기록하는 동작이 존재합니다.

### 7.2 트리거/스크립트 연동(입력 시점)

캐릭터 타입이 `character`인 경우, 사용자 메시지를 채팅에 푸시하기 전에:

- `runTrigger(char, 'input', { chat })`가 호출되어 채팅 내용이 트리거 결과로 변경될 수 있습니다.
- 입력 텍스트는 `processScript(..., 'editinput')`를 통해 후처리된 값으로 저장됩니다.

### 7.3 전송/중단/리롤/자동 모드

- 전송은 `sendChat(-1, { signal, continue })` 호출로 이어집니다.
- 전송 중(`doingChat`)에는 전송 버튼 대신 취소 버튼이 표시되며, AbortController로 중단할 수 있습니다.
- 리롤/언리롤:
  - 직전 생성 결과를 재사용하는 프리리롤(`Prereroll`, `PreUnreroll`) 경로가 우선 시도됩니다.
  - 그렇지 않으면 메시지 스택을 되돌린 뒤 다시 `sendChat`을 호출해 재생성합니다.
- 그룹 채팅에서는 자동 모드(반복 전송) 기능이 구현되어 있습니다.

### 7.4 부가 기능 메뉴

열리는 메뉴 항목은 DB 옵션/캐릭터 타입에 따라 달라지며, 구현상 다음 기능들이 존재합니다.

- 응답 이어쓰기(continue response)
- 채팅 리스트 열기
- Hypa 메모리 모달 열기(V2/V3)
- 입력 자동 번역 토글(`useAutoTranslateInput`)
- 스크린샷 저장(채팅 DOM을 캔버스로 변환해 이미지 병합 후 저장)
- 파일 올리기(멀티센드)
- 자동 제안(auto suggestion) 토글
- 모듈 메뉴 열기
- (옵션) 사이드 메뉴 리롤 버튼
- (TTS 모드에 따라) TTS 중지

또한 “콜드 스토리지 헤더”로 시작하는 채팅의 경우 `preLoadChat()`로 지연 로드를 수행합니다.

---

## 8) 채팅 생성 파이프라인(`ts/process/index.svelte.ts`의 `sendChat`)

`sendChat()`은 UI에서 축적된 채팅 메시지를 바탕으로, 프롬프트 구성 → 요청 전송 → 스트리밍/후처리 → 트리거/자동 계속 등의 전 과정을 담당합니다.

### 8.1 입력 데이터 준비 및 토큰/프롬프트 구성

구현상 `sendChat()` 내부에서는 다음 요소들이 단계적으로 누적/조정됩니다.

- 캐릭터/채팅 선택 및 캐시 기반 캐릭터 조회(`findCharacterbyIdwithCache`)
- 예시 메시지(`exampleMessage`) 포함
- 모델 타입에 따라 시스템 메시지(`NewChat` 메모 포함) 삽입
- 그룹이 아닌 경우 캐릭터의 첫 인사/대체 인사(`firstMessage`/`alternateGreetings`)를 assistant 메시지로 포함하고, 필요 시 이름 프리픽스 추가
- `runTrigger(currentChar, 'start', { chat })` 트리거 실행:
  - 트리거가 채팅을 수정할 수 있으며, `stopSending`이 설정되면 전송을 중단합니다.
- 채팅 히스토리 메시지들을 순회하며 모델 요청 형식(OpenAIChat 등)으로 변환하고 토큰을 계산합니다.

### 8.2 요청 전송 및 스트리밍 처리

요청은 `ts/process/request/*` 계층을 통해 모델/프로바이더별로 전송됩니다(예: OpenAI, Ollama 등).

- 스트리밍 모드에서는 읽은 청크를 누적하고, 중간중간 결과를 채팅 메시지에 반영합니다.
- 출력 반영 시점에 `processScriptFull(..., 'editoutput', msgIndex)`가 호출되어:
  - 트리거(lua edit), 플러그인 훅, 템플릿/정규식 스크립트, 파서 치환 등이 적용된 텍스트가 저장됩니다.
- `removeIncompleteResponse` 옵션이 켜져 있으면 특정 규칙으로 결과를 절단하는 처리도 포함되어 있습니다.

### 8.3 출력 트리거 및 후속 처리

- 스트리밍 종료 후, `runTrigger(currentChar, 'output', { chat })`를 실행합니다.
  - 트리거 결과가 채팅을 교체할 수 있으며, `sendAIprompt` 플래그가 설정되면 재전송(`resendChat`)이 발생할 수 있습니다.
- inlay 처리(`runInlayScreen`)가 적용되어 메시지 텍스트가 최종 반영됩니다.
- 자동 continue:
  - 출력 토큰 수(`autoContinueMinTokens`) 및 문장 끝 구두점 검사(`autoContinueChat`) 조건에 따라 `sendChat()`을 재귀 호출하여 자동으로 이어서 생성할 수 있습니다.
- 감정 관련 후처리:
  - `igpPrompt`가 존재하면 별도 `requestChatData(..., 'emotion')` 호출 결과를 마지막 메시지에 덧붙이는 로직이 포함되어 있습니다.

### 8.4 단계 표시(UX)

`chatProcessStage` 스토어가 갱신되며, `DefaultChatScreen`에서 버튼 로더의 스타일로 단계가 표시됩니다.

---

## 9) 스크립트/트리거/모듈 시스템

### 9.1 스크립트 처리(`ts/process/scripts.ts`)

`processScriptFull()`은 텍스트를 다양한 훅/치환/정규식/에셋 매칭에 통과시키는 “출력/입력/표시 후처리 파이프라인”입니다.

구현 흐름(요약):

- Lua 기반 edit 트리거 실행(`runLuaEditTrigger`)
- `editdisplay` 모드에서는 `runTrigger(..., 'display', { displayMode: true })`로 표시 전용 트리거를 실행할 수 있음
- 플러그인 V2 훅(`pluginV2[mode]`) 적용(순차 실행)
- 템플릿 파서 치환(`risuChatParser`)
- 정규식 스크립트 세트 구성:
  - DB 프리셋 정규식(`presetRegex`)
  - 캐릭터 커스텀 스크립트(`char.customscript`)
  - 모듈 정규식(`getModuleRegexScripts()`)
- 캐시 키 기반 결과 캐싱(동일 입력 재처리 최소화)
- 동적 에셋 기능이 활성화된 경우, 텍스트 내 에셋 플레이스홀더를 유사도 검색으로 보정하는 처리도 포함됩니다.

### 9.2 트리거 시스템(`ts/process/triggers.ts`)

트리거는 캐릭터와 모듈에서 가져온 트리거가 합쳐져 실행됩니다.

- 트리거 타입: `start`, `manual`, `output`, `input`, `display`, `request`
- `runTrigger()`는:
  - `CurrentTriggerIdStore`를 갱신하여 실행 중 트리거 ID를 추적합니다(표시 모드 제외).
  - 기본 변수(캐릭터/DB 템플릿 변수) 및 로컬 변수 스코프를 사용합니다.
  - 조건을 평가한 뒤 effect를 순차 적용합니다.
  - 특정 effect는:
    - 전송 중단(`stop`/`v2StopPromptSending` → `stopSending = true`)
    - 트리거 재귀 호출(`runtrigger`)을 수행하며, 기본적으로 재귀 횟수 제한이 있습니다.
    - 채팅 수정(`cutchat`, `modifychat` 등)도 수행할 수 있습니다.
  - 결과로 채팅 변경/추가 시스템 프롬프트/전송 중단/재전송 플래그 등을 반환할 수 있습니다.

### 9.3 모듈 시스템(`ts/process/modules.ts`)

모듈은 DB/채팅/캐릭터/통합 문자열(`moduleIntergration`)에 의해 활성화 목록이 결정됩니다.

- `getModules()`
  - 활성 모듈 ID를 모아 실제 모듈 객체 목록으로 변환합니다.
  - 최근 ID 조합을 캐싱하여 중복 계산을 줄입니다.
- `moduleUpdate()`
  - 모듈의 `hideIcon`, `backgroundEmbedding` 등을 합쳐 UI 상태(`HideIconStore`, `moduleBackgroundEmbedding`)를 갱신합니다.
  - 모듈 ID 구성이 바뀌면 `ReloadGUIPointer`를 증가시켜 GUI 리로드를 유도합니다.
- `applyModule()`
  - 모듈의 lorebook/regex/trigger를 현재 캐릭터에 실제로 병합하는 적용 기능이 구현되어 있습니다(그룹 캐릭터는 제외).

---

## 10) 플러그인 시스템(`ts/plugins/*`)

### 10.1 로딩 흐름

- `loadPlugins()`는 DB의 플러그인 목록을 버전별로 분리합니다.
  - V2(2 또는 2.1)
  - V3(3.0)
- 이후 V2 플러그인 로드(`loadV2Plugin`)와 V3 플러그인 로드(`loadV3Plugins`)를 순차 실행합니다.

### 10.2 V2 플러그인 훅/프로바이더 구조

V2는 다음과 같은 훅 집합을 제공합니다.

- 편집 훅: `editdisplay`, `editoutput`, `editprocess`, `editinput`
- 리플레이서: `replacerbeforeRequest`, `replacerafterRequest`
- 프로바이더 등록: 모델 요청을 플러그인 제공자로 위임할 수 있는 구조
- 언로드 훅: 재로딩 시 기존 플러그인 정리

버전에 따라 로딩 방식이 다릅니다.

- 2.1:
  - 코드 안전성 체크(`checkCodeSafety`) 후 수정된 코드를 `new Function(...)()` 방식으로 실행합니다.
  - 플러그인에 제공되는 API는 `globalThis.__pluginApis__`로 주입됩니다.
- 2.0:
  - 스크립트를 `eval(...)`로 실행합니다.

### 10.3 V3 플러그인(샌드박스)

V3 플러그인은 iframe 기반으로 실행되며, 호스트/팩토리(`apiV3/*`)를 통해 샌드박스 환경과 통신하는 구조가 구현되어 있습니다.

---

## 11) 데이터 저장소/포맷/자동 스토리지

### 11.1 DB 타입과 전역 보관

- 전역 DB는 `ts/stores.svelte.ts`의 `DBState.db`에 보관됩니다.
- DB 타입은 `ts/storage/database.svelte.ts`의 `Database` 인터페이스로 정의되어 있으며:
  - 캐릭터/그룹챗, 프롬프트/모델 설정, 번역/TTS, 플러그인/모듈, UI 옵션, 계정/동기화, 통계 등 매우 많은 설정 필드를 포함합니다.
- `setDatabase()`는 DB 로딩 시 누락 필드에 기본값을 채우는 역할을 합니다(버전 호환/마이그레이션의 일환).

### 11.2 저장 포맷(`ts/storage/risuSave.ts`)

- `RisuSaveEncoder`는 DB를 블록 단위로 구성하여 저장할 수 있도록 구현되어 있습니다.
  - 루트, 프리셋, 모듈, 캐릭터(채팅 포함), 설정 블록 등으로 분리 인코딩합니다.
  - 압축 여부를 선택할 수 있습니다.
- 별도의 레거시/호환 인코딩(`encodeRisuSaveLegacy`) 및 디코딩(`decodeRisuSave`) 경로가 사용됩니다.

### 11.3 자동 스토리지 선택(`ts/storage/autoStorage.ts`)

`AutoStorage`는 실행 환경 및 계정/동기화 설정에 따라 실제 저장 백엔드를 선택합니다.

- 브라우저 기반(예: localforage)
- NodeServer 기반(NodeStorage)
- OPFS 기반(OpfsStorage)
- 계정 스토리지(AccountStorage)
- 모바일(Capacitor) 스토리지(MobileStorage)

이 선택은 `loadData()` 초기화 과정과 저장/로드 로직에서 사용됩니다.

---

## 12) 캐릭터/모듈/프리셋 Import/Export 및 Hub 연동

### 12.1 파일 Import (`ts/characterCards.ts`의 `importCharacterProcess`)

지원 경로가 구현되어 있습니다.

- JSON:
  - 스펙 카드(`importCharacterCardSpec`)로 시도
  - 오프스펙(필드 기반) 카드 변환(`convertOffSpecCards`) 처리
- PNG:
  - PNG 청크에서 `chara` 또는 `ccv3` 데이터를 읽고, `chara-ext-asset_*`로 포함된 에셋을 함께 로드합니다.
  - 특수 포맷 `rcc||rccv1`의 경우 무결성 체크/암호 여부 처리 후 복호화 import를 수행합니다.
- CharX/JPG/JPEG:
  - `CharXReader`를 통해 cardData 및 assets/moduleData를 읽고 import로 연결합니다.
- Import 후:
  - `db.statics.imports` 증가
  - 성공 시 `importedCharacter` 알림

### 12.2 URL/해시 기반 Import (`characterURLImport`)

구현상 아래 케이스가 존재합니다.

- 쿼리 `realm`, `charahub`
- 해시 `#import=...`, `#import_module=...`, `#import_preset=...`
- 서비스워커 공유 엔드포인트 `#share_character`, `#share_module`, `#share_preset`
- PWA `launchQueue`로 전달된 파일 처리
- tauri `tauriOpenedFiles` 및 deep link(`onOpenUrl`) 처리

### 12.3 Hub 목록/다운로드

- `getRisuHub()`는 검색/페이지/nsfw/sort를 받아 허브 카드 목록을 요청합니다(환경 정보 헤더 포함).
- `downloadRisuHub()`는 카드 다운로드 API를 통해:
  - PNG/zip/charx 콘텐츠 타입인 경우 파일 import로 바로 연결하거나,
  - JSON 응답(카드+이미지)인 경우 리소스를 받아 `importCharacterCardSpec`로 import합니다.
- import 이후 설정에 따라 방금 import한 캐릭터로 자동 이동할 수 있습니다(`goCharacterOnImport` 또는 `forceRedirect`).

### 12.4 Export

- `exportChar()`는 내보내기 옵션 선택 후 `exportCharacterCard()`를 호출하거나, Realm 공유 흐름으로 분기합니다.
- `exportCharacterCard()`는 v2/v3 스펙과 출력 타입(png/json/charx/charxJpeg)에 따라:
  - 카드 데이터 생성
  - 필요한 에셋을 임베드(청크 또는 data URI 또는 charx 파일 구조)
  - writer를 통해 최종 파일을 생성합니다.

---

## 13) 드라이브 백업/로드(`ts/drive/drive.ts`)

### 13.1 OAuth 진입 및 콜백 처리

- `checkDriver(type)`는 Google OAuth URL을 구성하고,
  - 웹에서는 `location.href`로 이동하거나,
  - 그 외 환경에서는 새 창/외부 브라우저 오픈 후 사용자 입력으로 auth code를 받는 흐름을 구현합니다.
- `checkDriverInit()`는 URL 파라미터의 `code`를 감지해 `/drive` 엔드포인트로 교환한 뒤:
  - `state`에 따라 backup/save/load 동작을 수행하거나
  - tauri용 토큰 표시 모드로 안내합니다.

### 13.2 백업(Upload)

- 백업 시작 전 서버(`hubURL`)의 `/backupcheck`로 DB 손상 여부를 검증합니다(손상 시 실패 처리).
- assets 업로드:
  - tauri: AppData의 `assets` 디렉터리를 읽어 업로드
  - 웹: localforage keys를 기반으로 업로드
- DB 업로드:
  - `encodeRisuSaveLegacy(..., 'compression')`로 DB를 인코딩하여 `*-database.risudat` 파일로 업로드합니다.

### 13.3 로드(Download)

- Drive appDataFolder에서 DB 후보(`*-database.risudat`)를 찾고 최신/선택 로드를 수행합니다.
- DB를 디코딩한 뒤 필요한 에셋 목록을 계산하여 Drive에서 내려받아 저장소(tauri 파일 또는 localforage)로 복구합니다.
- 완료 후:
  - tauri는 `relaunch()`로 재시작,
  - 웹은 `location.search` 초기화 후 리프레시 안내 상태로 전환합니다.

---

## 14) 멀티유저 동기화(`ts/sync/multiuser.ts`)

PeerJS를 사용해 룸을 만들거나 참가하는 기능이 구현되어 있습니다.

- 호스트(`createMultiuserRoom`)
  - 룸 ID를 생성하고, 연결된 피어에게 현재 선택 캐릭터(현재 채팅 1개만)와 필요한 에셋을 전송합니다.
  - 채팅 동기화 요청을 받아 DB에 반영하고 다른 피어들에게 브로드캐스트합니다.
  - “채팅 안전 체크” 요청을 중계하여, 동시에 생성 중(`doingChat`)인지 등을 고려한 안전 판단 결과를 합산합니다.
- 게스트(`joinMultiuserRoom`)
  - 룸 ID를 입력받아 접속하고, 호스트로부터 `receive-char`를 받아 임시 캐릭터(`chaId = '§temp'`)로 구성합니다.
  - 에셋 수신 시 로컬 저장(`saveImage`)합니다.
  - 채팅 수신 시 DB에 반영합니다.
- 동기화/안전 체크
  - `peerSync()`는 현재 채팅을 호스트/게스트 역할에 따라 전송합니다.
  - `peerSafeCheck()`는 동시 작업 충돌을 피하기 위한 체크로 구현되어 있습니다.
  - `peerRevertChat()`는 최신 동기화 채팅으로 되돌립니다.

---

## 15) 번역(`ts/translator/translator.ts`)

### 15.1 텍스트 번역

- `translate(text, reverse)`는 간단 캐시를 우선 적용하고, `runTranslator()`로 실제 번역을 수행합니다.
- `runTranslator()`는 입력을 줄 단위로 분해하면서, inlay/미디어 플레이스홀더로 보이는 줄을 번역에서 제외하는 분기 로직이 존재합니다.

### 15.2 번역 백엔드(구현된 선택지)

DB 설정(`translatorType` 등)에 따라 다음 구현 경로가 존재합니다.

- LLM 번역:
  - 번역 프롬프트를 `parseChatML`로 파싱하거나 system/user 메시지로 구성 후 `requestChatData(..., 'translate')`로 호출합니다.
  - localforage 기반 캐시(`LLMTranslateCache`)를 사용합니다.
- DeepL / DeepLX
- Bergamot(모듈 동적 import)
- Google translate(기본 `translate.googleapis.com` 또는 실험적 `translate.google.com/m` 경로)

### 15.3 HTML 번역

- DOM 파싱 후 텍스트 노드를 순회하면서 번역을 적용하는 구현이 존재합니다.
- 번역 후 `editdisplay` 스크립트를 재적용하거나, 번역 결과를 노드 치환으로 반영하는 경로가 포함되어 있습니다.
- 모듈/캐릭터 스크립트 중 `edittrans` 타입 정규식 스크립트를 적용하는 처리도 포함됩니다.

---

## 16) TTS(`ts/process/tts.ts`)

`sayTTS(character, text)`는 캐릭터별 TTS 모드에 따라 다양한 TTS 백엔드를 지원하도록 구현되어 있습니다.

구현된 모드 예:

- 브라우저 WebSpeech
- ElevenLabs
- VOICEVOX(일본어 변환 포함)
- OpenAI TTS API
- NovelAI 음성
- HuggingFace Inference API
- VITS
- GPT-SoVITS
- FishSpeech

`stopTTS()`는 AudioBufferSourceNode 중단 및 speechSynthesis 취소를 수행합니다.

---

## 17) 업데이트(`ts/update.ts`)

- `checkRisuUpdate()`는 capacitor 네이티브 환경에서는 동작하지 않도록 되어 있습니다.
- tauri의 updater 플러그인으로 업데이트를 확인(`check`)하고,
  - 새 버전이 있으면 사용자 확인 후 다운로드/설치,
  - 설치 후 `relaunch()`로 재시작합니다.

---

## 18) 핫키/도구성 기능(`ts/hotkey.ts`)

- 전역 `keydown` 이벤트를 구독하여 사용자 정의 핫키(또는 기본 핫키)를 해석합니다.
- 주요 액션 예:
  - 채팅 UI 버튼 클릭 기반 리롤/편집/삭제/전송/입력 포커스
  - 설정/홈/프리셋/페르소나 토글
  - SafeMode(커스텀 CSS 토글) 및 테마 CSS 업데이트
  - 프롬프트 미리보기: `sendChat(..., { previewPrompt: true })` 후 프롬프트 JSON을 알림으로 표시
  - 요청 로그 표시
  - 모바일 제스처(스와이프)로 스택/사이드바 이동

---

## 19) 보안/안전 관련 구현 포인트(코드 기반 관찰)

- 플러그인 V2.0은 `eval`로 실행되는 경로가 존재합니다.
- 플러그인 V2.1은 코드 안전성 체크 후 제한된 API를 제공하는 구조를 사용합니다.
- 캐릭터 카드/모듈 import 시 `lowLevelAccess`가 설정된 경우 사용자 확인을 요구하는 흐름이 구현되어 있습니다.

---

## 20) 문서 범위 밖(확인된 상태)

- `test/runTest.ts`의 `declareTest()`는 현재 구현이 비어 있어, 실제 테스트 로직/동작은 이 `src/` 스냅샷 기준으로는 확인되지 않습니다.

---

## 21) 빠른 인덱스(핵심 파일)

- 부팅/분기: `main.ts`, `preload.ts`, `App.svelte`, `LiteMain.svelte`
- 전역 상태: `ts/stores.svelte.ts`
- 초기화: `ts/globalApi.svelte.ts` (`loadData`)
- 채팅 UI: `lib/ChatScreens/DefaultChatScreen.svelte`, `lib/ChatScreens/ChatScreen.svelte`
- 채팅 파이프라인: `ts/process/index.svelte.ts` (`sendChat`)
- 스크립트/트리거/모듈: `ts/process/scripts.ts`, `ts/process/triggers.ts`, `ts/process/modules.ts`
- 플러그인: `ts/plugins/plugins.ts`, `ts/plugins/apiV3/*`
- 저장/포맷: `ts/storage/database.svelte.ts`, `ts/storage/risuSave.ts`, `ts/storage/autoStorage.ts`
- Import/Export/Hub: `ts/characterCards.ts`
- 드라이브: `ts/drive/drive.ts`
- 멀티유저: `ts/sync/multiuser.ts`
- 번역/TTS: `ts/translator/translator.ts`, `ts/process/tts.ts`
- 업데이트: `ts/update.ts`

