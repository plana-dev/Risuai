# Tool Calls 기능 분석

**작성일**: 2026년 1월  
**기준**: `src/ts/process/request/*`, `src/ts/process/mcp/*` 분석

---

## 📋 개요

**Tool Calls**는 LLM(대형 언어 모델)이 대화 중에 외부 함수/도구를 호출할 수 있게 하는 기능입니다. OpenAI, Anthropic, Google 등의 모델에서 지원하며, RisuAI에서는 **MCP (Model Context Protocol)**를 통해 다양한 도구들을 제공합니다.

---

## 🎯 Tool Calls란?

### 정의

Tool Calls는 LLM이 대화 중에 **함수 호출**을 요청하고, 그 결과를 받아서 대화를 계속하는 기능입니다.

### 동작 방식

1. **LLM이 함수 호출 요청**: 모델이 특정 함수를 호출하고 싶을 때 `tool_calls`를 반환
2. **함수 실행**: 요청된 함수를 실행하고 결과를 얻음
3. **결과 반환**: 함수 실행 결과를 LLM에 전달
4. **대화 계속**: LLM이 함수 결과를 바탕으로 응답 생성

### 예시

```
사용자: "오늘 날씨가 어때?"
↓
LLM: [tool_call: get_weather(location="서울")]
↓
함수 실행: get_weather("서울") → "맑음, 20도"
↓
LLM: "오늘 서울 날씨는 맑고 20도입니다."
```

---

## 🔧 Tool Calls 처리 흐름

### 1. Tool 목록 제공

LLM 요청 시 사용 가능한 Tool 목록을 함께 전송:

```typescript
// src/ts/process/request/request.ts
const tools = await getTools()  // MCP를 통해 Tool 목록 가져오기

// OpenAI 요청에 Tool 목록 포함
if(arg.tools && arg.tools.length > 0){
    body.tools = arg.tools.map(tool => {
        return {
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: simplifySchema(tool.inputSchema),
            }
        };
    });
}
```

### 2. LLM 응답에서 Tool Call 감지

LLM이 Tool을 호출하고 싶을 때 `tool_calls`를 반환:

```typescript
// OpenAI 응답 예시
{
    role: 'assistant',
    content: '...',
    tool_calls: [{
        id: 'call_123',
        type: 'function',
        function: {
            name: 'risu-get-character-info',
            arguments: '{"id": "char_123"}'
        }
    }]
}
```

### 3. Tool 실행

요청된 Tool을 실행:

```typescript
// src/ts/process/request/openAI.ts
for(const toolCall of toolCalls){
    const functionArgs = JSON.parse(toolCall.function.arguments)
    const tool = arg.tools.find(t => t.name === toolCall.function.name)
    
    if(tool){
        // Tool 실행
        const result = await callTool(tool.name, functionArgs)
        
        // 결과를 메시지에 추가
        messages.push({
            role: 'tool',
            content: result[0].text,
            tool_call_id: toolCall.id
        })
    }
}
```

### 4. 재귀 호출

Tool 실행 결과를 포함하여 LLM에 다시 요청:

```typescript
// Tool 결과를 포함하여 재요청
body.messages = messages  // Tool 결과 포함
const resRec = await requestHTTPOpenAI(replacerURL, body, headers, arg)
```

---

## 🛠️ 사용 가능한 Tool 종류

### MCP (Model Context Protocol) 기반 Tool

RisuAI는 **MCP**를 통해 다양한 Tool을 제공합니다.

#### 1. RisuAccess Tool (내부)

**위치**: `src/ts/process/mcp/risuaccess/`

RisuAI 자체 기능에 접근하는 Tool:

