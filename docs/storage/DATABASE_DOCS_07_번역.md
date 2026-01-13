# Database 인터페이스 문서화 - 7부: 번역 설정

## 번역 기본 설정

### `translator: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 번역기 이름입니다. (레거시 필드)

### `translatorType: 'google'|'deepl'|'none'|'llm'|'deeplX'|'bergamot'`
- **타입**: `'google'|'deepl'|'none'|'llm'|'deeplX'|'bergamot'`
- **기본값**: `'google'`
- **설명**: 번역기 타입입니다. Google, DeepL, LLM, DeepLX, Bergamot 등을 지원합니다.

### `translatorInputLanguage?: string`
- **타입**: `string` (선택적)
- **기본값**: `'auto'`
- **설명**: 번역 입력 언어입니다. 'auto'는 자동 감지입니다.

### `autoTranslate: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 자동 번역 사용 여부입니다.

### `useAutoTranslateInput: boolean`
- **타입**: `boolean`
- **설명**: 입력 자동 번역 사용 여부입니다.

### `autoTranslateCachedOnly: boolean`
- **타입**: `boolean`
- **설명**: 캐시된 번역만 사용 여부입니다.

### `combineTranslation: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 번역 결합 사용 여부입니다.

### `htmlTranslation: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: HTML 번역 사용 여부입니다.

### `translateBeforeHTMLFormatting: boolean`
- **타입**: `boolean`
- **설명**: HTML 포맷팅 전 번역 여부입니다.

### `legacyTranslation: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 레거시 번역 방식 사용 여부입니다.

### `sourcemapTranslate: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 소스맵 번역 사용 여부입니다.

### `translatorPrompt: string`
- **타입**: `string`
- **설명**: 번역기 프롬프트입니다. LLM 번역기를 사용할 때 커스텀 프롬프트를 지정합니다.

### `translatorMaxResponse: number`
- **타입**: `number`
- **기본값**: `1000`
- **설명**: 번역 최대 응답 토큰 수입니다.

### `noWaitForTranslate: boolean`
- **타입**: `boolean`
- **설명**: 번역 대기 없이 진행 여부입니다.

## DeepL 설정

### `deeplOptions: { key: string, freeApi: boolean }`
- **타입**: `{ key: string, freeApi: boolean }`
- **기본값**: `{ key: '', freeApi: false }`
- **설명**: DeepL 설정입니다. API 키와 무료 API 사용 여부를 포함합니다.

## DeepLX 설정

### `deeplXOptions: { url: string, token: string }`
- **타입**: `{ url: string, token: string }`
- **기본값**: `{ url: '', token: '' }`
- **설명**: DeepLX 설정입니다. 서버 URL과 토큰을 포함합니다.
