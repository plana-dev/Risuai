# Database 인터페이스 문서화 - 6부: TTS 및 음성 설정

## TTS 기본 설정

### `ttsAutoSpeech: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: TTS 자동 음성 재생 사용 여부입니다.

### `playMessage: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 메시지 재생 기능 사용 여부입니다.

## ElevenLabs 설정

### `elevenLabKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: ElevenLabs API 키입니다. ElevenLabs TTS 서비스를 사용할 때 필요합니다.

## VOICEVOX 설정

### `voicevoxUrl: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: VOICEVOX 서버 URL입니다. 로컬 또는 원격 VOICEVOX 서버를 지정합니다.

## Fish Speech 설정

### `fishSpeechKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Fish Speech API 키입니다.

## Hugging Face TTS 설정

### `huggingfaceKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Hugging Face API 키입니다. Hugging Face TTS 모델을 사용할 때 필요합니다.

## 기타 음성 설정

### `palmAPI: string`
- **타입**: `string`
- **설명**: Google PaLM API 키입니다.

### `useExperimental: boolean`
- **타입**: `boolean`
- **설명**: 실험적 기능 사용 여부입니다.

### `useExperimentalGoogleTranslator: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: 실험적 Google 번역기 사용 여부입니다.
