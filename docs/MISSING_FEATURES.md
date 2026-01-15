# 서버화 작업 중 누락된 기능 목록

**작성일**: 2026년 1월  
**기준**: `src/ts` → `src/server` 마이그레이션 진행 중 누락된 기능들

---

## 📋 개요

이 문서는 원본 소스(`src/ts`)에 존재하지만 서버화 소스(`src/server`)에 아직 마이그레이션되지 않은 기능들을 정리한 것입니다.

**전체 진행률**: 약 83% 완료  
**누락된 기능**: 약 17%

---

## 🔴 P0 (Critical) - 핵심 기능 누락

### 1. MCP (Model Context Protocol) 시스템

**위치**: `src/ts/process/mcp/`  
**상태**: ❌ 완전 누락

**누락된 파일들:**
- `mcp.ts` - MCP 클라이언트 초기화 및 관리
- `mcplib.ts` - MCP 라이브러리 (JsonRPC, MCPTool 등)
- `internalmcp.ts` - 내부 MCP 인터페이스
- `filesystemclient.ts` - 파일 시스템 MCP 클라이언트
- `aiaccess.ts` - AI 접근 MCP 클라이언트
- `googlesearchclient.ts` - Google 검색 MCP 클라이언트
- `risuaccess/` - RisuAI 접근 MCP 클라이언트
  - `client.ts` - RisuAccess 클라이언트
  - `characters.ts` - 캐릭터 관련 MCP
  - `chats.ts` - 채팅 관련 MCP
  - `modules.ts` - 모듈 관련 MCP
  - `utils.ts` - 유틸리티

**주요 기능:**
- `initializeMCPs()` - MCP 클라이언트 초기화
- `MCPs` - MCP 클라이언트 레지스트리
- 내부 MCP 지원 (`internal:fs`, `internal:risuai`, `internal:aiaccess`, `internal:googlesearch`)
- stdio 기반 MCP 지원 (Tauri 전용)
- HTTP 기반 MCP 지원

**영향도**: 높음 - MCP를 사용하는 기능들이 작동하지 않음

**예상 작업량**: 5-7일

---

## 🟡 P1 (High) - 주요 기능 누락

### 2. Cold Storage 시스템

**위치**: `src/ts/process/coldstorage.svelte.ts`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `makeColdData()` - Cold Storage 데이터 생성
- `preLoadChat()` - 채팅 사전 로드
- `coldStorageHeader` - Cold Storage 헤더 상수
- 압축/압축 해제 기능 (fflate 사용)
- 계정 기반 Cold Storage (Supabase Hub)
- 로컬 Cold Storage (Tauri, Node, LocalForage)

**용도**: 대용량 데이터를 압축하여 저장하고 필요시 로드하는 시스템

**영향도**: 중간 - 대용량 채팅 데이터 관리에 사용

**예상 작업량**: 2-3일

### 3. WebLLM 통합

**위치**: `src/ts/process/webllm.ts`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `chatCompletion()` - WebLLM을 사용한 채팅 완성
- `unloadEngine()` - 엔진 언로드
- MLCEngine 초기화 및 관리
- 브라우저에서 직접 LLM 실행

**용도**: 클라이언트 사이드에서 로컬 LLM 실행

**영향도**: 낮음 - 서버 사이드에서는 불필요할 수 있음 (클라이언트 전용 기능)

**예상 작업량**: 서버 사이드에서는 불필요 (클라이언트 전용)

### 4. Python Worker (Pyodide)

**위치**: `src/ts/process/pyworker.ts`  
**상태**: ❌ 완전 누락

**주요 기능:**
- Python 코드 실행 (Pyodide 사용)
- JavaScript와 Python 간 통신
- 모듈 함수 등록 및 호출
- Web Worker 기반 실행

**용도**: Python 스크립트 실행 (예: 사용자 정의 스크립트)

**영향도**: 낮음 - 특정 사용 사례에만 필요

**예상 작업량**: 2-3일 (서버 사이드 Python 실행 환경 필요)

### 5. ZIP 처리 및 CharX 형식

**위치**: `src/ts/process/processzip.ts`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `processZip()` - ZIP 파일에서 이미지 추출
- `CharXWriter` - CharX 형식 작성 클래스
- `CharXImporter` - CharX 형식 임포트 클래스
- `CharXSkippableChecker()` - CharX 스킵 가능 여부 확인
- ZIP 압축/압축 해제 (fflate 사용)
- 에셋 저장 및 관리

**용도**: 캐릭터 카드 ZIP 파일 처리, CharX 형식 지원

**영향도**: 중간 - 캐릭터 임포트/익스포트에 사용

**예상 작업량**: 3-4일

### 6. PDF 처리

**위치**: `src/ts/process/dynamicutils/pdf.ts`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `convertPdfToImages()` - PDF를 이미지로 변환
- `extractPdfText()` - PDF에서 텍스트 추출
- pdfjs-dist 사용
- Canvas 기반 렌더링

**용도**: PDF 파일 처리 (이미지/텍스트 추출)

**영향도**: 낮음 - 특정 사용 사례에만 필요

**예상 작업량**: 1-2일

### 7. MultiSend 기능

**위치**: `src/ts/process/files/multisend.ts`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `postChatFile()` - 채팅 파일 전송
- 여러 파일 동시 전송 처리

**용도**: 여러 파일을 동시에 채팅에 첨부

