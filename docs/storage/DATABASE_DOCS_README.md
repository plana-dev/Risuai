# Database 인터페이스 문서화

이 문서는 `src/ts/storage/database.svelte.ts` 파일의 `Database` 인터페이스에 대한 상세 설명입니다.

## 문서 구조

Database 인터페이스의 필드들은 기능별로 나누어 여러 문서로 분리되어 있습니다:

1. **[기본 설정 및 캐릭터 관리](DATABASE_DOCS_01_기본설정.md)**
   - 캐릭터 목록, 사용자 정보, 기본 설정 등

2. **[API 및 모델 설정](DATABASE_DOCS_02_API모델설정.md)**
   - OpenAI, Claude, NovelAI, OpenRouter 등 다양한 API 설정

3. **[생성 파라미터 및 프롬프트 설정](DATABASE_DOCS_03_생성파라미터.md)**
   - Temperature, Top-p, Top-k 등 생성 파라미터 및 프롬프트 관련 설정

4. **[UI 및 테마 설정](DATABASE_DOCS_04_UI테마설정.md)**
   - 테마, 색상, 폰트, 레이아웃 등 UI 관련 설정

5. **[이미지 생성 설정](DATABASE_DOCS_05_이미지생성.md)**
   - Stable Diffusion, NovelAI, DALL-E 등 이미지 생성 서비스 설정

6. **[TTS 및 음성 설정](DATABASE_DOCS_06_TTS음성.md)**
   - ElevenLabs, VOICEVOX, Fish Speech 등 TTS 서비스 설정

7. **[번역 설정](DATABASE_DOCS_07_번역.md)**
   - Google, DeepL, LLM 번역기 등 번역 관련 설정

8. **[메모리 및 로어북 설정](DATABASE_DOCS_08_메모리로어북.md)**
   - 로어북, SupaMemory, HypaMemory 등 메모리 시스템 설정

9. **[플러그인 및 확장 기능](DATABASE_DOCS_09_플러그인확장.md)**
   - 플러그인, 모듈, 스크립트, 자동 제안 등 확장 기능

10. **[고급 설정 및 기타](DATABASE_DOCS_10_고급설정.md)**
    - 고급 생성 설정, 토크나이저, 그룹 채팅 등 기타 설정

## 사용 방법

각 문서는 해당 카테고리의 필드들에 대한 상세한 설명을 포함하고 있습니다:
- **필드명**: TypeScript 인터페이스의 필드 이름
- **타입**: 필드의 TypeScript 타입
- **기본값**: `setDatabase` 함수에서 설정되는 기본값
- **설명**: 필드의 용도와 사용 방법

## 참고사항

- 모든 필드는 `setDatabase` 함수에서 초기화되며, 값이 없을 경우 기본값이 설정됩니다.
- 일부 필드는 선택적(`?`)이며, 반드시 존재하지 않을 수 있습니다.
- 기본값은 코드의 `setDatabase` 함수를 참조하세요.
