# Database 인터페이스 문서화 - 10부: 고급 설정 및 기타

## 고급 생성 설정

### `seperateParametersEnabled: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 분리된 파라미터 사용 여부입니다. 메모리, 감정, 번역 등 각 기능에 다른 파라미터를 사용할 수 있습니다.

### `seperateParameters: { memory: SeparateParameters, emotion: SeparateParameters, translate: SeparateParameters, otherAx: SeparateParameters }`
- **타입**: `{ memory: SeparateParameters, emotion: SeparateParameters, translate: SeparateParameters, otherAx: SeparateParameters }`
- **기본값**: `{ memory: {}, emotion: {}, translate: {}, otherAx: {} }`
- **설명**: 분리된 파라미터 설정입니다. 각 기능별로 temperature, top_p 등을 독립적으로 설정할 수 있습니다.

### `seperateModelsForAxModels: boolean`
- **타입**: `boolean`
- **설명**: Ax 모델에 분리된 모델 사용 여부입니다.

### `seperateModels: { memory: string, emotion: string, translate: string, otherAx: string }`
- **타입**: `{ memory: string, emotion: string, translate: string, otherAx: string }`
- **설명**: 분리된 모델 설정입니다. 각 기능에 다른 모델을 사용할 수 있습니다.

### `doNotChangeSeperateModels: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 분리된 모델 변경 금지 여부입니다. 프리셋 전환 시 분리된 모델을 유지합니다.

### `fallbackModels: { memory: string[], emotion: string[], translate: string[], otherAx: string[], model: string[] }`
- **타입**: `{ memory: string[], emotion: string[], translate: string[], otherAx: string[], model: string[] }`
- **기본값**: `{ memory: [], emotion: [], translate: [], otherAx: [], model: [] }`
- **설명**: 대체 모델 목록입니다. 기본 모델이 실패할 때 사용할 모델 목록입니다.

### `doNotChangeFallbackModels: boolean`
- **타입**: `boolean`
- **설명**: 대체 모델 변경 금지 여부입니다.

### `fallbackWhenBlankResponse: boolean`
- **타입**: `boolean`
- **설명**: 빈 응답 시 대체 모델 사용 여부입니다.

### `modelTools: string[]`
- **타입**: `string[]`
- **기본값**: `[]`
- **설명**: 모델 도구 목록입니다. 함수 호출, 도구 사용 등을 활성화합니다.

### `rememberToolUsage: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 도구 사용 기록 저장 여부입니다.

### `simplifiedToolUse: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 단순화된 도구 사용 여부입니다.

## 토크나이저 설정

### `customTokenizer: string`
- **타입**: `string`
- **기본값**: `'tik'`
- **설명**: 커스텀 토크나이저입니다. 'tik', 'claude' 등 다양한 토크나이저를 지원합니다.

### `useTokenizerCaching: boolean`
- **타입**: `boolean`
- **설명**: 토크나이저 캐싱 사용 여부입니다.

### `googleClaudeTokenizing: boolean`
- **타입**: `boolean`
- **설명**: Google Claude 토크나이징 사용 여부입니다.

## 고급 기능

### `useAdvancedEditor: boolean`
- **타입**: `boolean`
- **설명**: 고급 에디터 사용 여부입니다.

### `advancedBotSettings: boolean`
- **타입**: `boolean`
- **설명**: 고급 봇 설정 표시 여부입니다.

### `botSettingAtStart: false`
- **타입**: `false`
- **설명**: 시작 시 봇 설정 표시 여부입니다.

### `useLegacyGUI: boolean`
- **타입**: `boolean`
- **설명**: 레거시 GUI 사용 여부입니다.

### `cipherChat: boolean`
- **타입**: `boolean`
- **설명**: 암호화된 채팅 사용 여부입니다.

### `useStreaming: boolean`
- **타입**: `boolean`
- **설명**: 스트리밍 응답 사용 여부입니다.

### `autoContinueChat: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 자동 채팅 계속하기 여부입니다.

### `autoContinueMinTokens: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 자동 계속하기 최소 토큰 수입니다.

### `removeIncompleteResponse: boolean`
- **타입**: `boolean`
- **설명**: 불완전한 응답 제거 여부입니다.

