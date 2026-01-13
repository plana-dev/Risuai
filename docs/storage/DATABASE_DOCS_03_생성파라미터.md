# Database 인터페이스 문서화 - 3부: 생성 파라미터 및 프롬프트 설정

## 생성 파라미터

### `temperature: number`
- **타입**: `number`
- **기본값**: `80` (0.8을 100배한 값)
- **설명**: 생성 온도입니다. 값이 높을수록 더 창의적인 응답을 생성합니다. 0-100 범위입니다.

### `maxContext: number`
- **타입**: `number`
- **기본값**: `4000`
- **설명**: 최대 컨텍스트 토큰 수입니다. 대화 기록에 포함할 수 있는 최대 토큰 수를 제한합니다.

### `maxResponse: number`
- **타입**: `number`
- **기본값**: `500`
- **설명**: 최대 응답 토큰 수입니다. AI가 생성할 수 있는 최대 토큰 수를 제한합니다.

### `frequencyPenalty: number`
- **타입**: `number`
- **기본값**: `70` (0.7을 100배한 값)
- **설명**: 빈도 페널티입니다. 반복되는 토큰에 대한 페널티를 적용합니다. 0-100 범위입니다.

### `PresensePenalty: number`
- **타입**: `number`
- **기본값**: `70` (0.7을 100배한 값)
- **설명**: 존재 페널티입니다. 이미 나타난 토큰에 대한 페널티를 적용합니다. 0-100 범위입니다.

### `top_p: number`
- **타입**: `number`
- **기본값**: `1`
- **설명**: Nucleus 샘플링 파라미터입니다. 확률 누적 합이 top_p에 도달할 때까지의 토큰만 고려합니다.

### `top_k: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: Top-k 샘플링 파라미터입니다. 상위 k개의 토큰만 고려합니다. 0이면 비활성화됩니다.

### `repetition_penalty: number`
- **타입**: `number`
- **기본값**: `1`
- **설명**: 반복 페널티입니다. 값이 1보다 크면 반복을 줄이고, 1보다 작으면 반복을 증가시킵니다.

### `min_p: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 최소 확률 임계값입니다. 이 값보다 낮은 확률의 토큰은 제외됩니다.

### `top_a: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: Top-a 샘플링 파라미터입니다. 특정 모델에서 사용됩니다.

### `generationSeed: number`
- **타입**: `number`
- **기본값**: `-1`
- **설명**: 생성 시드입니다. -1이면 랜덤, 특정 값이면 재현 가능한 결과를 생성합니다.

### `reasoningEffort: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 추론 노력 수준입니다. Claude의 o1 모델 등에서 사용됩니다.

### `thinkingTokens: number`
- **타입**: `number`
- **설명**: 사고 토큰 수입니다. 체인 오브 사고 추론에 사용됩니다.

### `verbosity: number`
- **타입**: `number`
- **기본값**: `1`
- **설명**: 상세도 수준입니다. 응답의 상세 정도를 조절합니다.

## 프롬프트 설정

### `mainPrompt: string`
- **타입**: `string`
- **기본값**: `defaultMainPrompt`
- **설명**: 메인 프롬프트입니다. AI의 기본 행동과 성격을 정의합니다.

### `jailbreak: string`
- **타입**: `string`
- **기본값**: `defaultJailbreak`
- **설명**: Jailbreak 프롬프트입니다. AI의 제약을 우회하거나 특정 행동을 유도하는 프롬프트입니다.

### `jailbreakToggle: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: Jailbreak 프롬프트 사용 여부입니다.

### `globalNote: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 전역 메모입니다. 모든 대화에 적용되는 추가 지시사항입니다.

### `additionalPrompt: string`
- **타입**: `string`
- **기본값**: `'The assistant must act as {{char}}. user is {{user}}.'`
- **설명**: 추가 프롬프트입니다. 메인 프롬프트에 추가되는 보조 지시사항입니다.

### `descriptionPrefix: string`
- **타입**: `string`
- **기본값**: `'description of {{char}}: '`
- **설명**: 캐릭터 설명 접두사입니다. 캐릭터 설명 앞에 붙는 텍스트입니다.

### `personaPrompt: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 페르소나 프롬프트입니다. 사용자의 페르소나를 정의합니다.

### `selectedPersona: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 선택된 페르소나의 인덱스입니다.

### `personas: { personaPrompt: string, name: string, icon: string, largePortrait?: boolean, id?: string, note?: string }[]`
- **타입**: `{ personaPrompt: string, name: string, icon: string, largePortrait?: boolean, id?: string, note?: string }[]`
- **기본값**: `[{ name: data.username, personaPrompt: "", icon: data.userIcon, note: data.userNote, largePortrait: false }]`
- **설명**: 페르소나 목록입니다. 여러 페르소나를 저장하고 전환할 수 있습니다.

### `personaNote: boolean`
- **타입**: `boolean`
- **설명**: 페르소나 노트 표시 여부입니다.

