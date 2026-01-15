# 서버 모듈 관점: 미마이그레이션/대체 구현 항목 정리

**작성일**: 2026년 1월  
**기준**: `src/ts`(원본) 대비 `src/server`(서버 모듈)에서 “필요/불필요/대체” 판단이 필요한 기능들

---

## ✅ 스코프 결정(요청 반영)

다음은 “서버 모듈에서 무엇을 가져갈지”에 대한 결정 사항입니다.

1. **MCP 시스템**: 서버 모듈에서 **사용하지 않음** → 마이그레이션 대상 아님
2. **Cold Storage**: 서버에서는 **Redis 사용** → 기존 “저장/압축” 개념을 **서버 캐시/아카이빙 전략**으로 재정의 필요
3. **WebLLM ~ 드라이브/백업(원본 3~10번)**: **클라이언트 전용** → 서버 모듈에서 사용하지 않음
4. **동기화/멀티유저**: 서버에서 **별도 방식으로 처리** (P2P 미지원) → `src/server`로 이관하지 않음
5. **템플릿 관련 기능**: 서버에서도 **누락 기능 구현 필요**

---

## 🧩 서버 처리 필요(미구현/대체 구현 필요)

### 1) Cold Storage (서버: Redis 기반으로 재설계 필요)

- **원본 위치**: `src/ts/process/coldstorage.svelte.ts`
- **원본이 하던 일(요약)**:
  - 대용량 데이터를 압축/분리 저장하고 필요 시 다시 로드
  - 계정/로컬(Tauri/Node/LocalForage) 저장소 분기

- **서버 모듈 관점 결론**:
  - 서버에서는 “Cold Storage”를 **Redis 캐시/아카이브 레이어**로 재정의하는 것이 합리적
  - 단, Redis를 캐시로만 쓸지(권장), 준영구 저장으로도 쓸지(AOF/RDB 운영 포함) 결정이 필요

- **결정/확인 필요(체크리스트)**:
  - **저장 성격**: 캐시 vs 준영구(운영 설정 포함)
  - **키 설계**: 예) `cold:{userId}:{chatId}:{segmentId}` / `cold:{userId}:chat:{chatId}:meta`
  - **저장 대상**: 오래된 메시지 원문 / 요약 / 임베딩 / 에셋 참조 중 무엇을 Redis에 둘지
  - **만료 정책**: TTL, LRU, 수동 eviction 등
  - **통합 지점**:
    - `database-adapter`에서 로드 최적화로 사용할지
    - `src/server/process/chat/send-chat.ts`에서 컨텍스트 구성 시 사용할지

### 2) 템플릿 관련 기능 (서버 누락 → 구현 필요)

- **원본 위치**: `src/ts/process/templates/`
  - `templateCheck.ts`: `templateCheck()` (프롬프트 템플릿 구성 경고/검증)
  - `getRecommended.ts`: `setRecommended()`, `recommendedPresetExist()` (모델별 권장 프리셋 적용)

- **서버 모듈 관점 결론**:
  - **`templateCheck`**: 서버에서 데이터 검증/안전장치로 유용 → **필요**
  - **권장 프리셋 로직**: 원본은 UI(선택/확인) 의존이 크므로 서버에서는
    - “권장값 계산(순수 함수)” 또는
    - “API가 권장 프리셋을 반환”
    형태로 분리하는 것이 적합 → **필요 여부는 API 설계에 따라**

- **구현 방향(제안)**:
  - `templateCheck`:
    - 위치 후보: `src/server/process/prompt/` (예: `template-check.ts`) 또는 `src/server/process/prompt/templates.ts`에 export 추가
    - 입력을 `Database` 전체가 아니라 “템플릿 배열”로 축소하면 서버 재사용성이 올라감
  - 권장 프리셋:
    - 서버에서는 UI가 없으니, `model` → `presetId/기본 prompt/toggles`를 반환하는 형태 권장

---

## 🚫 서버 모듈에서 사용하지 않음(클라이언트 전용 / 미마이그레이션 대상)

아래 항목들은 원본에는 존재하지만, 서버 모듈에서는 사용하지 않기로 결정했습니다.

- **플러그인 시스템**: `src/ts/plugins/*`
  - **사유**: 서버 보안상 사용자 코드 실행은 위험하며, 서비스 웹 특성상 클라이언트에서만 필요
  - 플러그인 훅(beforeRequest/afterRequest, edit 핸들러 등)은 서버에서 지원하지 않음
  - 커스텀 Provider, 커스텀 토크나이저도 플러그인 없이 직접 구현 필요 시 별도 처리
- **MCP 시스템**: `src/ts/process/mcp/*`
- **WebLLM**: `src/ts/process/webllm.ts` (브라우저 로컬 LLM)
- **Python Worker(Pyodide)**: `src/ts/process/pyworker.ts` (브라우저 워커)
- **ZIP/CharX 처리**: `src/ts/process/processzip.ts`
- **PDF 처리**: `src/ts/process/dynamicutils/pdf.ts`
- **MultiSend**: `src/ts/process/files/multisend.ts`
- **드라이브/백업**: `src/ts/drive/*`
- **Inlay 멀티모달 변환**: 서버에서 처리하지 않음 → 클라이언트에서 처리
- **이미지 임베딩**: 서버에서 처리하지 않음 → 클라이언트에서 처리 (선택적)
- **TTS 재생**: 서버는 오디오 데이터 생성만, 재생은 클라이언트
- **이미지 생성 (Stable Diffusion)**: 클라이언트 전용 (UI 연출용)
- **이모션 출력**: 클라이언트 전용 (UI 상태 업데이트)

---

## 🔁 서버에서 “별도 시스템”으로 처리(이관 대상 아님)

### 동기화/멀티유저

- **원본 위치**: `src/ts/sync/*` (P2P 포함)
- **서버 방침**:
  - 서버 모듈에서 **P2P는 지원하지 않음**
  - 동기화는 WebSocket/SSE 등 **서버-클라이언트 방식**으로 별도 구현/운영

---

## 📝 체크리스트(서버 관점)

- [ ] Cold Storage (Redis 기반) 설계/통합 포인트 확정
- [ ] `templateCheck` 서버 구현(순수 검증 함수)
- [ ] 권장 프리셋 로직 서버 제공 필요 여부/API 형태 결정
- [ ] 멀티모달 변환 로직 제거 (클라이언트로 위임)
- [ ] 이미지 임베딩 로직 제거 (클라이언트로 위임)
- [ ] TTS는 오디오 데이터 생성만 (재생은 클라이언트)
- [ ] 이미지 생성/이모션 출력은 클라이언트로 위임

---

**마지막 업데이트**: 2026년 1월