- **Character Handler** (`characters.ts`):
  - `risu-get-character-info`: 캐릭터 정보 가져오기
  - `risu-list-character-lorebooks`: 캐릭터 로어북 목록
  - `risu-get-character-lorebook`: 특정 로어북 가져오기
  - `risu-set-character-info`: 캐릭터 정보 설정
  - `risu-create-character-lorebook`: 로어북 생성
  - `risu-update-character-lorebook`: 로어북 업데이트
  - `risu-delete-character-lorebook`: 로어북 삭제
  - `risu-get-character-regex-scripts`: 정규식 스크립트 가져오기
  - `risu-set-character-regex-scripts`: 정규식 스크립트 설정
  - `risu-delete-character-regex-scripts`: 정규식 스크립트 삭제
  - `risu-get-character-additional-assets`: 추가 에셋 가져오기
  - `risu-delete-character-additional-assets`: 추가 에셋 삭제
  - `risu-get-character-lua-script`: Lua 스크립트 가져오기
  - `risu-set-character-lua-script`: Lua 스크립트 설정
  - `risu-list-characters`: 캐릭터 목록

- **Chat Handler** (`chats.ts`):
  - 채팅 관련 Tool들

- **Module Handler** (`modules.ts`):
  - 모듈 관련 Tool들

#### 2. FileSystem Tool (내부)

**위치**: `src/ts/process/mcp/filesystemclient.ts`

파일 시스템 접근 Tool:

- `read_file`: 파일 읽기
- `read_file_as_pdf`: PDF 파일 읽기
- `read_file_as_text`: 텍스트 파일 읽기
- `read_file_as_base64`: Base64로 파일 읽기
- `write_file`: 파일 쓰기
- `list_directory`: 디렉토리 목록
- `create_directory`: 디렉토리 생성
- `delete_file`: 파일 삭제
- `copy_file`: 파일 복사
- `move_file`: 파일 이동
- `get_file_info`: 파일 정보 가져오기
- `find_duplicates`: 중복 파일 찾기
- `get_tree_view`: 트리 뷰 가져오기

#### 3. GoogleSearch Tool (내부)

**위치**: `src/ts/process/mcp/googlesearchclient.ts`

Google 검색 Tool:

- `web_search`: 웹 검색
- `image_search`: 이미지 검색

#### 4. AIAccess Tool (내부)

**위치**: `src/ts/process/mcp/aiaccess.ts`

AI 서비스 접근 Tool (LLM 호출 등)

#### 5. 외부 MCP 서버

다양한 외부 MCP 서버를 연결할 수 있습니다:

- PayPal MCP
- Linear MCP
- OneContext MCP
- Cloudflare Browser MCP
- DeepWiki MCP
- 기타 사용자 정의 MCP 서버

---

## 📝 Tool Call 인코딩/디코딩

### encodeToolCall

Tool Call을 텍스트 형식으로 인코딩:

```typescript
// src/ts/process/mcp/mcp.ts
export async function encodeToolCall(call: toolCallData) {
    call.call.id = call.call.id || v4();
    await inst.setItem(call.call.id, call);  // LocalForage에 저장
    return `<tool_call>${call.call.id}\uf100${call.call.name}</tool_call>\n\n`;
}
```

**형식**: `<tool_call>{id}\uf100{name}</tool_call>`

### decodeToolCall

텍스트에서 Tool Call 정보 추출:

```typescript
// src/ts/process/mcp/mcp.ts
export async function decodeToolCall(text: string): Promise<toolCallData | undefined> {
    text = text.trim();
    if(text.startsWith('<tool_call>')){
        text = text.slice('<tool_call>'.length, 0).trim();
    }
    if(text.endsWith('</tool_call>')){
        text = text.slice(0, -'</tool_call>'.length).trim();
    }
    const [callId, callName] = text.split('\uf100');
    if(!callId) {
        return undefined;
    }
    const call = await inst.getItem<toolCallData>(callId);  // LocalForage에서 가져오기
    return call;
}
```

### Tool Call 저장

Tool Call 정보는 **LocalForage**에 저장되어 나중에 재사용할 수 있습니다:

