# RisuAI 모듈 시스템 상세 설명

## 목차
1. [모듈 시스템 개요](#모듈-시스템-개요)
2. [.risum 파일 (모듈 파일)](#risum-파일-모듈-파일)
3. [.risup 파일 (프리셋 파일)](#risup-파일-프리셋-파일)
4. [모듈 활성화 및 사용](#모듈-활성화-및-사용)
5. [모듈 제작 가이드](#모듈-제작-가이드)
6. [프리셋 제작 가이드](#프리셋-제작-가이드)

---

## 모듈 시스템 개요

RisuAI의 모듈 시스템은 확장 가능한 기능 모듈을 통해 애플리케이션의 기능을 확장할 수 있게 해주는 핵심 시스템입니다. 모듈은 로어북(Lorebook), 정규식 스크립트(Regex Scripts), 트리거(Triggers), 에셋(Assets), MCP 연동 등을 포함할 수 있습니다.

### 모듈의 주요 구성 요소

모듈(`RisuModule`)은 다음과 같은 구조를 가집니다:

```typescript
interface RisuModule {
    name: string                    // 모듈 이름
    description: string            // 모듈 설명
    lorebook?: loreBook[]          // 로어북 항목들
    regex?: customscript[]         // 정규식 스크립트들
    cjs?: string                   // CommonJS 코드
    trigger?: triggerscript[]      // 트리거 스크립트들
    id: string                     // 고유 ID (UUID)
    lowLevelAccess?: boolean       // 저수준 시스템 접근 권한
    hideIcon?: boolean             // UI에서 아이콘 숨기기
    backgroundEmbedding?: string   // 배경 임베딩 텍스트
    assets?: [string,string,string][]  // 에셋 배열 [이름, URL, 타입]
    namespace?: string              // 네임스페이스 (통합용)
    customModuleToggle?: string    // 커스텀 모듈 토글
    mcp?: MCPModule                // MCP 모듈 설정
}
```

### 모듈의 역할

모듈은 다음 기능들을 제공할 수 있습니다:

1. **로어북 확장**: 캐릭터의 컨텍스트에 추가 정보를 제공
2. **스크립트 처리**: 입력/출력 텍스트를 정규식으로 변환
3. **트리거 실행**: 특정 조건에서 자동으로 실행되는 스크립트
4. **에셋 제공**: 이미지, 오디오 등의 미디어 파일
5. **MCP 연동**: Model Context Protocol을 통한 외부 도구 통합

---

## .risum 파일 (모듈 파일)

`.risum` 파일은 RisuAI 모듈을 저장하는 바이너리 형식입니다.

### 파일 구조

`.risum` 파일은 다음과 같은 바이너리 구조를 가집니다:

```
[매직 넘버: 1바이트] (값: 111)
[버전: 1바이트] (현재: 0)
[메인 데이터 길이: 4바이트 (LE)]
[메인 데이터: RPack 압축된 JSON]
[에셋 마커: 1바이트] (1 = 에셋, 0 = 파일 끝)
[에셋 데이터 길이: 4바이트 (LE)]
[에셋 데이터: RPack 압축된 이미지]
... (에셋 반복)
[종료 마커: 1바이트] (0)
```

### 메인 데이터 형식

메인 데이터는 다음과 같은 JSON 구조를 RPack으로 압축한 것입니다:

```json
{
    "type": "risuModule",
    "module": {
        "name": "모듈 이름",
        "description": "모듈 설명",
        "id": "uuid",
        "lorebook": [...],
        "regex": [...],
        "trigger": [...],
        "assets": [["이름", "", "타입"], ...]
    }
}
```

**참고**: Export 시점에 `assets` 배열의 두 번째 요소(URL)는 빈 문자열로 설정되며, 실제 에셋 데이터는 별도로 저장됩니다.

### Export 과정

```35:97:src/ts/process/modules.ts
export async function exportModule(module:RisuModule, arg:{
    alertEnd?:boolean
    saveData?:boolean
} = {}){
    const alertEnd = arg.alertEnd ?? true
    const saveData = arg.saveData ?? true
    const apb = new AppendableBuffer()
    const writeLength = (len:number) => {
        const lenbuf = Buffer.alloc(4)
        lenbuf.writeUInt32LE(len, 0)
        apb.append(lenbuf)
    }
    const writeByte = (byte:number) => {
        //byte is 0-255
        const buf = Buffer.alloc(1)
        buf.writeUInt8(byte, 0)
        apb.append(buf)
    }

    const assets = module.assets ?? []
    module = safeStructuredClone(module)
    module.assets ??= []
    module.assets = module.assets.map((asset) => {
        return [asset[0], '', asset[2]] as [string,string,string]
    })

    const mainbuf = await encodeRPack(Buffer.from(JSON.stringify({
        module: module,
        type: 'risuModule'
    }, null, 2), 'utf-8'))

    writeByte(111) //magic number
    writeByte(0) //version
    writeLength(mainbuf.length)
    apb.append(mainbuf)

    for(let i=0;i<assets.length;i++){
        const asset = assets[i]
        writeByte(1) //mark as asset
        alertStore.set({
            type: 'wait',
            msg: `Loading... (Adding Assets ${i} / ${assets.length})`
        })
        let rData = await readImage(asset[1])
        if(!rData){
            rData = new Uint8Array(0) //blank buffer
        }
        let encoded = await encodeRPack(Buffer.from(await convertImage(rData)))
        writeLength(encoded.length)
        apb.append(encoded)
    }

    writeByte(0) //end of file

    if(saveData){
        await downloadFile(module.name + '.risum', apb.buffer)
    }
    if(alertEnd){
        alertNormal(language.successExport)
    }

    return apb.buffer
}
```

### Import 과정

```99:173:src/ts/process/modules.ts
export async function readModule(buf:Buffer):Promise<RisuModule> {
    let pos = 0

    const readLength = () => {
        const len = buf.readUInt32LE(pos)
        pos += 4
        return len
    }
    const readByte = () => {
        const byte = buf.readUInt8(pos)
        pos += 1
        return byte
    }
    const readData = (len:number) => {
        const data = buf.subarray(pos, pos + len)
        pos += len
        return data
    }

    if(readByte() !== 111){
        console.error("Invalid magic number")
        alertError(language.errors.noData)
        return
    }
    if(readByte() !== 0){ //Version check
        console.error("Invalid version")
        alertError(language.errors.noData)
        return
    }

    const mainLen = readLength()
    const mainData = readData(mainLen)
    const main:{
        type:'risuModule'
        module:RisuModule
    } = JSON.parse(Buffer.from(await decodeRPack(mainData)).toString())

    if(main.type !== 'risuModule'){
        console.error("Invalid module type")
        alertError(language.errors.noData)
        return
    }

    let module = main.module

    let i = 0
    while(true){
        const mark = readByte()
        if(mark === 0){
            break
        }
        if(mark !== 1){
            alertError(language.errors.noData)
            return
        }
        const len = readLength()
        const data = readData(len)
        module.assets[i][1] = await saveAsset(Buffer.from(await decodeRPack(data)))
        alertStore.set({
            type: 'wait',
            msg: `Loading... (Adding Assets ${i} / ${module.assets.length})`
        })
        if(!isTauri && !Capacitor.isNativePlatform() &&!isNodeServer){
            await sleep(100)
        }
        i++
    }
    alertStore.set({
        type: 'none',
        msg: ''
    })

    module.id = v4()
    return module
}
```

### 지원하는 Import 형식

모듈은 다음 형식으로도 Import할 수 있습니다:

1. **.risum 파일**: 바이너리 형식 (위에서 설명)
2. **JSON 파일 (type: 'risuModule')**: JSON 형식의 모듈 데이터
3. **JSON 파일 (type: 'risu')**: 레거시 로어북 형식 (자동 변환)
4. **외부 로어북 형식**: `entries` 필드가 있는 JSON (자동 변환)
5. **정규식 형식**: `type: 'regex'`인 JSON (정규식만 포함)

---

## .risup 파일 (프리셋 파일)

`.risup` 파일은 RisuAI 봇 프리셋(Bot Preset)을 저장하는 바이너리 형식입니다. 프리셋은 AI 모델 설정, 프롬프트 템플릿, 생성 파라미터 등을 포함합니다.

### 파일 구조

`.risup` 파일은 다음과 같은 구조를 가집니다:

1. **RPack 디코딩**: 먼저 RPack으로 압축 해제
2. **fflate 압축 해제**: fflate로 압축 해제
3. **MessagePack 디코딩**: MessagePack 형식 디코딩
4. **암호화 해제**: `risupreset` 키로 복호화
5. **최종 데이터**: MessagePack으로 다시 디코딩하여 프리셋 데이터 획득

### Export 과정

```2077:2123:src/ts/storage/database.svelte.ts
export async function downloadPreset(id:number, type:'json'|'risupreset'|'return' = 'json'){
    saveCurrentPreset()
    let db = getDatabase()
    let pres = safeStructuredClone(db.botPresets[id])
    console.log(pres)
    pres.openAIKey = ''
    pres.forceReplaceUrl = ''
    pres.forceReplaceUrl2 = ''
    pres.proxyKey = ''
    pres.textgenWebUIStreamURL=  ''
    pres.textgenWebUIBlockingURL=  ''

    if(type === 'json'){
        downloadFile(pres.name + "_preset.json", Buffer.from(JSON.stringify(pres, null, 2)))
    }
    else if(type === 'risupreset' || type === 'return'){
        const buf = fflate.compressSync(encodeMsgpack({
            presetVersion: 2,
            type: 'preset',
            preset: await encryptBuffer(
                encodeMsgpack(pres),
                'risupreset'
            )
        }))

        const buf2 = await encodeRPack(buf)

        if(type === 'risupreset'){
            downloadFile(pres.name + "_preset.risup", buf2)
        }
        else{
            return {
                data: pres,
                buf: buf2
            }
        }

    }

    alertNormal(language.successExport)


    return {
        data: pres,
        buf: null
    }
}
```

**보안 주의사항**: Export 시 민감한 정보(API 키, URL 등)는 자동으로 제거됩니다.

### Import 과정

```2126:2151:src/ts/storage/database.svelte.ts
export async function importPreset(f:{
    name:string
    data:Uint8Array
}|null = null){
    if(!f){
        f = await selectSingleFile(["json", "preset", "risupreset", "risup"])
    }
    if(!f){
        return
    }
    let pre:any
    if(f.name.endsWith('.risupreset') || f.name.endsWith('.risup')){
        let data = f.data
        if(f.name.endsWith('.risup')){
            data = await decodeRPack(data)
        }
        const decoded = await decodeMsgpack(fflate.decompressSync(data))
        console.log(decoded)
        if((decoded.presetVersion === 0 || decoded.presetVersion === 2) && decoded.type === 'preset'){
            pre = {...presetTemplate,...decodeMsgpack(Buffer.from(await decryptBuffer(decoded.preset ?? decoded.pres, 'risupreset')))}
        }
    }
    else{
        pre = {...presetTemplate,...(JSON.parse(Buffer.from(f.data).toString('utf-8')))}
        console.log(pre)
    }
```

### 지원하는 Import 형식

1. **.risup 파일**: RPack + fflate + MessagePack + 암호화 형식
2. **.risupreset 파일**: fflate + MessagePack + 암호화 형식 (RPack 없음)
3. **JSON 파일**: 일반 JSON 형식의 프리셋 데이터

---

## 모듈 활성화 및 사용

### 활성화 메커니즘

모듈은 다음 4가지 방법으로 활성화될 수 있습니다:

```291:315:src/ts/process/modules.ts
export function getModules(){
    const currentChat = getCurrentChat()
    const character = getCurrentCharacter()
    const db = getDatabase()
    let ids = db.enabledModules ?? []
    if (currentChat){
        ids = ids.concat(currentChat.modules ?? [])
    }
    if(character && character.modules){
        ids = ids.concat(character.modules)
    }
    if(db.moduleIntergration){
        const intList = db.moduleIntergration.split(',').map((s) => s.trim())
        ids = ids.concat(intList)
    }
    const idsJoined = ids.join('-')
    if(lastModules === idsJoined){
        return lastModuleData
    }

    let modules:RisuModule[] = getModuleByIds(ids)
    lastModules = idsJoined
    lastModuleData = modules
    return modules

}
```

1. **전역 활성화** (`db.enabledModules`): 데이터베이스 레벨에서 활성화된 모듈
2. **채팅별 활성화** (`currentChat.modules`): 특정 채팅에서만 활성화
3. **캐릭터별 활성화** (`character.modules`): 특정 캐릭터에서만 활성화
4. **통합 활성화** (`db.moduleIntergration`): 네임스페이스 기반 통합 (쉼표로 구분)

### 모듈 기능 사용

활성화된 모듈의 기능들은 다음과 같이 사용됩니다:

#### 1. 로어북 통합

```319:331:src/ts/process/modules.ts
export function getModuleLorebooks() {
    const modules = getModules()
    let lorebooks: loreBook[] = []
    for (const module of modules) {
        if(!module){
            continue
        }
        if (module.lorebook) {
            lorebooks = lorebooks.concat(module.lorebook)
        }
    }
    return lorebooks
}
```

#### 2. 정규식 스크립트 통합

```365:377:src/ts/process/modules.ts
export function getModuleRegexScripts() {
    const modules = getModules()
    let customscripts: customscript[] = []
    for (const module of modules) {
        if(!module){
            continue
        }
        if (module.regex) {
            customscripts = customscripts.concat(module.regex)
        }
    }
    return customscripts
}
```

#### 3. 트리거 통합

```348:363:src/ts/process/modules.ts
export function getModuleTriggers() {
    const modules = getModules()
    let triggers: triggerscript[] = []
    for (const module of modules) {
        if(!module){
            continue
        }
        if (module.trigger) {
            triggers = triggers.concat(module.trigger.map((t) => {
                t.lowLevelAccess = module.lowLevelAccess
                return t
            }))
        }
    }
    return triggers
}
```

#### 4. 에셋 통합

```333:345:src/ts/process/modules.ts
export function getModuleAssets() {
    const modules = getModules()
    let assets: [string,string,string][] = []
    for (const module of modules) {
        if(!module){
            continue
        }
        if (module.assets) {
            assets = assets.concat(module.assets)
        }
    }
    return assets
}
```

#### 5. MCP 통합

```393:397:src/ts/process/modules.ts
export function getModuleMcps() {
    const modules = getModules()

    return modules.map((v) => v.mcp?.url).filter((v) => v)
}
```

### 모듈 적용 (Apply Module)

모듈을 현재 캐릭터에 직접 병합할 수 있습니다:

```399:437:src/ts/process/modules.ts
export async function applyModule() {
    const sel = await alertModuleSelect()
    if (!sel) {
        return
    }

    const module = safeStructuredClone(getModuleById(sel))
    if (!module) {
        return
    }

    const currentChar = getCurrentCharacter()
    if (!currentChar) {
        return
    }
    if(currentChar.type === 'group'){
        return
    }

    if (module.lorebook) {
        for (const lore of module.lorebook) {
            currentChar.globalLore.push(lore)
        }
    }
    if (module.regex) {
        for (const regex of module.regex) {
            currentChar.customscript.push(regex)
        }
    }
    if (module.trigger) {
        for (const trigger of module.trigger) {
            currentChar.triggerscript.push(trigger)
        }
    }

    setCurrentCharacter(currentChar)

    alertNormal(language.successApplyModule)
}
```

**주의**: 그룹 채팅에는 적용할 수 없습니다.

### 모듈 업데이트

모듈이 변경되면 UI 상태를 업데이트합니다:

```441:472:src/ts/process/modules.ts
export function moduleUpdate(){


    const m = getModules()

    const ids = m.map((m) => m.id).join('-')
    
    let moduleHideIcon = false
    let backgroundEmbedding = ''
    m.forEach((module) => {
        if(!module){
            return
        }

        if(module.hideIcon){
            moduleHideIcon = true
        }
        if(module.backgroundEmbedding){
            backgroundEmbedding += '\n' + module.backgroundEmbedding + '\n'
        }
    })

    if(backgroundEmbedding){
        moduleBackgroundEmbedding.set(backgroundEmbedding)
    }
    HideIconStore.set(getCurrentCharacter()?.hideChatIcon || moduleHideIcon)

    if(lastModuleIds !== ids){
        ReloadGUIPointer.set(get(ReloadGUIPointer) + 1)
        lastModuleIds = ids
    }
}
```

---

## 모듈 제작 가이드

### 1. 기본 모듈 구조 생성

```typescript
import { v4 } from "uuid"
import type { RisuModule } from "src/ts/process/modules"

const myModule: RisuModule = {
    name: "내 모듈 이름",
    description: "모듈 설명",
    id: v4(),  // 고유 ID 생성
    // 선택적 필드들...
}
```

### 2. 로어북 추가

```typescript
import type { loreBook } from "src/ts/storage/database.svelte"

const lorebook: loreBook[] = [
    {
        keys: ["키워드1", "키워드2"],
        content: "로어북 내용",
        comment: "주석 (선택)",
        // 기타 필드...
    }
]

myModule.lorebook = lorebook
```

### 3. 정규식 스크립트 추가

```typescript
import type { customscript } from "src/ts/storage/database.svelte"

const regex: customscript[] = [
    {
        pattern: "정규식 패턴",
        replacement: "치환할 텍스트",
        mode: "editoutput",  // 또는 editinput, editdisplay 등
        // 기타 필드...
    }
]

myModule.regex = regex
```

### 4. 트리거 추가

```typescript
import type { triggerscript } from "src/ts/storage/database.svelte"

const triggers: triggerscript[] = [
    {
        name: "트리거 이름",
        conditions: [
            {
                type: "contains",
                value: "조건값"
            }
        ],
        effects: [
            {
                type: "modifychat",
                // 기타 효과...
            }
        ],
        mode: "output",  // 또는 input, start 등
        // 기타 필드...
    }
]

myModule.trigger = triggers
```

### 5. 에셋 추가

```typescript
// 에셋은 [이름, URL, 타입] 형식
myModule.assets = [
    ["에셋1", "https://example.com/image.png", "image"],
    ["에셋2", "https://example.com/audio.mp3", "audio"],
]
```

### 6. 모듈 Export

```typescript
import { exportModule } from "src/ts/process/modules"

// 모듈을 .risum 파일로 Export
await exportModule(myModule, {
    alertEnd: true,   // 완료 알림 표시
    saveData: true    // 파일 다운로드
})
```

### 7. JSON 형식으로 Export (대안)

```typescript
// JSON 형식으로 직접 저장
const jsonModule = {
    type: "risuModule",
    ...myModule
}

// 파일로 저장
downloadFile("myModule.json", Buffer.from(JSON.stringify(jsonModule, null, 2)))
```

---

## 프리셋 제작 가이드

### 1. 프리셋 데이터 구조

프리셋은 `botPreset` 인터페이스를 따릅니다. 주요 필드:

- `name`: 프리셋 이름
- `mainPrompt`: 메인 프롬프트
- `jailbreak`: 재일브레이크 프롬프트
- `temperature`: 생성 온도
- `maxContext`: 최대 컨텍스트 토큰
- `maxResponse`: 최대 응답 토큰
- `aiModel`: AI 모델 ID
- `formatingOrder`: 포맷팅 순서
- 기타 많은 설정 필드...

### 2. 프리셋 Export

```typescript
import { downloadPreset } from "src/ts/storage/database.svelte"

// 프리셋 ID로 Export
await downloadPreset(presetId, 'risupreset')  // .risup 파일
await downloadPreset(presetId, 'json')         // .json 파일
```

### 3. 프리셋 Import

```typescript
import { importPreset } from "src/ts/storage/database.svelte"

// 파일 선택 후 Import
await importPreset()

// 또는 직접 데이터 제공
await importPreset({
    name: "preset.risup",
    data: fileData
})
```

### 4. JSON 형식 프리셋 생성

```typescript
const preset = {
    name: "내 프리셋",
    mainPrompt: "시스템 프롬프트...",
    temperature: 0.7,
    maxContext: 4096,
    // ... 기타 설정
}

// JSON 파일로 저장
downloadFile("myPreset.json", Buffer.from(JSON.stringify(preset, null, 2)))
```

---

## 파일 형식 요약

### .risum (모듈 파일)
- **용도**: RisuAI 모듈 저장
- **형식**: 바이너리 (RPack 압축)
- **구조**: 매직 넘버 + 버전 + 메인 데이터 + 에셋들
- **대안**: JSON (type: 'risuModule')

### .risup (프리셋 파일)
- **용도**: RisuAI 봇 프리셋 저장
- **형식**: 바이너리 (RPack + fflate + MessagePack + 암호화)
- **보안**: 민감한 정보 자동 제거
- **대안**: JSON (일반 프리셋 형식)

### .risupreset (레거시 프리셋)
- **용도**: 구버전 프리셋 형식
- **형식**: fflate + MessagePack + 암호화 (RPack 없음)
- **호환성**: 버전 0, 2 지원

---

## 참고 사항

1. **보안**: 모듈에 `lowLevelAccess: true`가 설정되어 있으면 Import 시 사용자 확인이 필요합니다.

2. **네임스페이스**: 모듈의 `namespace` 필드를 사용하면 `moduleIntergration` 설정에서 네임스페이스로 활성화할 수 있습니다.

3. **캐싱**: `getModules()` 함수는 모듈 ID 조합을 캐싱하여 성능을 최적화합니다.

4. **에셋 처리**: Export 시 에셋은 이미지로 변환되어 RPack으로 압축됩니다.

5. **호환성**: JSON 형식으로도 Import/Export가 가능하므로, 개발 중에는 JSON 형식을 사용하는 것이 편리합니다.

---

## 관련 파일 위치

- 모듈 시스템: `src/ts/process/modules.ts`
- 프리셋 시스템: `src/ts/storage/database.svelte.ts` (downloadPreset, importPreset)
- 파일 Import: `src/ts/characterCards.ts` (characterURLImport)
- 모듈 사용: `src/ts/process/scripts.ts`, `src/ts/process/triggers.ts`