**영향도**: 낮음 - 특정 사용 사례에만 필요

**예상 작업량**: 1일

---

## 🟢 P2 (Medium) - 보조 기능 누락

### 8. 템플릿 관련 기능

**위치**: `src/ts/process/templates/`  
**상태**: ⚠️ 일부 누락

**누락된 기능:**
- `getRecommended.ts` - 권장 프리셋 설정
  - `setRecommended()` - 모델에 따른 권장 프리셋 설정
  - `recommendedPresetExist()` - 권장 프리셋 존재 여부 확인
- `templateCheck.ts` - 템플릿 검증
  - `templateCheck()` - 프롬프트 템플릿 검증 및 경고

**영향도**: 낮음 - UI/UX 개선 기능

**예상 작업량**: 1일

### 9. 동기화 및 멀티유저 기능

**위치**: `src/ts/sync/`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `multiuser.ts` - 멀티유저 동기화
- Peer-to-Peer 동기화
- 실시간 채팅 동기화

**영향도**: 중간 - 멀티유저 기능에 필요

**예상 작업량**: 3-5일

### 10. 드라이브 및 백업 기능

**위치**: `src/ts/drive/`  
**상태**: ❌ 완전 누락

**주요 기능:**
- `drive.ts` - 클라우드 드라이브 통합
- `backuplocal.ts` - 로컬 백업
- `accounter.ts` - 계정 관리

**영향도**: 중간 - 클라우드 백업/동기화에 필요

**예상 작업량**: 4-6일

---

## 📊 누락된 기능 요약

### 모듈별 누락 현황

| 모듈 | 누락 파일 수 | 우선순위 | 예상 작업량 |
|------|------------|---------|------------|
| **MCP 시스템** | 10+ 파일 | P0 | 5-7일 |
| **Cold Storage** | 1 파일 | P1 | 2-3일 |
| **ZIP/CharX 처리** | 1 파일 | P1 | 3-4일 |
| **WebLLM** | 1 파일 | P1* | 불필요* |
| **Python Worker** | 1 파일 | P1 | 2-3일 |
| **PDF 처리** | 1 파일 | P2 | 1-2일 |
| **MultiSend** | 1 파일 | P2 | 1일 |
| **템플릿 기능** | 2 파일 | P2 | 1일 |
| **동기화** | 1+ 파일 | P2 | 3-5일 |
| **드라이브/백업** | 3+ 파일 | P2 | 4-6일 |

*WebLLM은 클라이언트 전용 기능이므로 서버 사이드에서는 불필요할 수 있음

### 우선순위별 작업량

- **P0 (Critical)**: 5-7일
- **P1 (High)**: 8-12일 (WebLLM 제외)
- **P2 (Medium)**: 10-15일

**총 예상 작업량**: 23-34일 (약 1-1.5개월)

---

## 🎯 마이그레이션 권장 순서

### Phase 1: 핵심 기능 (1주)
1. MCP 시스템 마이그레이션
   - MCP 클라이언트 기본 구조
   - 내부 MCP 클라이언트들
   - HTTP 기반 MCP 지원

### Phase 2: 데이터 처리 (1주)
2. Cold Storage 시스템
3. ZIP/CharX 처리

### Phase 3: 보조 기능 (1-2주)
4. Python Worker (필요시)
5. PDF 처리
6. MultiSend
7. 템플릿 기능

### Phase 4: 고급 기능 (2-3주)
8. 동기화 및 멀티유저
9. 드라이브 및 백업

---

## 💡 참고사항

### 클라이언트 전용 기능
다음 기능들은 클라이언트 사이드에서만 실행되는 기능이므로 서버 사이드 마이그레이션이 불필요할 수 있습니다:
- **WebLLM**: 브라우저에서 직접 LLM 실행
- 일부 GUI 관련 기능들

### 서버 사이드 대안
일부 기능은 서버 사이드에서 다른 방식으로 구현할 수 있습니다:
- **Python Worker**: 서버 사이드 Python 실행 환경 사용
- **PDF 처리**: 서버 사이드 PDF 라이브러리 사용 (예: pdf-lib, pdfjs-node)
- **ZIP 처리**: Node.js의 내장 zlib 또는 압축 라이브러리 사용

### 의존성 고려사항
- **MCP**: 서버 사이드에서 stdio 기반 MCP는 제한적일 수 있음
- **Cold Storage**: 서버 사이드 스토리지 시스템과 통합 필요
- **동기화**: 서버 사이드에서는 WebSocket/SSE 기반 실시간 동기화로 대체 가능

---

## 📝 체크리스트

### P0 (Critical)
- [ ] MCP 시스템 마이그레이션
  - [ ] MCP 클라이언트 기본 구조
  - [ ] 내부 MCP 클라이언트들
  - [ ] HTTP 기반 MCP 지원
  - [ ] RisuAccess 클라이언트

### P1 (High)
- [ ] Cold Storage 시스템
- [ ] ZIP/CharX 처리
- [ ] Python Worker (필요시)

### P2 (Medium)
- [ ] PDF 처리
- [ ] MultiSend
- [ ] 템플릿 기능
- [ ] 동기화 및 멀티유저
- [ ] 드라이브 및 백업

---

**마지막 업데이트**: 2026년 1월  
**다음 리뷰 예정일**: 진행 상황에 따라 업데이트