```typescript
const inst = localforage.createInstance({
    name: 'mcp-tool-calls',
    storeName: 'mcp-tool-calls'
});
```

---

## 🔄 Tool Calls 처리 위치

### 1. OpenAI 요청 처리

**위치**: `src/ts/process/request/openAI.ts`

- **비스트리밍 모드**: Tool Call 감지 후 즉시 실행
- **스트리밍 모드**: 스트리밍 중 Tool Call 감지 및 처리

```typescript
// 비스트리밍 모드
if(dat.choices?.[0]?.message?.tool_calls && dat.choices[0].message.tool_calls.length > 0){
    const toolCalls = dat.choices[0].message.tool_calls as OpenAIToolCall[]
    
    // 각 Tool Call 실행
    for(const toolCall of toolCalls){
        const result = await callTool(tool.name, parsed)
        // 결과를 메시지에 추가
        messages.push({
            role: 'tool',
            content: result[0].text,
            tool_call_id: toolCall.id
        })
    }
    
    // 재귀 호출
    body.messages = messages
    const resRec = await requestHTTPOpenAI(replacerURL, body, headers, arg)
}
```

### 2. Anthropic (Claude) 요청 처리

**위치**: `src/ts/process/request/anthropic.ts`

Claude는 `tool_use` 블록을 사용합니다:

```typescript
if(content.type === 'tool_use'){
    // Tool 실행
    const tool = arg.tools?.find((t) => t.name === content.name)
    const toolResults = await callTool(tool.name, content.input)
    
    // 결과를 응답에 추가
    response.content.push({
        type: 'tool_result',
        tool_use_id: content.id,
        content: toolResults
    })
}
```

### 3. Google (Gemini) 요청 처리

**위치**: `src/ts/process/request/google.ts`

Gemini는 `functionCall`을 사용합니다:

```typescript
const calls = parts.filter((p) => !!p?.functionCall).map((p) => p?.functionCall as GeminiFunctionCall)

for(const call of calls){
    const tool = tools.find((t) => t.name === call.name)
    if(tool){
        const result = await callTool(tool.name, call.args)
        // 결과 처리
    }
}
```

---

## 🚫 서버 모듈에서의 Tool Calls

### 현재 상태

**위치**: `src/server/process/request/*`

서버 모듈에서는 Tool Calls 처리가 **부분적으로만 구현**되어 있습니다:

#### 구현된 부분

- ✅ Tool 목록을 요청에 포함하는 구조
- ✅ Tool Call 감지 구조
- ✅ 기본적인 Tool 실행 뼈대

#### 미구현 부분

- ❌ **decodeToolCall**: 서버 사이드 마이그레이션 필요
- ❌ **encodeToolCall**: 서버 사이드 마이그레이션 필요
- ❌ **Tool 실행 로직**: MCP 제외한 실제 Tool 실행 로직 구현 필요
- ❌ **MCP 시스템**: 서버에서는 MCP를 사용하지 않음 (보안상 제외)

### 서버에서의 Tool Calls 처리 방향

1. **MCP 제외**: 서버에서는 MCP를 사용하지 않음 (보안상)
2. **내부 Tool만 지원**: RisuAI 내부 기능에 대한 Tool만 지원
3. **LocalForage 대신 Redis**: Tool Call 저장은 Redis 사용

### 필요한 작업

1. **decodeToolCall 서버 사이드 구현**
   - LocalForage 대신 Redis 사용
   - Tool Call 정보 저장/조회

2. **encodeToolCall 서버 사이드 구현**
   - Redis에 Tool Call 정보 저장
   - 텍스트 형식으로 인코딩

3. **Tool 실행 로직 구현**
   - MCP 제외
   - 내부 Tool만 실행 (RisuAccess 등)
   - 보안 체크 추가

---

## 📊 Tool Calls 사용 예시

### 예시 1: 캐릭터 정보 가져오기