### `formatingOrder: FormatingOrderItem[]`
- **타입**: `FormatingOrderItem[]`
- **기본값**: `['main','description', 'personaPrompt','chats','lastChat','jailbreak','lorebook', 'globalNote', 'authorNote']`
- **설명**: 프롬프트 포맷팅 순서입니다. 각 요소가 프롬프트에 포함되는 순서를 정의합니다.

### `promptTemplate?: PromptItem[]`
- **타입**: `PromptItem[]` (선택적)
- **설명**: 프롬프트 템플릿입니다. 구조화된 프롬프트를 정의합니다.

### `customPromptTemplateToggle: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 커스텀 프롬프트 템플릿 토글입니다.

### `templateDefaultVariables: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 템플릿 기본 변수입니다.

### `globalChatVariables: {[key:string]:string}`
- **타입**: `{[key:string]:string}`
- **기본값**: `{}`
- **설명**: 전역 채팅 변수입니다. 모든 채팅에서 사용할 수 있는 변수를 저장합니다.

### `promptPreprocess: boolean`
- **타입**: `boolean`
- **설명**: 프롬프트 전처리 사용 여부입니다.

### `promptSettings: PromptSettings`
- **타입**: `PromptSettings`
- **기본값**: `{ assistantPrefill: '', postEndInnerFormat: '', sendChatAsSystem: false, sendName: false, utilOverride: false, customChainOfThought: false, maxThoughtTagDepth: -1 }`
- **설명**: 프롬프트 세부 설정입니다. 어시스턴트 프리필, 포맷팅 옵션 등을 포함합니다.

### `useInstructPrompt: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 인스트럭트 프롬프트 사용 여부입니다.

### `instructChatTemplate: string`
- **타입**: `string`
- **기본값**: `"chatml"`
- **설명**: 인스트럭트 채팅 템플릿입니다. ChatML, Alpaca 등 다양한 템플릿을 지원합니다.

### `JinjaTemplate: string`
- **타입**: `string`
- **설명**: Jinja 템플릿입니다. 템플릿 엔진을 사용한 프롬프트 포맷팅입니다.

### `chainOfThought?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 체인 오브 사고 추론 사용 여부입니다.

### `igpPrompt: string`
- **타입**: `string`
- **설명**: IGP 프롬프트입니다.

### `emotionPrompt: string`
- **타입**: `string`
- **기본값**: `""`
- **설명**: 감정 분석 프롬프트입니다. 캐릭터의 감정을 분석하는 데 사용됩니다.

### `emotionPrompt2: string`
- **타입**: `string`
- **기본값**: `""`
- **설명**: 두 번째 감정 분석 프롬프트입니다.

### `emotionProcesser: 'submodel'|'embedding'`
- **타입**: `'submodel'|'embedding'`
- **기본값**: `'submodel'`
- **설명**: 감정 처리 방식입니다. 서브모델 또는 임베딩을 사용합니다.

### `bias: [string, number][]`
- **타입**: `[string, number][]`
- **기본값**: `[]`
- **설명**: 토큰 바이어스 목록입니다. 특정 토큰의 생성 확률을 조절합니다.

### `useSayNothing: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: "아무 말도 하지 않음" 옵션 사용 여부입니다.

### `localStopStrings?: string[]`
- **타입**: `string[]` (선택적)
- **설명**: 로컬 중지 문자열 목록입니다. 생성이 이 문자열을 만나면 중지됩니다.

### `jsonSchemaEnabled: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: JSON 스키마 사용 여부입니다.

### `jsonSchema: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: JSON 스키마 정의입니다. 구조화된 출력을 강제합니다.

### `strictJsonSchema: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 엄격한 JSON 스키마 검증 사용 여부입니다.

### `extractJson: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: JSON 추출 패턴입니다.

### `customFlags: LLMFlags[]`
- **타입**: `LLMFlags[]`
- **기본값**: `[]`
- **설명**: 커스텀 플래그 목록입니다. 모델별 특수 옵션을 지정합니다.

### `enableCustomFlags: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 커스텀 플래그 사용 여부입니다.

### `OAIPrediction: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: OpenAI 예측 기능 설정입니다.

### `presetChain: string`
- **타입**: `string`
- **설명**: 프리셋 체인입니다. 여러 프리셋을 연결하여 사용합니다.

### `botPresets: botPreset[]`
- **타입**: `botPreset[]`
- **기본값**: `[defaultPreset]`
- **설명**: 봇 프리셋 목록입니다. 여러 설정을 저장하고 전환할 수 있습니다.

### `botPresetsId: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 현재 선택된 봇 프리셋의 인덱스입니다.

### `toggleConfirmRecommendedPreset: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 권장 프리셋 전환 시 확인 메시지 표시 여부입니다.

### `presetRegex: customscript[]`
- **타입**: `customscript[]`
- **기본값**: `[]`
- **설명**: 프리셋 정규식 스크립트 목록입니다.
