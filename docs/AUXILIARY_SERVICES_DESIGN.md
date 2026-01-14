# 보조 기능 서버 사이드 설계 문서

## 개요

Phase 9에서 구현한 보조 기능들(이미지 생성, TTS, 파일 처리)의 서버 사이드 설계 및 구현 방안을 정리합니다.

## 1. 이미지 생성 (ComfyUI)

### 설계 방안

- **ComfyUI만 지원**: 사용자 요청에 따라 ComfyUI만 서버 사이드에서 지원
- **워크플로우 관리**: 데이터베이스에 워크플로우 템플릿 저장
- **비동기 처리**: 이미지 생성은 시간이 걸리므로 비동기로 처리하고 완료 대기

### 구현 위치

- `src/server/process/auxiliary/image-generation.ts`
- `generateImageWithComfyUI`: ComfyUI API 호출 및 이미지 생성
- `waitForComfyUIImage`: 이미지 생성 완료 대기
- `stableDiff`: 프롬프트 생성 후 이미지 생성

### 주요 기능

1. **워크플로우 처리**
   - Legacy 모드: 특정 노드에 직접 프롬프트 할당
   - 새 모드: 모든 노드에서 `{{risu_prompt}}`, `{{risu_neg}}` 치환
   - Seed 랜덤화

2. **이미지 생성 대기**
   - `/history` API를 주기적으로 폴링
   - 타임아웃 설정 (기본 300초)
   - 완료 시 `/view` API로 이미지 다운로드

3. **에러 처리**
   - API 에러 처리
   - 타임아웃 처리
   - 네트워크 에러 처리

## 2. TTS (Text-to-Speech)

### 설계 방안

**하이브리드 접근 방식**:

1. **서버에서 처리 가능한 TTS**:
   - ElevenLabs: API 호출 후 오디오 데이터 반환
   - VOICEVOX: 로컬/원격 서버 API 호출
   - VITS: 서버 사이드 transformers 사용

2. **클라이언트에서 처리해야 하는 TTS**:
   - Web Speech API: 브라우저 전용 API
   - 클라이언트 측 오디오 재생

### 구현 위치

- `src/server/process/auxiliary/tts.ts`
- `generateTTS`: 메인 TTS 생성 함수
- `generateElevenLabsTTS`: ElevenLabs API 호출
- `generateVoiceVoxTTS`: VOICEVOX API 호출
- `generateVITSTTS`: VITS TTS (TODO)

### 주요 기능

1. **ElevenLabs**
   - API 키 기반 인증
   - 오디오 데이터를 base64로 인코딩하여 반환
   - 클라이언트에서 재생 가능한 형식으로 제공

2. **VOICEVOX**
   - Audio Query 생성
   - Synthesis API 호출
   - 일본어 번역 지원 (TODO)

3. **에러 처리**
   - API 키 누락 처리
   - URL 설정 누락 처리
   - 네트워크 에러 처리

### 클라이언트 연동

서버에서 생성된 오디오 데이터는 다음과 같이 클라이언트로 전송:

```typescript
{
    success: true,
    audioData: "data:audio/mpeg;base64,...", // 또는
    audioUrl: "https://server.com/audio/12345" // 서버에 저장된 경우
}
```

클라이언트에서는 이 데이터를 받아 Audio API로 재생합니다.

## 3. 파일 처리

### 설계 방안

**서버-클라이언트 협업 방식**:

1. **파일 업로드**: 클라이언트 → 서버
   - 클라이언트에서 파일 선택
   - 서버로 파일 전송 (multipart/form-data)
   - 서버에서 처리 후 결과 반환

2. **Inlay 에셋**: 서버 저장소 사용
   - 이미지/오디오/비디오 파일을 서버에 저장
   - Redis 또는 데이터베이스에 메타데이터 저장
   - ID로 참조하여 사용

3. **Multisend**: 서버에서 파일 파싱
   - 클라이언트에서 파일 업로드
   - 서버에서 파일 형식에 따라 파싱
   - 메시지 생성 및 저장

### 구현 위치

- `src/server/process/auxiliary/file-processing.ts`
- `uploadInlayAsset`: Inlay 에셋 업로드
- `getInlayAsset`: Inlay 에셋 조회
- `processMultisendFile`: Multisend 파일 처리

