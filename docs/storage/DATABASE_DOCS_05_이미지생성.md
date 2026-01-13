# Database 인터페이스 문서화 - 5부: 이미지 생성 설정

## Stable Diffusion 설정

### `sdProvider: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Stable Diffusion 프로바이더입니다. 'webui', 'runpod' 등 다양한 프로바이더를 지원합니다.

### `webUiUrl: string`
- **타입**: `string`
- **기본값**: `'http://127.0.0.1:7860/'`
- **설명**: Stable Diffusion WebUI URL입니다.

### `sdSteps: number`
- **타입**: `number`
- **기본값**: `30`
- **설명**: Stable Diffusion 생성 단계 수입니다. 값이 높을수록 품질이 향상되지만 시간이 더 걸립니다.

### `sdCFG: number`
- **타입**: `number`
- **기본값**: `7`
- **설명**: Stable Diffusion CFG Scale입니다. 프롬프트 준수도를 조절합니다.

### `sdConfig: sdConfig`
- **타입**: `sdConfig`
- **기본값**: `{ width: 512, height: 512, sampler_name: "Euler a", script_name: "", denoising_strength: 0.7, enable_hr: false, hr_scale: 1.25, hr_upscaler: "Latent" }`
- **설명**: Stable Diffusion 상세 설정입니다. 이미지 크기, 샘플러, 고해상도 업스케일링 등을 포함합니다.

### `runpodKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: RunPod API 키입니다. RunPod를 통해 Stable Diffusion을 사용할 때 필요합니다.

## NovelAI 이미지 생성 설정

### `NAIImgUrl: string`
- **타입**: `string`
- **기본값**: `'https://image.novelai.net/ai/generate-image'`
- **설명**: NovelAI 이미지 생성 API URL입니다.

### `NAIApiKey: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: NovelAI API 키입니다.

### `NAIImgModel: string`
- **타입**: `string`
- **기본값**: `'nai-diffusion-4-5-full'`
- **설명**: NovelAI 이미지 생성 모델입니다.

### `NAII2I: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: NovelAI Image-to-Image 기능 사용 여부입니다.

### `NAIREF: boolean`
- **타입**: `boolean`
- **기본값**: `false`
- **설명**: NovelAI Reference 기능 사용 여부입니다.

### `NAIImgConfig: NAIImgConfig`
- **타입**: `NAIImgConfig`
- **기본값**: 복잡한 객체 (width: 1024, height: 1024, sampler: "k_euler_ancestral", 등)
- **설명**: NovelAI 이미지 생성 상세 설정입니다. 이미지 크기, 샘플러, 스케일, 스텝 수, V4 프롬프트 설정 등을 포함합니다.

## 기타 이미지 생성 서비스

### `stabilityModel: string`
- **타입**: `string`
- **기본값**: `'sd3-large'`
- **설명**: Stability AI 모델입니다.

### `stabilityKey: string`
- **타입**: `string`
- **설명**: Stability AI API 키입니다.

### `stabllityStyle: string`
- **타입**: `string`
- **기본값**: `''`
- **설명**: Stability AI 스타일입니다.

### `dallEQuality: string`
- **타입**: `string`
- **기본값**: `'low'`
- **설명**: DALL-E 이미지 품질입니다. 'low', 'standard', 'hd' 등이 가능합니다.

### `ImagenModel: string`
- **타입**: `string`
- **기본값**: `'imagen-4.0-generate-001'`
- **설명**: Google Imagen 모델입니다.

### `ImagenImageSize: string`
- **타입**: `string`
- **기본값**: `'1K'`
- **설명**: Imagen 이미지 크기입니다. '1K', '2K' 등이 가능합니다.

### `ImagenAspectRatio: string`
- **타입**: `string`
- **기본값**: `'1:1'`
- **설명**: Imagen 이미지 종횡비입니다.

### `ImagenPersonGeneration: string`
- **타입**: `string`
- **기본값**: `'allow_all'`
- **설명**: Imagen 인물 생성 설정입니다.

### `falModel: string`
- **타입**: `string`
- **기본값**: `'fal-ai/flux/dev'`
- **설명**: FAL AI 모델입니다.

### `falToken: string`
- **타입**: `string`
- **설명**: FAL AI 토큰입니다.

### `falLora: string`
- **타입**: `string`
- **설명**: FAL AI LoRA 모델입니다.

### `falLoraName: string`
- **타입**: `string`
- **설명**: FAL AI LoRA 이름입니다.

### `falLoraScale: number`
- **타입**: `number`
- **기본값**: `1`
- **설명**: FAL AI LoRA 스케일입니다.

### `comfyUiUrl: string`
- **타입**: `string`
- **기본값**: `'http://localhost:8188'`
- **설명**: ComfyUI 서버 URL입니다.

### `comfyConfig: ComfyConfig`
- **타입**: `ComfyConfig`
- **기본값**: `{ workflow: '', posNodeID: '', posInputName: 'text', negNodeID: '', negInputName: 'text', timeout: 30 }`
- **설명**: ComfyUI 설정입니다. 워크플로우, 노드 ID, 입력 이름 등을 포함합니다.

### `inlayImage: boolean`
- **타입**: `boolean`
- **설명**: 이미지 인레이 기능 사용 여부입니다.

### `outputImageModal: boolean`
- **타입**: `boolean`
- **설명**: 출력 이미지 모달 표시 여부입니다.

### `gptVisionQuality: string`
- **타입**: `string`
- **기본값**: `'low'`
- **설명**: GPT Vision 이미지 품질입니다. 'low', 'high' 등이 가능합니다.

### `newImageHandlingBeta?: boolean`
- **타입**: `boolean` (선택적)
- **설명**: 새로운 이미지 처리 베타 기능 사용 여부입니다.

### `imageCompression: boolean`
- **타입**: `boolean`
- **기본값**: `true`
- **설명**: 이미지 압축 사용 여부입니다.

### `assetMaxDifference: number`
- **타입**: `number`
- **기본값**: `4`
- **설명**: 에셋 최대 차이값입니다.

### `dynamicAssets: boolean`
- **타입**: `boolean`
- **설명**: 동적 에셋 사용 여부입니다.

### `dynamicAssetsEditDisplay: boolean`
- **타입**: `boolean`
- **설명**: 동적 에셋 편집 표시 여부입니다.
