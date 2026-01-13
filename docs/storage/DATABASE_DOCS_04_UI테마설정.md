# Database 인터페이스 문서화 - 4부: UI 및 테마 설정

## UI 설정

### `theme: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 테마 이름입니다. 애플리케이션의 색상 테마를 지정합니다.

### `colorScheme: ColorScheme`
- **타입**: `ColorScheme`
- **기본값**: `defaultColorScheme`
- **설명**: 색상 스키마 객체입니다. UI의 색상 구성을 정의합니다.

### `colorSchemeName: string`
- **타입**: `string`
- **기본값**: `'default'`
- **설명**: 색상 스키마 이름입니다.

### `zoomsize: number`
- **타입**: `number`
- **기본값**: `100`
- **설명**: 줌 크기입니다. UI 확대/축소 비율을 지정합니다 (퍼센트).

### `iconsize: number`
- **타입**: `number`
- **기본값**: `100`
- **설명**: 아이콘 크기입니다. 사이드바 아이콘의 크기를 지정합니다 (퍼센트).

### `waifuWidth: number`
- **타입**: `number`
- **기본값**: `100`
- **설명**: 와이푸(캐릭터 이미지) 너비입니다 (퍼센트).

### `waifuWidth2: number`
- **타입**: `number`
- **기본값**: `100`
- **설명**: 두 번째 와이푸 너비입니다 (퍼센트).

### `assetWidth: number`
- **타입**: `number`
- **기본값**: `-1`
- **설명**: 에셋 너비입니다. -1이면 자동 크기입니다.

### `animationSpeed: number`
- **타입**: `number`
- **기본값**: `0.4`
- **설명**: 애니메이션 속도입니다. 0-1 범위의 값입니다.

### `fullScreen: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 전체 화면 모드 사용 여부입니다.

### `customBackground: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 커스텀 배경 이미지 경로 또는 URL입니다.

### `textScreenColor?: string`
- **타입**: `string` (선택적)
- **설명**: 텍스트 화면 배경색입니다.

### `textBorder?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 텍스트 테두리 표시 여부입니다.

### `textScreenRounded?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 텍스트 화면 둥근 모서리 사용 여부입니다.

### `textScreenBorder?: string`
- **타입**: `string` (선택적)
- **설명**: 텍스트 화면 테두리 스타일입니다.

### `roundIcons: boolean`
- **타입**: `boolean`
- **설명**: 둥근 아이콘 사용 여부입니다.

### `classicMaxWidth: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 클래식 최대 너비 모드 사용 여부입니다.

### `heightMode: string`
- **타입**: `string`
- **기본값**: `'normal'`
- **설명**: 높이 모드입니다. 'normal', 'auto' 등 다양한 모드를 지원합니다.

### `textAreaSize: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 텍스트 영역 크기입니다. 0이면 자동 크기입니다.

### `sideBarSize: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 사이드바 크기입니다. 0이면 자동 크기입니다.

### `textAreaTextSize: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 텍스트 영역 텍스트 크기입니다.

### `menuSideBar: boolean`
- **타입**: `boolean`
- **설명**: 메뉴 사이드바 표시 여부입니다.

### `showMenuChatList?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 메뉴에 채팅 목록 표시 여부입니다.

### `sideMenuRerollButton?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 사이드 메뉴에 리롤 버튼 표시 여부입니다.

### `betaMobileGUI: boolean`
- **타입**: `boolean`
- **설명**: 베타 모바일 GUI 사용 여부입니다.

### `useLegacyGUI: boolean`
- **타입**: `boolean`
- **설명**: 레거시 GUI 사용 여부입니다.

### `customGUI: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 커스텀 GUI HTML입니다.

### `guiHTML: string`
- **타입**: `string`
- **설명**: GUI HTML 코드입니다.

### `customCSS: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 커스텀 CSS 코드입니다. UI 스타일을 커스터마이징합니다.

### `returnCSSError: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: CSS 오류 반환 여부입니다.

## 텍스트 테마 설정

### `textTheme: string`
- **타입**: `string`
- **기본값**: `"standard"`
- **설명**: 텍스트 테마입니다. 'standard', 'custom' 등 다양한 테마를 지원합니다.

### `customTextTheme: { FontColorStandard: string, FontColorBold: string, FontColorItalic: string, FontColorItalicBold: string, FontColorQuote1: string, FontColorQuote2: string }`
- **타입**: `{ FontColorStandard: string, FontColorBold: string, FontColorItalic: string, FontColorItalicBold: string, FontColorQuote1: string, FontColorQuote2: string }`
- **기본값**: `{ FontColorStandard: "#f8f8f2", FontColorBold: "#f8f8f2", FontColorItalic: "#8C8D93", FontColorItalicBold: "#8C8D93", FontColorQuote1: '#8BE9FD', FontColorQuote2: '#FFB86C' }`
- **설명**: 커스텀 텍스트 테마 색상입니다. 일반 텍스트, 굵은 텍스트, 기울임 텍스트, 인용구 등의 색상을 지정합니다.

