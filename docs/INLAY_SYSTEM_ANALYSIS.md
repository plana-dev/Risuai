# Inlay 처리 시스템 분석

**작성일**: 2026년 1월  
**기준**: `src/ts/process/inlayScreen.ts`, `src/ts/process/files/inlays.ts` 분석

---

## 📋 개요

**Inlay**는 채팅 메시지에 **이미지, 비디오, 오디오를 "인레이(삽입)"**하는 기능입니다. 이 기능은 **멀티모달 AI 모델**과 직접 연관되어 있으며, 이미지 임베딩(캡셔닝)도 함께 사용됩니다.

---

## 🎯 Inlay의 핵심 기능

### 1. 기본 개념

Inlay는 채팅 메시지에 미디어 콘텐츠를 삽입하는 시스템입니다:

- **이미지**: 채팅에 이미지를 삽입하여 멀티모달 모델에 전송
- **비디오**: 비디오 파일 삽입
- **오디오**: 오디오 파일 삽입

### 2. Inlay 태그 형식

```javascript
{{inlay::assetId}}          // 스타일 없는 인레이 (모델 요청에 포함 안 됨)
{{inlayed::assetId}}        // 스타일 있는 인레이 (모델 요청에 포함 안 됨)
{{inlayeddata::assetId}}    // 스타일 있는 인레이 (모델 요청에 포함됨)
```

---

## 🔄 Inlay 처리 흐름

### 1. Inlay Screen 처리 (`runInlayScreen`)

**코드 위치**: `src/ts/process/inlayScreen.ts`, `src/server/process/auxiliary/inlay-screen.ts`

#### 두 가지 모드

##### A) Emotion 모드 (`viewScreen === 'emotion'`)

**동작:**
- AI 응답에서 `<Emotion="감정명">` 태그를 감지
- `{{emotion::감정명}}` 형식으로 변환
- 감정 이미지를 표시하는 데 사용

**예시:**
```javascript
// AI 응답: "Hello! <Emotion="Happy">"
// 변환 후: "Hello! {{emotion::Happy}}"
```

##### B) ImgGen 모드 (`viewScreen === 'imggen'`)

**동작:**
1. AI 응답에서 `<ImgGen="프롬프트">` 또는 `{{ImgGen="프롬프트"}}` 태그 감지
2. `[Generating...]`으로 임시 교체 (사용자에게 표시)
3. **Stable Diffusion으로 이미지 생성** (`generateAIImage`)
4. 생성된 이미지를 **Inlay 에셋으로 저장** (`writeInlayImage`)
5. 원본 태그를 Inlay 태그로 교체

**예시:**
```javascript
// AI 응답: "Here's the scene: <ImgGen="a beautiful sunset">"
// 1단계: "Here's the scene: [Generating...]"
// 2단계: 이미지 생성 후
// 최종: "Here's the scene: {{inlayed::generated-image-id}}"
```

### 2. Inlay 에셋 저장 (`writeInlayImage`)

**코드 위치**: `src/ts/process/files/inlays.ts`, `src/server/process/auxiliary/file-processing.ts`

**처리 과정:**
1. 이미지 리사이징 (최대 1024x1024 픽셀)
2. PNG 형식으로 변환
3. LocalForage(클라이언트) 또는 Redis(서버)에 저장
4. 고유 ID 반환

**저장 형식:**
```typescript
{
    id: string,              // 고유 ID
    name: string,            // 파일명
    type: 'image' | 'video' | 'audio',
    data: string | Blob,     // Base64 또는 Blob
    ext: string,             // 확장자
    width?: number,          // 이미지 너비
    height?: number          // 이미지 높이
}
```

### 3. 멀티모달 변환

**코드 위치**: `src/ts/process/index.svelte.ts` (810-866줄)

**처리 흐름:**