### `dynamicOutput?: DynamicOutput`
- **타입**: `DynamicOutput` (선택적)
- **설명**: 동적 출력 설정입니다. 자동 스키마 조정, 동적 메시지, 동적 메모리 등을 포함합니다.

### `streamGeminiThoughts: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: Gemini 사고 과정 스트리밍 여부입니다.

## 그룹 채팅 설정

### `groupTemplate?: string`
- **타입**: `string` (선택적)
- **설명**: 그룹 채팅 템플릿입니다.

### `groupOtherBotRole?: 'user'|'assistant'`
- **타입**: `'user'|'assistant'` (선택적)
- **기본값**: `'user'`
- **설명**: 그룹 채팅에서 다른 봇의 역할입니다.

## 캐릭터 관리

### `characterOrder: (string|folder)[]`
- **타입**: `(string|folder)[]`
- **설명**: 캐릭터 순서입니다. 캐릭터 ID 또는 폴더 객체의 배열입니다.

### `banCharacterset: string[]`
- **타입**: `string[]`
- **기본값**: `[]`
- **설명**: 금지된 문자 집합입니다.

## 기타 설정

### `additionalParams: [string, string][]`
- **타입**: `[string, string][]`
- **기본값**: `[]`
- **설명**: 추가 파라미터 목록입니다. [키, 값] 형태의 튜플 배열입니다.

### `genTime: number`
- **타입**: `number`
- **기본값**: `1`
- **설명**: 생성 시간 배율입니다.

### `putUserOpen: boolean`
- **타입**: `boolean`
- **설명**: 사용자 열기 설정입니다.

### `useChatCopy: boolean`
- **타입**: `boolean`
- **설명**: 채팅 복사 기능 사용 여부입니다.

### `useChatSticker: boolean`
- **타입**: `boolean`
- **설명**: 채팅 스티커 사용 여부입니다.

### `useAdditionalAssetsPreview: boolean`
- **타입**: `boolean`
- **설명**: 추가 에셋 미리보기 사용 여부입니다.

### `goCharacterOnImport: boolean`
- **타입**: `boolean`
- **설명**: 임포트 시 캐릭터로 이동 여부입니다.

### `allowAllExtentionFiles?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 모든 확장 파일 허용 여부입니다.

### `legacyMediaFindings?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 레거시 미디어 찾기 사용 여부입니다.

### `lastPatchNoteCheckVersion?: string`
- **타입**: `string` (선택적)
- **설명**: 마지막 패치 노트 확인 버전입니다.

### `bulkEnabling: boolean`
- **타입**: `boolean`
- **설명**: 일괄 활성화 사용 여부입니다.

### `inlayErrorResponse: boolean`
- **타입**: `boolean`
- **설명**: 인레이 오류 응답 사용 여부입니다.

### `mancerHeader: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Mancer 헤더입니다.

### `hanuraiEnable: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: Hanurai 활성화 여부입니다.

### `hanuraiSplit: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: Hanurai 분할 사용 여부입니다.

### `hanuraiTokens: number`
- **타입**: `number`
- **기본값**: `1000`
- **설명**: Hanurai 토큰 수입니다.

### `tpo?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: TPO 기능 사용 여부입니다.

### `igpPrompt: string`
- **타입**: `string`
- **설명**: IGP 프롬프트입니다.

### `authRefreshes: { url: string, tokenUrl: string, refreshToken: string, clientId: string, clientSecret: string }[]`
- **타입**: `{ url: string, tokenUrl: string, refreshToken: string, clientId: string, clientSecret: string }[]`
- **기본값**: `[]`
- **설명**: 인증 갱신 설정 목록입니다. OAuth 토큰 자동 갱신에 사용됩니다.

### `hotkeys: Hotkey[]`
- **타입**: `Hotkey[]`
- **기본값**: `defaultHotkeys`
- **설명**: 단축키 설정 목록입니다.

### `statistics: { newYear2024?: { messages: number, chats: number } }`
- **타입**: `{ newYear2024?: { messages: number, chats: number } }`
- **기본값**: `{}`
- **설명**: 통계 정보입니다. 특정 이벤트나 기간의 통계를 저장합니다.