### `font: string`
- **타입**: `string`
- **기본값**: `'default'`
- **설명**: 폰트 이름입니다. 'default' 또는 커스텀 폰트 이름을 지정합니다.

### `customFont: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 커스텀 폰트 경로 또는 이름입니다.

### `lineHeight: number`
- **타입**: `number`
- **기본값**: `1.25`
- **설명**: 줄 간격입니다. 텍스트의 가독성을 조절합니다.

### `customQuotes: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 커스텀 인용 부호 사용 여부입니다.

### `customQuotesData?: [string, string, string, string]`
- **타입**: `[string, string, string, string]` (선택적)
- **기본값**: `['"','"',''',''']`
- **설명**: 커스텀 인용 부호 데이터입니다. [여는 큰따옴표, 닫는 큰따옴표, 여는 작은따옴표, 닫는 작은따옴표] 순서입니다.

### `unformatQuotes: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 인용 부호 포맷팅 해제 여부입니다.

## 채팅 UI 설정

### `swipe: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 스와이프 제스처 사용 여부입니다. 메시지를 스와이프하여 삭제하거나 편집할 수 있습니다.

### `instantRemove: boolean`
- **타입**: `boolean`
- **설명**: 즉시 삭제 여부입니다. 확인 없이 바로 삭제합니다.

### `clickToEdit: boolean`
- **타입**: `boolean`
- **설명**: 클릭하여 편집 기능 사용 여부입니다.

### `sendWithEnter: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: Enter 키로 메시지 전송 여부입니다.

### `fixedChatTextarea: boolean`
- **타입**: `boolean`
- **설명**: 고정된 채팅 텍스트 영역 사용 여부입니다.

### `useChatCopy: boolean`
- **타입**: `boolean`
- **설명**: 채팅 복사 기능 사용 여부입니다.

### `useChatSticker: boolean`
- **타입**: `boolean`
- **설명**: 채팅 스티커 사용 여부입니다.

### `useAdditionalAssetsPreview: boolean`
- **타입**: `boolean`
- **설명**: 추가 에셋 미리보기 사용 여부입니다.

### `playMessage: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 메시지 재생 기능 사용 여부입니다.

### `playMessageOnTranslateEnd: boolean`
- **타입**: `boolean`
- **설명**: 번역 완료 후 메시지 재생 여부입니다.

### `showFirstMessagePages: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 첫 메시지 페이지 표시 여부입니다.

### `requestInfoInsideChat?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 채팅 내부에 요청 정보 표시 여부입니다.

### `promptInfoInsideChat: boolean`
- **타입**: `boolean`
- **설명**: 채팅 내부에 프롬프트 정보 표시 여부입니다. (웹에서는 false로 강제됨)

### `promptTextInfoInsideChat: boolean`
- **타입**: `boolean`
- **설명**: 채팅 내부에 프롬프트 텍스트 정보 표시 여부입니다.

### `showSavingIcon: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 저장 아이콘 표시 여부입니다.

### `showTranslationLoading: boolean`
- **타입**: `boolean`
- **설명**: 번역 로딩 표시 여부입니다.

### `showPromptComparison: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 프롬프트 비교 표시 여부입니다.

### `showUnrecommended: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 비권장 옵션 표시 여부입니다.

### `showMemoryLimit: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 메모리 제한 표시 여부입니다.

### `showMenuHypaMemoryModal: boolean`
- **타입**: `boolean`
- **설명**: 메뉴에 Hypa 메모리 모달 표시 여부입니다.

### `showDeprecatedTriggerV1: boolean`
- **타입**: `boolean`
- **설명**: 사용 중단된 트리거 V1 표시 여부입니다.

### `showDeprecatedTriggerV2: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 사용 중단된 트리거 V2 표시 여부입니다.

### `hideApiKey: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: API 키 숨김 여부입니다.

### `hideRealm: boolean`
- **타입**: `boolean`
- **설명**: Realm 숨김 여부입니다.

### `showFolderName: boolean`
- **타입**: `boolean`
- **설명**: 폴더 이름 표시 여부입니다.

### `notification: boolean`
- **타입**: `boolean`
- **설명**: 알림 표시 여부입니다.

### `logShare: boolean`
- **타입**: `boolean`
- **설명**: 로그 공유 기능 사용 여부입니다.

### `enableDevTools: boolean`
- **타입**: `boolean`
- **설명**: 개발자 도구 활성화 여부입니다.