```typescript
// 1. 메시지에서 Inlay 태그 추출
const inlays = extractInlayTags(formatedChat);

// 2. 각 Inlay 에셋을 가져오기
for (const inlay of inlays) {
    const inlayData = await getInlayAsset(inlayId);
    
    if (inlayData?.type === 'image') {
        // 3-A. 모델이 이미지 입력을 지원하는 경우
        if (modelInfo.flags.includes(LLMFlags.hasImageInput)) {
            multimodal.push({
                type: 'image',
                base64: inlayData.data,
                width: inlayData.width,
                height: inlayData.height
            });
        }
        // 3-B. 모델이 이미지 입력을 지원하지 않는 경우
        else {
            // 이미지 임베딩(캡셔닝) 사용
            const captionResult = await runImageEmbedding(inlayData.data);
            formatedChat += `[${captionResult[0].generated_text}]`;
        }
    }
    
    // 비디오/오디오 처리
    if (inlayData?.type === 'video' || inlayData?.type === 'audio') {
        multimodal.push({
            type: inlayData.type,
            base64: inlayData.data
        });
    }
}

// 4. OpenAIChat 객체에 multimodals 추가
const chat: OpenAIChat = {
    role: 'user',
    content: formatedChat,
    multimodals: multimodal  // 멀티모달 데이터
};
```

---

## 🔗 멀티모달과의 연관성

### 1. 멀티모달 변환

Inlay는 **멀티모달 AI 모델에 이미지를 전송하기 위한 핵심 메커니즘**입니다:

- Inlay 태그 → Inlay 에셋 조회 → `multimodals` 배열로 변환 → LLM API에 전송

### 2. 모델별 처리

#### 이미지 입력 지원 모델 (예: GPT-4 Vision, Claude 3)

```typescript
// multimodals 배열에 직접 포함
multimodals: [{
    type: 'image',
    base64: 'data:image/png;base64,...',
    width: 1024,
    height: 1024
}]
```

#### 이미지 입력 미지원 모델

```typescript
// 이미지 임베딩(캡셔닝)으로 텍스트 변환
const caption = await runImageEmbedding(imageData);
content += `[${caption}]`;  // 텍스트로 추가
```

---

## 🖼️ 이미지 임베딩과의 연관성

### 이미지 임베딩 사용 시점

**코드 위치**: `src/ts/process/index.svelte.ts` (853줄)

```typescript
if (inlayData?.type === 'image') {
    if (modelInfo.flags.includes(LLMFlags.hasImageInput)) {
        // 멀티모달로 직접 전송
        multimodal.push({ type: 'image', base64: ... });
    } else {
        // 이미지 임베딩으로 캡셔닝
        const captionResult = await runImageEmbedding(inlayData.data);
        formatedChat += `[${captionResult[0].generated_text}]`;
    }
}
```

**이미지 임베딩 함수:**
- `runImageEmbedding(dataurl: string)` - `src/ts/process/transformers.ts`
- Vision Transformer 모델 사용 (예: `Xenova/clip-vit-base-patch32`)
- 이미지를 텍스트 캡션으로 변환

---

## 📊 Inlay 사용 사례

### 1. AI가 생성한 이미지 삽입

```javascript
// AI 응답에 <ImgGen="프롬프트"> 태그 포함
// → Stable Diffusion으로 이미지 생성
// → Inlay 에셋으로 저장
// → {{inlayed::id}} 태그로 교체
```

### 2. 사용자가 업로드한 이미지 삽입

```javascript
// 사용자가 이미지 업로드
// → writeInlayImage()로 저장
// → {{inlayeddata::id}} 태그 생성
// → 멀티모달로 LLM에 전송
```

### 3. 감정 이미지 표시

```javascript
// AI 응답에 <Emotion="Happy"> 태그
// → {{emotion::Happy}}로 변환
// → 감정 이미지 표시
```

---

## 🔧 서버 모듈에서의 구현

### 현재 상태

**서버 사이드 구현 완료:**
- ✅ `runInlayScreen()` - `src/server/process/auxiliary/inlay-screen.ts`
- ✅ `writeInlayImage()` - `src/server/process/auxiliary/file-processing.ts`
- ✅ `getInlayAsset()` - `src/server/process/auxiliary/file-processing.ts`
- ✅ Redis 기반 Inlay 에셋 저장 (`src/server/redis-service.ts`)

### 주요 차이점

| 항목 | 클라이언트 | 서버 |
|------|-----------|------|
| **저장소** | LocalForage | Redis |
| **이미지 처리** | Canvas API | sharp 라이브러리 |
| **에셋 접근** | IndexedDB | Redis + Asset Service |

### 서버 사이드 처리 흐름

```typescript
// 1. 이미지 생성 또는 업로드
const imageUrl = await generateAIImage(...);

// 2. URL에서 이미지 다운로드
const imageData = await fetch(imageUrl).then(r => r.arrayBuffer());

// 3. Inlay 에셋으로 저장 (Redis)
const inlayId = await writeInlayImage(
    new Uint8Array(imageData),
    { name: 'image.png' },
    userId
);

// 4. 태그로 교체
return `{{inlayed::${inlayId}}}`;
```

