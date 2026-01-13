# Database 인터페이스 문서화 - 8부: 메모리 및 로어북 설정

## 로어북 설정

### `loreBook: { name: string, data: loreBook[] }[]`
- **타입**: `{ name: string, data: loreBook[] }[]`
- **기본값**: `[{ name: "My First LoreBook", data: [] }]`
- **설명**: 로어북 목록입니다. 각 로어북은 이름과 로어북 데이터 배열을 포함합니다.

### `loreBookPage: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 현재 선택된 로어북의 인덱스입니다.

### `loreBookDepth: number`
- **타입**: `number`
- **기본값**: `5`
- **설명**: 로어북 검색 깊이입니다. 대화 기록에서 몇 개의 메시지까지 검색할지 지정합니다.

### `loreBookToken: number`
- **타입**: `number`
- **기본값**: `800`
- **설명**: 로어북에 할당할 최대 토큰 수입니다.

### `localActivationInGlobalLorebook: boolean`
- **타입**: `boolean`
- **설명**: 전역 로어북에서 로컬 활성화 사용 여부입니다.

## SupaMemory 설정

### `supaMemoryPrompt: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: SupaMemory 요약 프롬프트입니다. 대화를 요약할 때 사용하는 프롬프트입니다.

### `supaMemoryKey: string`
- **타입**: `string`
- **기본값**: `""`
- **설명**: SupaMemory API 키입니다.

### `supaModelType: string`
- **타입**: `string`
- **기본값**: `"none"`
- **설명**: SupaMemory 모델 타입입니다. 'none', 'openai', 'anthropic' 등이 가능합니다.

### `maxSupaChunkSize: number`
- **타입**: `number`
- **기본값**: `1200`
- **설명**: SupaMemory 최대 청크 크기입니다.

### `memoryLimitThickness?: number`
- **타입**: `number` (선택적)
- **기본값**: `1`
- **설명**: 메모리 제한 두께입니다. 메모리 사용량을 시각적으로 표시합니다.

## HypaMemory 설정

### `hypaMemory: boolean`
- **타입**: `boolean`
- **설명**: HypaMemory 사용 여부입니다.

### `hypav2: boolean`
- **타입**: `boolean`
- **설명**: HypaMemory V2 사용 여부입니다.

### `hypaV3: boolean`
- **타입**: `boolean`
- **설명**: HypaMemory V3 사용 여부입니다.

### `hypaMemoryKey: string`
- **타입**: `string`
- **기본값**: `""`
- **설명**: HypaMemory API 키입니다.

### `hypaModel: HypaModel`
- **타입**: `HypaModel`
- **기본값**: `'MiniLM'`
- **설명**: HypaMemory 모델입니다. 'MiniLM', 'multilingual' 등이 가능합니다.

### `hypaV3Settings: HypaV3Settings`
- **타입**: `HypaV3Settings`
- **설명**: HypaMemory V3 설정입니다. (레거시 필드)

### `hypaV3Presets: HypaV3Preset[]`
- **타입**: `HypaV3Preset[]`
- **기본값**: `[createHypaV3Preset("Default", ...)]`
- **설명**: HypaMemory V3 프리셋 목록입니다.

### `hypaV3PresetId: number`
- **타입**: `number`
- **기본값**: `0`
- **설명**: 현재 선택된 HypaMemory V3 프리셋의 인덱스입니다.

### `hypaAllocatedTokens: number`
- **타입**: `number`
- **기본값**: `3000`
- **설명**: HypaMemory에 할당할 토큰 수입니다.

### `hypaChunkSize: number`
- **타입**: `number`
- **기본값**: `3000`
- **설명**: HypaMemory 청크 크기입니다.

### `hypaCustomSettings: { url: string, key: string, model: string }`
- **타입**: `{ url: string, key: string, model: string }`
- **기본값**: `{ url: "", key: "", model: "" }`
- **설명**: HypaMemory 커스텀 설정입니다. 커스텀 서버를 사용할 때 설정합니다.

### `removePunctuationHypa?: boolean`
- **타입**: `boolean` (선택적)
- **기본값**: `true`
- **설명**: HypaMemory에서 구두점 제거 여부입니다.

## 메모리 알고리즘 설정

### `memoryAlgorithmType: string`
- **타입**: `string`
- **설명**: 메모리 알고리즘 타입입니다. 새로운 메모리 모듈/알고리즘을 활성화합니다.

### `automaticCachePoint: boolean`
- **타입**: `boolean`
- **설명**: 자동 캐시 포인트 생성 여부입니다.

### `chatCompression: boolean`
- **타입**: `boolean`
- **설명**: 채팅 압축 사용 여부입니다.
