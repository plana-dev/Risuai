# Database 인터페이스 문서화 - 9부: 플러그인 및 확장 기능

## 플러그인 설정

### `plugins: RisuPlugin[]`
- **타입**: `RisuPlugin[]`
- **기본값**: `[]`
- **설명**: 설치된 플러그인 목록입니다. V1 플러그인을 포함합니다.

### `pluginV2: RisuPlugin[]`
- **타입**: `RisuPlugin[]`
- **설명**: V2 플러그인 목록입니다.

### `currentPluginProvider: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 현재 사용 중인 플러그인 프로바이더입니다.

### `officialplugins: { automark?: boolean, romanizer?: boolean, metrica?: boolean, oaiFix?: boolean, oaiFixEmdash?: boolean, oaiFixLetters?: boolean }`
- **타입**: `{ automark?: boolean, romanizer?: boolean, metrica?: boolean, oaiFix?: boolean, oaiFixEmdash?: boolean, oaiFixLetters?: boolean }`
- **기본값**: `{}`
- **설명**: 공식 플러그인 설정입니다. 자동 마킹, 로마자 변환, 메트리카, OpenAI 수정 등이 포함됩니다.

### `pluginCustomStorage: {[key:string]:any}`
- **타입**: `{[key:string]:any}`
- **설명**: 플러그인 커스텀 저장소입니다. 플러그인이 자체 데이터를 저장할 수 있습니다.

### `automark?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 자동 마킹 기능 사용 여부입니다.

## 모듈 설정

### `modules: RisuModule[]`
- **타입**: `RisuModule[]`
- **기본값**: `[]`
- **설명**: 설치된 모듈 목록입니다.

### `enabledModules: string[]`
- **타입**: `string[]`
- **기본값**: `[]`
- **설명**: 활성화된 모듈 ID 목록입니다.

### `moduleIntergration: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 모듈 통합 설정입니다.

## 스크립트 설정

### `globalscript: customscript[]`
- **타입**: `customscript[]`
- **기본값**: `[]`
- **설명**: 전역 스크립트 목록입니다. 모든 채팅에 적용되는 스크립트입니다.

### `presetRegex: customscript[]`
- **타입**: `customscript[]`
- **기본값**: `[]`
- **설명**: 프리셋 정규식 스크립트 목록입니다.

## 자동 제안 설정

### `useAutoSuggestions: boolean`
- **타입**: `boolean`
- **설명**: 자동 제안 기능 사용 여부입니다.

### `autoSuggestPrompt: string`
- **타입**: `string`
- **기본값**: `defaultAutoSuggestPrompt`
- **설명**: 자동 제안 프롬프트입니다. AI가 제안할 메시지를 생성하는 데 사용됩니다.

### `autoSuggestPrefix: string`
- **타입**: `string`
- **기본값**: `""`
- **설명**: 자동 제안 접두사입니다. 제안 메시지 앞에 붙는 텍스트입니다.

### `autoSuggestClean: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 자동 제안 정리 사용 여부입니다. 제안 메시지를 정리합니다.

## 계정 및 동기화

### `account?: { token: string, id: string, data: { refresh_token?: string, access_token?: string, expires_in?: number }, useSync?: boolean, kei?: boolean }`
- **타입**: `{ token: string, id: string, data: { refresh_token?: string, access_token?: string, expires_in?: number }, useSync?: boolean, kei?: boolean }` (선택적)
- **설명**: 계정 정보입니다. 토큰, ID, 동기화 설정 등을 포함합니다.

### `keiServerURL: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Kei 서버 URL입니다.

### `realmDirectOpen: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: Realm 직접 열기 여부입니다.

### `lightningRealmImport: boolean`
- **타입**: `boolean`
- **설명**: Lightning Realm 임포트 사용 여부입니다.

## Realm 설정

### `realmId?: string`
- **타입**: `string` (선택적)
- **설명**: Realm ID입니다. 캐릭터나 그룹 채팅이 Realm에서 가져온 경우 저장됩니다.

### `hubServerType?: string`
- **타입**: `string` (선택적)
- **설명**: Hub 서버 타입입니다.
