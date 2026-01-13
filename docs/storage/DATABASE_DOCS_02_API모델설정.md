# Database 인터페이스 문서화 - 2부: API 및 모델 설정

## API 설정

### `aiModel: string`
- **타입**: `string`
- **기본값**: `'gpt35_0301'`
- **설명**: 사용할 AI 모델을 지정합니다. OpenAI, Claude, NovelAI 등 다양한 모델을 선택할 수 있습니다.

### `subModel: string`
- **타입**: `string`
- **기본값**: `'gpt35_0301'`
- **설명**: 보조 모델을 지정합니다. 감정 분석, 번역 등 특정 작업에 사용됩니다.

### `proxyRequestModel: string`
- **타입**: `string`
- **설명**: 프록시를 통한 요청 시 사용할 모델입니다.

### `openrouterRequestModel: string`
- **타입**: `string`
- **기본값**: `'openai/gpt-3.5-turbo'`
- **설명**: OpenRouter를 통해 사용할 모델입니다.

### `openrouterKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: OpenRouter API 키입니다.

### `openrouterProvider: { order: string[], only: string[], ignore: string[] }`
- **타입**: `{ order: string[], only: string[], ignore: string[] }`
- **기본값**: `{ order: [], only: [], ignore: [] }`
- **설명**: OpenRouter 프로바이더 설정입니다. 사용 순서, 허용 목록, 제외 목록을 지정합니다.

### `openrouterFallback: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: OpenRouter 요청 실패 시 대체 모델을 사용할지 여부입니다.

### `openrouterMiddleOut: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: OpenRouter 미들아웃 기능 사용 여부입니다.

### `claudeAPIKey: string`
- **타입**: `string`
- **설명**: Claude API 키입니다.

### `claudeAws: boolean`
- **타입**: `boolean`
- **설명**: Claude AWS 사용 여부입니다.

### `claudeCachingExperimental: boolean`
- **타입**: `boolean`
- **설명**: Claude 실험적 캐싱 기능 사용 여부입니다.

### `claudeBatching: boolean`
- **타입**: `boolean`
- **설명**: Claude 배칭 기능 사용 여부입니다.

### `claude1HourCaching: boolean`
- **타입**: `boolean`
- **설명**: Claude 1시간 캐싱 기능 사용 여부입니다.

### `claudeRetrivalCaching: boolean`
- **타입**: `boolean`
- **설명**: Claude 검색 캐싱 기능 사용 여부입니다.

### `novelai: { token: string, model: string }`
- **타입**: `{ token: string, model: string }`
- **기본값**: `{ token: "", model: "clio-v1" }`
- **설명**: NovelAI 설정입니다. 토큰과 모델을 지정합니다.

### `novellistAPI: string`
- **타입**: `string`
- **설명**: NovelAI 리스트 API 엔드포인트입니다.

### `NAIsettings: NAISettings`
- **타입**: `NAISettings`
- **설명**: NovelAI 세부 설정입니다. 온도, 페널티 등 생성 파라미터를 포함합니다.

### `NAIadventure?: boolean`
- **타입**: `boolean` (선택적)
- **기본값**: `false`
- **설명**: NovelAI Adventure 모드 사용 여부입니다.

### `NAIappendName?: boolean`
- **타입**: `boolean` (선택적)
- **기본값**: `true`
- **설명**: NovelAI에서 이름을 자동으로 추가할지 여부입니다.

### `ollamaURL: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Ollama 서버 URL입니다.

### `ollamaModel: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Ollama에서 사용할 모델입니다.

### `koboldURL: string`
- **타입**: `string`
- **설명**: KoboldAI 서버 URL입니다.

### `textgenWebUIStreamURL: string`
- **타입**: `string`
- **기본값**: `'wss://localhost/api/'`
- **설명**: Text Generation WebUI 스트리밍 API URL입니다.

### `textgenWebUIBlockingURL: string`
- **타입**: `string`
- **기본값**: `'https://localhost/api/'`
- **설명**: Text Generation WebUI 블로킹 API URL입니다.

### `ooba: OobaSettings`
- **타입**: `OobaSettings`
- **설명**: Oobabooga 설정입니다. 온도, top_p, repetition_penalty 등 생성 파라미터를 포함합니다.

### `ainconfig: AINsettings`
- **타입**: `AINsettings`
- **설명**: AIN (AI Novel) 설정입니다.

### `hordeConfig: hordeConfig`
- **타입**: `hordeConfig`
- **기본값**: `{ apiKey: "", model: "", softPrompt: "" }`
- **설명**: AI Horde 설정입니다. API 키, 모델, 소프트 프롬프트를 포함합니다.