### 주요 기능

1. **Inlay 에셋 관리**
   - 지원 형식: 이미지 (jpg, png, gif, webp, avif), 오디오 (wav, mp3, ogg, flac), 비디오 (webm, mp4, mkv)
   - Redis에 저장 (TTL: 24시간)
   - Base64 인코딩하여 저장

2. **Multisend 파일 처리**
   - PO 파일: 번역 파일 처리 (TODO)
   - TXT 파일: 줄 단위로 메시지 생성
   - CSV 파일: CSV 파싱 (TODO)
   - JSON 파일: JSON 구조에 따라 메시지 생성 (TODO)

3. **에러 처리**
   - 지원하지 않는 파일 형식 처리
   - 파일 파싱 에러 처리
   - 저장소 에러 처리

### Redis 저장 구조

```
inlay:{userId}:{assetId} -> {
    id: string,
    name: string,
    type: 'image' | 'audio' | 'video',
    data: string, // base64
    width?: number,
    height?: number,
    ext: string
}
```

TTL: 24시간

## 4. API 엔드포인트 설계 (제안)

### 이미지 생성

```
POST /api/image/generate
Body: {
    prompt: string,
    negativePrompt: string,
    characterId: string
}
Response: {
    success: boolean,
    image?: string, // base64
    error?: string
}
```

### TTS 생성

```
POST /api/tts/generate
Body: {
    text: string,
    characterId: string
}
Response: {
    success: boolean,
    audioData?: string, // base64
    audioUrl?: string,
    error?: string
}
```

### 파일 업로드

```
POST /api/file/upload
Content-Type: multipart/form-data
Body: {
    file: File,
    type: 'inlay' | 'multisend'
}
Response: {
    success: boolean,
    assetId?: string,
    data?: any,
    error?: string
}
```

### Inlay 에셋 조회

```
GET /api/inlay/{assetId}
Response: {
    id: string,
    name: string,
    type: 'image' | 'audio' | 'video',
    data: string, // base64
    ...
}
```

## 5. 클라이언트 연동 가이드

### TTS 사용

```typescript
// 서버에서 TTS 생성
const result = await generateTTS(character, text, database);

if (result.success && result.audioData) {
    // 클라이언트에서 재생
    const audio = new Audio(result.audioData);
    audio.play();
}
```

### 파일 업로드

```typescript
// 클라이언트에서 파일 선택
const file = event.target.files[0];
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'inlay');

// 서버로 업로드
const response = await fetch('/api/file/upload', {
    method: 'POST',
    body: formData
});

const result = await response.json();
if (result.success) {
    // assetId 사용
    const inlayTag = `{{inlay::${result.assetId}}}`;
}
```

## 6. TODO 및 향후 개선 사항

### 이미지 생성
- [ ] 워크플로우 템플릿 관리 UI
- [ ] 이미지 생성 진행 상황 실시간 업데이트 (WebSocket)
- [ ] 이미지 생성 큐 관리

### TTS
- [ ] VITS TTS 구현
- [ ] 일본어 번역 (translateVox) 서버 사이드 마이그레이션
- [ ] 오디오 캐싱 (동일 텍스트 재사용)

### 파일 처리
- [ ] PO 파일 파싱 완전 구현
- [ ] CSV 파일 파싱 구현
- [ ] JSON 파일 구조 정의 및 파싱
- [ ] 파일 크기 제한 및 검증
- [ ] 이미지 리사이징 및 최적화

### 인프라
- [ ] 파일 저장소 (S3, Supabase Storage 등) 통합
- [ ] Redis 대신 영구 저장소 사용 옵션
- [ ] 파일 압축 및 최적화

## 7. 보안 고려사항

1. **파일 업로드**
   - 파일 크기 제한
   - 파일 형식 검증
   - 악성 파일 스캔

2. **API 키 관리**
   - 환경 변수로 관리
   - 사용자별 API 키 지원 (선택사항)

3. **리소스 제한**
   - 동시 이미지 생성 수 제한
   - TTS 요청 수 제한
   - 파일 저장소 용량 관리