```
사용자: "현재 캐릭터의 이름과 설명을 알려줘"
↓
LLM: [tool_call: risu-get-character-info(id="", fields=["name", "description"])]
↓
Tool 실행: CharacterHandler.handle("risu-get-character-info", {id: "", fields: ["name", "description"]})
↓
결과: {name: "Alice", description: "친절한 AI 어시스턴트"}
↓
LLM: "현재 캐릭터는 Alice이고, 친절한 AI 어시스턴트입니다."
```

### 예시 2: 파일 읽기

```
사용자: "프로젝트의 README 파일을 읽어줘"
↓
LLM: [tool_call: read_file(path="README.md")]
↓
Tool 실행: FileSystemClient.readFile("README.md")
↓
결과: "# 프로젝트 소개\n..."
↓
LLM: "README 파일 내용은 다음과 같습니다:\n# 프로젝트 소개\n..."
```

### 예시 3: 웹 검색

```
사용자: "오늘 날씨가 어때?"
↓
LLM: [tool_call: web_search(query="오늘 날씨")]
↓
Tool 실행: GoogleSearchClient.webSearch({query: "오늘 날씨"})
↓
결과: "오늘 서울 날씨는 맑고 20도입니다."
↓
LLM: "오늘 서울 날씨는 맑고 20도입니다."
```

---

## 🔐 보안 고려사항

### 클라이언트 사이드

- **사용자 확인**: 일부 Tool은 실행 전 사용자 확인 필요
  ```typescript
  // src/ts/process/mcp/risuaccess/characters.ts
  private promptAccess(tool: string, action: string) {
      return alertConfirm(language.mcpAccessPrompt.replace('{{tool}}', tool).replace('{{action}}', action))
  }
  ```

- **권한 체크**: Tool별 권한 체크

### 서버 사이드

- **MCP 제외**: 보안상 MCP는 서버에서 사용하지 않음
- **내부 Tool만**: RisuAI 내부 기능에 대한 Tool만 지원
- **보안 체크**: Tool 실행 전 보안 체크 필요

---

## 📝 체크리스트

### 서버 구현 필요

- [ ] `decodeToolCall` 서버 사이드 구현 (Redis 사용)
- [ ] `encodeToolCall` 서버 사이드 구현 (Redis 사용)
- [ ] Tool 실행 로직 구현 (MCP 제외, 내부 Tool만)
- [ ] 보안 체크 로직 구현
- [ ] Tool Call 저장/조회 (Redis)

### 클라이언트 (현재 구현됨)

- [x] Tool 목록 제공 (MCP)
- [x] Tool Call 감지 및 실행
- [x] Tool Call 인코딩/디코딩 (LocalForage)
- [x] 재귀 호출 처리
- [x] 스트리밍 모드 Tool Call 처리

---

## 🔗 관련 파일

### 원본 (클라이언트)

- `src/ts/process/request/openAI.ts`: OpenAI Tool Calls 처리
- `src/ts/process/request/anthropic.ts`: Claude Tool Calls 처리
- `src/ts/process/request/google.ts`: Gemini Tool Calls 처리
- `src/ts/process/mcp/mcp.ts`: MCP Tool 관리 및 인코딩/디코딩
- `src/ts/process/mcp/mcplib.ts`: MCP 프로토콜 라이브러리
- `src/ts/process/mcp/risuaccess/*`: RisuAccess Tool 핸들러
- `src/ts/process/mcp/filesystemclient.ts`: FileSystem Tool
- `src/ts/process/mcp/googlesearchclient.ts`: GoogleSearch Tool

### 서버

- `src/server/process/request/openai.ts`: OpenAI Tool Calls 처리 (부분 구현)
- `src/server/process/request/anthropic.ts`: Claude Tool Calls 처리 (부분 구현)
- `src/server/process/request/google.ts`: Gemini Tool Calls 처리 (부분 구현)

---

**마지막 업데이트**: 2026년 1월