---

## 🎨 Inlay 태그 종류

### 1. `{{inlay::id}}`
- **용도**: 스타일 없는 인레이
- **모델 요청 포함**: ❌
- **표시**: 기본 스타일

### 2. `{{inlayed::id}}`
- **용도**: 스타일 있는 인레이
- **모델 요청 포함**: ❌
- **표시**: 스타일 적용 (`<div class="risu-inlay-image">`)

### 3. `{{inlayeddata::id}}`
- **용도**: 모델 요청에 포함되는 인레이
- **모델 요청 포함**: ✅
- **표시**: 스타일 적용
- **멀티모달 변환**: ✅

---

## 🔍 멀티모달 전송 형식

### OpenAI 형식

```typescript
{
    role: 'user',
    content: [
        { type: 'text', text: 'What is in this image?' },
        {
            type: 'image_url',
            image_url: {
                url: 'data:image/png;base64,...',
                detail: 'auto' | 'low' | 'high'
            }
        }
    ]
}
```

### Anthropic 형식

```typescript
{
    role: 'user',
    content: [
        { type: 'text', text: 'What is in this image?' },
        {
            type: 'image',
            source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'base64...'
            }
        }
    ]
}
```

### Google 형식

```typescript
{
    role: 'user',
    parts: [
        { text: 'What is in this image?' },
        {
            inline_data: {
                mime_type: 'image/png',
                data: 'base64...'
            }
        }
    ]
}
```

---

## 📝 서버 모듈에서의 처리

### 멀티모달 변환 (서버)

**코드 위치**: `src/server/process/chat/send-chat.ts` (예상)

서버 사이드에서도 동일한 로직이 필요:

```typescript
// 1. Inlay 태그 추출
const inlays = extractInlayTags(message.data);

// 2. 에셋 조회 및 멀티모달 변환
for (const inlayId of inlays) {
    const asset = await getInlayAsset(inlayId, userId);
    
    if (asset?.type === 'image') {
        if (supportsInlayImage(database, modelInfo)) {
            // 멀티모달로 전송
            multimodal.push({
                type: 'image',
                base64: asset.data,
                width: asset.width,
                height: asset.height
            });
        } else {
            // 이미지 임베딩 사용
            const caption = await runImageEmbedding(asset.data);
            message.data += `[${caption}]`;
        }
    }
}
```

### 이미지 임베딩 서버 구현

**현재 상태**: ⏳ 미구현

**필요 작업:**
- `src/server/process/auxiliary/image-embedding.ts`에 서버 사이드 구현
- 현재는 클라이언트 버전 임시 사용 (`import from '../../../ts/process/transformers'`)

---

## 🎯 요약

### Inlay의 역할

1. **미디어 콘텐츠 삽입**: 이미지/비디오/오디오를 채팅에 삽입
2. **멀티모달 변환**: Inlay 에셋을 `multimodals` 배열로 변환하여 LLM에 전송
3. **이미지 임베딩 연동**: 이미지 입력 미지원 모델의 경우 캡셔닝으로 텍스트 변환
4. **AI 이미지 생성**: Stable Diffusion으로 생성한 이미지를 자동으로 Inlay 처리

### 멀티모달과의 관계

- **Inlay는 멀티모달의 입력 소스**: Inlay 에셋이 `multimodals` 배열로 변환됨
- **모델 지원 여부에 따라 처리 분기**:
  - 지원: `multimodals` 배열에 직접 포함
  - 미지원: 이미지 임베딩으로 텍스트 변환

### 이미지 임베딩과의 관계

- **보조 역할**: 멀티모달 미지원 모델에서만 사용
- **캡셔닝**: 이미지를 텍스트 설명으로 변환하여 모델에 전송

---

## 📚 관련 파일

### 원본 (클라이언트)
- `src/ts/process/inlayScreen.ts` - Inlay Screen 처리
- `src/ts/process/files/inlays.ts` - Inlay 에셋 관리
- `src/ts/process/transformers.ts` - 이미지 임베딩

### 서버화
- `src/server/process/auxiliary/inlay-screen.ts` - Inlay Screen 처리
- `src/server/process/auxiliary/file-processing.ts` - Inlay 에셋 관리
- `src/server/process/auxiliary/image-embedding.ts` - 이미지 임베딩 (미완성)

---

**마지막 업데이트**: 2026년 1월
