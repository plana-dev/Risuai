# Database 인터페이스 문서화 - 1부: 기본 설정 및 캐릭터 관리

이 문서는 `src/ts/storage/database.svelte.ts`의 `Database` 인터페이스 필드 설명입니다.

## 기본 설정

### `characters: (character|groupChat)[]`
- **타입**: `(character|groupChat)[]`
- **기본값**: `[]`
- **설명**: 저장된 모든 캐릭터와 그룹 채팅 목록입니다. 각 항목은 개별 캐릭터 또는 그룹 채팅 객체입니다.

### `apiType: string`
- **타입**: `string`
- **기본값**: `'gpt35_0301'`
- **설명**: 사용할 API 타입을 지정합니다. OpenAI, Claude, NovelAI 등 다양한 API를 선택할 수 있습니다.

### `openAIKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: OpenAI API 키입니다. OpenAI API를 사용할 때 필요합니다.

### `proxyKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 프록시 서버를 통한 API 요청 시 사용하는 키입니다.

### `forceReplaceUrl: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: API 요청 URL을 강제로 대체할 때 사용하는 URL입니다.

### `forceReplaceUrl2: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: API 요청 URL을 강제로 대체할 때 사용하는 두 번째 URL입니다.

### `language: string`
- **타입**: `string`
- **기본값**: `'en'`
- **설명**: 애플리케이션의 언어 설정입니다. 'en', 'ko' 등 언어 코드를 사용합니다.

### `username: string`
- **타입**: `string`
- **기본값**: `'User'`
- **설명**: 사용자의 이름입니다. 채팅에서 사용자 역할을 나타냅니다.

### `userIcon: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 사용자의 아이콘 이미지 경로 또는 URL입니다.

### `userNote: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 사용자에 대한 추가 메모나 설명입니다.

### `requester: string`
- **타입**: `string`
- **기본값**: `"new"`
- **설명**: API 요청 방식을 지정합니다. 'new' 또는 다른 요청 방식을 선택할 수 있습니다.

### `formatversion: number`
- **타입**: `number`
- **설명**: 데이터베이스 포맷 버전을 나타냅니다. 마이그레이션 시 사용됩니다.

### `lastup: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: 마지막 업데이트 정보를 저장합니다.

### `didFirstSetup: boolean`
- **타입**: `boolean`
- **설명**: 첫 설정 완료 여부를 나타냅니다.

### `askRemoval: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 삭제 시 확인 메시지를 표시할지 여부입니다.

### `checkCorruption: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 데이터베이스 손상 검사를 수행할지 여부입니다.

### `statistics: { newYear2024?: { messages: number, chats: number } }`
- **타입**: `{ newYear2024?: { messages: number, chats: number } }`
- **기본값**: `{}`
- **설명**: 통계 정보를 저장합니다. 메시지 수, 채팅 수 등을 추적합니다.

### `statics: { messages: number, imports: number }`
- **타입**: `{ messages: number, imports: number }`
- **기본값**: `{ messages: 0, imports: 0 }`
- **설명**: 정적 통계 정보입니다. 메시지 수와 임포트 수를 저장합니다.

### `saveTime?: number`
- **타입**: `number` (선택적)
- **설명**: 마지막 저장 시간을 타임스탬프로 저장합니다.