### `google: { accessToken: string, projectId: string }`
- **타입**: `{ accessToken: string, projectId: string }`
- **기본값**: `{ accessToken: '', projectId: '' }`
- **설명**: Google AI 설정입니다. 액세스 토큰과 프로젝트 ID를 포함합니다.

### `vertexPrivateKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Google Vertex AI 개인 키입니다.

### `vertexClientEmail: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Google Vertex AI 클라이언트 이메일입니다.

### `vertexAccessToken: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Google Vertex AI 액세스 토큰입니다.

### `vertexAccessTokenExpires: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: Google Vertex AI 액세스 토큰 만료 시간입니다.

### `vertexRegion: string`
- **타입**: `string`
- **기본값**: `'global'`
- **설명**: Google Vertex AI 리전입니다.

### `mistralKey?: string`
- **타입**: `string` (선택적)
- **설명**: Mistral AI API 키입니다.

### `huggingfaceKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Hugging Face API 키입니다.

### `cohereAPIKey: string`
- **타입**: `string`
- **설명**: Cohere API 키입니다.

### `ai21Key: string`
- **타입**: `string`
- **설명**: AI21 API 키입니다.

### `customModels: { id: string, internalId: string, url: string, format: LLMFormat, tokenizer: LLMTokenizer, key: string, name: string, params: string, flags: LLMFlags[] }[]`
- **타입**: `{ id: string, internalId: string, url: string, format: LLMFormat, tokenizer: LLMTokenizer, key: string, name: string, params: string, flags: LLMFlags[] }[]`
- **기본값**: `[]`
- **설명**: 사용자 정의 모델 목록입니다. 커스텀 API 엔드포인트를 사용할 때 설정합니다.

### `customProxyRequestModel: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 커스텀 프록시를 통한 요청 시 사용할 모델입니다.

### `forceProxyAsOpenAI?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 프록시를 OpenAI 형식으로 강제 변환할지 여부입니다.

### `customAPIFormat: LLMFormat`
- **타입**: `LLMFormat`
- **기본값**: `LLMFormat.OpenAICompatible`
- **설명**: 커스텀 API 포맷입니다. OpenAI 호환, Anthropic 등 다양한 포맷을 지원합니다.

### `systemContentReplacement: string`
- **타입**: `string`
- **기본값**: `'system: {{slot}}'`
- **설명**: 시스템 콘텐츠 대체 템플릿입니다.

### `systemRoleReplacement: 'user'|'assistant'`
- **타입**: `'user'|'assistant'`
- **기본값**: `'user'`
- **설명**: 시스템 역할을 대체할 역할입니다.

### `reverseProxyOobaMode: boolean`
- **타입**: `boolean`
- **설명**: 역방향 프록시 Ooba 모드 사용 여부입니다.

### `reverseProxyOobaArgs: OobaChatCompletionRequestParams`
- **타입**: `OobaChatCompletionRequestParams`
- **기본값**: `{ mode: 'instruct' }`
- **설명**: 역방향 프록시 Ooba 인자입니다.

### `autofillRequestUrl: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 요청 URL 자동 채우기 여부입니다.

### `requestmet: string`
- **타입**: `string`
- **기본값**: `'normal'`
- **설명**: 요청 메서드를 지정합니다.

### `requestproxy: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 요청 프록시 URL입니다.

### `requestLocation: string`
- **타입**: `string`
- **설명**: 요청 위치를 지정합니다.

### `requestRetrys: number`
- **타입**: `number`
- **기본값**: `2`
- **설명**: 요청 실패 시 재시도 횟수입니다.

### `timeOut: number`
- **타입**: `number`
- **기본값**: `120`
- **설명**: API 요청 타임아웃 시간(초)입니다.

### `usePlainFetch: boolean`
- **타입**: `boolean`
- **설명**: 일반 fetch API 사용 여부입니다.

### `useStreaming: boolean`
- **타입**: `boolean`
- **설명**: 스트리밍 응답 사용 여부입니다.

### `antiClaudeOverload: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: Claude 과부하 방지 기능 사용 여부입니다. (마이그레이션됨: `antiServerOverloads`로 변경)

### `antiServerOverloads: boolean`
- **타입**: `boolean`
- **설명**: 서버 과부하 방지 기능 사용 여부입니다.

### `newOAIHandle: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 새로운 OpenAI 핸들러 사용 여부입니다.

### `OaiCompAPIKeys: {[key:string]:string}`
- **타입**: `{[key:string]:string}`
- **기본값**: `{}`
- **설명**: OpenAI 호환 API 키 목록입니다. 여러 키를 관리할 수 있습니다.
