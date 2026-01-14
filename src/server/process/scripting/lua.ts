/**
 * Lua 스크립팅 엔진
 * 원본: src/ts/process/scriptings.ts (Lua 부분만)
 * 서버 사이드에서 Lua 스크립트 실행
 */

import { LuaEngine, LuaFactory } from 'wasmoon';
import { getRedisService } from '../../redis-service';
import { getDatabaseAdapter } from '../../database-adapter';
import type { Database, character, Chat, triggerscript } from '../../database';
import { v4 as uuidv4 } from 'uuid';
import { Mutex } from '../../../ts/mutex';
import { risuChatParser, hasher } from '../../parser';
import type { RisuChatParserContext } from '../../parser/cbs-parser';
import type { MatcherContext } from '../../parser/cbs-matcher';
import type { BlockMatcherContext } from '../../parser/cbs-blocks';
import { tokenize } from '../../tokenizer';
import type { OpenAIChat } from '../types';
import type { TokenizerContext } from '../../tokenizer';
import { HypaProcessor } from '../memory/hypa-processor';
import { requestChatData } from '../request';
// TODO: 아래 함수들을 서버 사이드로 마이그레이션 필요
import { generateAIImage } from '../../../ts/process/stableDiff';
import { writeInlayImage, getInlayAsset } from '../auxiliary/file-processing';
import { getModuleLorebooks } from '../auxiliary/modules';
import { loadLoreBookV3Prompt, type LorebookLoadContext } from '../lorebook';
import { getPersonaPrompt, getUserName, getUserIcon } from '../../util';
import { readImage } from '../../util/image';
import { asBuffer } from '../../../ts/util';

interface LuaEngineState {
  code?: string;
  mutex: Mutex;
  engine?: LuaEngine;
  chat?: Chat;
  setVar?: (key: string, value: string) => void;
  getVar?: (key: string) => string;
}

let luaFactory: LuaFactory | null = null;
let luaFactoryPromise: Promise<void> | null = null;
const luaEngines = new Map<string, LuaEngineState>();
const pendingEngineCreations = new Map<string, Promise<LuaEngineState>>();

// 보안 ID 관리
const scriptingSafeIds = new Set<string>();
const scriptingEditDisplayIds = new Set<string>();
const scriptingLowLevelIds = new Set<string>();

// 요청 제한
let lastRequestResetTime = 0;
let lastRequestsCount = 0;

/**
 * Lua Factory 초기화
 */
async function makeLuaFactory(): Promise<void> {
  const _luaFactory = new LuaFactory();
  
  // json.lua 파일 로드
  async function mountFile(name: string): Promise<void> {
    let code = '';
    try {
      // 서버 환경에서는 public/lua/ 또는 static 파일에서 읽기
      for(let i = 0; i < 3; i++){
        try {
            const res = await fetch('/lua/' + name)
            if(res.status >= 200 && res.status < 300){
                code = await res.text()
                break
            }
        } catch (error) {}
      }
      await _luaFactory.mountFile(name, code);
    } catch (error) {
      console.error(`[Lua Service] Failed to mount file ${name}:`, error);
    }
  }

  await mountFile('json.lua');
  luaFactory = _luaFactory;
}

/**
 * Lua Factory 보장
 */
async function ensureLuaFactory(): Promise<void> {
  if (luaFactory) return;

  if (luaFactoryPromise) {
    try {
      await luaFactoryPromise;
    } catch (error) {
      luaFactoryPromise = null;
    }
    return;
  }

  try {
    luaFactoryPromise = makeLuaFactory();
    await luaFactoryPromise;
  } finally {
    luaFactoryPromise = null;
  }
}

/**
 * 엔진 상태 가져오기 또는 생성
 */
async function getOrCreateEngineState(
  userId: string,
  characterId: string,
  chatId: string,
  mode: string
): Promise<LuaEngineState> {
  const engineKey = `${userId}:${characterId}:${chatId}:${mode}`;

  let engineState = luaEngines.get(engineKey);
  if (engineState) {
    return engineState;
  }

  let pendingCreation = pendingEngineCreations.get(engineKey);
  if (pendingCreation) {
    return pendingCreation;
  }

  const creationPromise = (async () => {
    const engineState: LuaEngineState = {
      mutex: new Mutex(),
    };
    luaEngines.set(engineKey, engineState);
    pendingEngineCreations.delete(engineKey);
    return engineState;
  })();

  pendingEngineCreations.set(engineKey, creationPromise);
  return creationPromise;
}

/**
 * Lua 코드 래퍼
 */
function luaCodeWrapper(code: string): string {
  return `
json = require 'json'

function getChat(id, index)
    return json.decode(getChatMain(id, index))
end

function getFullChat(id)
    return json.decode(getFullChatMain(id))
end

function setFullChat(id, value)
    setFullChatMain(id, json.encode(value))
end

function log(value)
    logMain(json.encode(value))
end

function getLoreBooks(id, search)
    return json.decode(getLoreBooksMain(id, search))
end

function loadLoreBooks(id)
    return json.decode(loadLoreBooksMain(id):await())
end

function LLM(id, prompt, useMultimodal)
    useMultimodal = useMultimodal or false
    return json.decode(LLMMain(id, json.encode(prompt), useMultimodal):await())
end

function axLLM(id, prompt, useMultimodal)
    useMultimodal = useMultimodal or false
    return json.decode(axLLMMain(id, json.encode(prompt), useMultimodal):await())
end

function getCharacterImage(id)
    return getCharacterImageMain(id):await()
end

function getPersonaImage(id)
    return getPersonaImageMain(id):await()
end

local editRequestFuncs = {}
local editDisplayFuncs = {}
local editInputFuncs = {}
local editOutputFuncs = {}

function listenEdit(type, func)
    if type == 'editRequest' then
        editRequestFuncs[#editRequestFuncs + 1] = func
        return
    end

    if type == 'editDisplay' then
        editDisplayFuncs[#editDisplayFuncs + 1] = func
        return
    end

    if type == 'editInput' then
        editInputFuncs[#editInputFuncs + 1] = func
        return
    end

    if type == 'editOutput' then
        editOutputFuncs[#editOutputFuncs + 1] = func
        return
    end

    throw('Invalid type')
end

function getState(id, name)
    local escapedName = "__"..name
    return json.decode(getChatVar(id, escapedName))
end

function setState(id, name, value)
    local escapedName = "__"..name
    setChatVar(id, escapedName, json.encode(value))
end

function async(callback)
    return function(...)
        local co = coroutine.create(callback)
        local safe, result = coroutine.resume(co, ...)

        return Promise.create(function(resolve, reject)
            local checkresult
            local step = function()
                if coroutine.status(co) == "dead" then
                    local send = safe and resolve or reject
                    return send(result)
                end

                safe, result = coroutine.resume(co)
                checkresult()
            end

            checkresult = function()
                if safe and result == Promise.resolve(result) then
                    result:finally(step)
                else
                    step()
                end
            end

            checkresult()
        end)
    end
end

callListenMain = async(function(type, id, value, meta)
    local realValue = json.decode(value)
    local realMeta = json.decode(meta)

    if type == 'editRequest' then
        for _, func in ipairs(editRequestFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    if type == 'editDisplay' then
        for _, func in ipairs(editDisplayFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    if type == 'editInput' then
        for _, func in ipairs(editInputFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    if type == 'editOutput' then
        for _, func in ipairs(editOutputFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    return json.encode(realValue)
end)

${code}
`;
}

/**
 * 서버 사이드 Lua 스크립트 실행
 */
export async function runScripted(
  code: string,
  arg: {
    userId: string;
    characterId: string;
    chatId: string;
    char?: character;
    chat?: Chat;
    data?: string | OpenAIChat[];
    setVar?: (key: string, value: string) => void;
    getVar?: (key: string) => string;
    lowLevelAccess?: boolean;
    meta?: object;
    mode?: string;
    database?: Database;
    tokenizerContext?: TokenizerContext;
  }
): Promise<{ stopSending: boolean; chat?: Chat; res?: any }> {
  await ensureLuaFactory();

  const {
    userId,
    characterId,
    chatId,
    char,
    chat,
    data = '',
    setVar,
    getVar,
    lowLevelAccess = false,
    meta = {},
    mode = 'manual',
    database,
    tokenizerContext,
  } = arg;

  const redis = getRedisService();
  const db = getDatabaseAdapter();

  // Parser contexts 생성
  const dbData = database || (await db.loadUserDatabase(userId));
  const parserContexts = {
    parser: {
      getDatabase: () => dbData,
      getSelectedCharID: () => 0, // TODO: 실제 선택된 캐릭터 ID 가져오기
      findCharacterbyId: (id: string) => {
        return dbData.characters?.find(c => c.chaId === id && c.type !== 'group') || null;
      },
    },
    matcher: {
      calcString: (str: string) => {
        // TODO: 서버 사이드 calcString 구현
        const { calcString } = require('../../../ts/process/infunctions');
        return calcString(str);
      },
      getMatcherMap: () => {
        // TODO: 서버 사이드 getMatcherMap 구현
        const { getMatcherMap } = require('../../../ts/cbs');
        return getMatcherMap();
      },
      initMatcher: () => {
        // TODO: 서버 사이드 initMatcher 구현
        const { initMatcher } = require('../../../ts/cbs');
        initMatcher();
      },
    },
    block: {
      getChatVar: (key: string) => {
        return chat?.localVars?.[key] || '';
      },
      getGlobalChatVar: (key: string) => {
        return dbData.globalVars?.[key] || '';
      },
    },
  };

  // Redis에서 스크립트 변수 가져오기
  const scriptVars = await redis.getScriptVars(userId, characterId, chatId) || {};

  // setVar/getVar 기본 구현
  const defaultSetVar = async (key: string, value: string) => {
    scriptVars[key] = value;
    await redis.setScriptVars(userId, characterId, chatId, scriptVars);
  };

  const defaultGetVar = (key: string) => {
    return scriptVars[key] || '';
  };

  const finalSetVar = setVar || defaultSetVar;
  const finalGetVar = getVar || defaultGetVar;

  // 채팅 데이터 로드
  let chatData = chat;
  if (!chatData && chatId) {
    chatData = await db.loadChat(userId, chatId);
  }

  if (!chatData) {
    throw new Error('Chat not found');
  }

  // 데이터베이스 로드
  let dbData = database;
  if (!dbData) {
    dbData = await db.loadDatabase(userId);
  }

  const engineState = await getOrCreateEngineState(userId, characterId, chatId, mode);

  return await engineState.mutex.runExclusive(async () => {
    engineState.chat = chatData;
    engineState.setVar = finalSetVar;
    engineState.getVar = finalGetVar;

    let stopSending = false;

    // 코드가 변경되었으면 새 엔진 생성
    if (code !== engineState.code) {
      console.log('[Lua Service] Creating new Lua engine for mode:', mode);
      engineState.engine?.global.close();
      engineState.code = code;
      engineState.engine = await luaFactory!.createEngine({ injectObjects: true });

      const luaEngine = engineState.engine;

      // API 함수 등록
      const declareAPI = (name: string, func: Function) => {
        luaEngine.global.set(name, func);
      };

      // 기본 API 함수들
      declareAPI('getChatVar', (id: string, key: string) => {
        return engineState.getVar!(key);
      });

      declareAPI('setChatVar', (id: string, key: string, value: string) => {
        if (!scriptingSafeIds.has(id) && !scriptingEditDisplayIds.has(id)) {
          return;
        }
        engineState.setVar!(key, value);
      });

      declareAPI('getGlobalVar', (id: string, key: string) => {
        // 전역 변수는 Redis에서 관리
        return '';
      });

      declareAPI('stopChat', (id: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        stopSending = true;
      });

      // Alert 함수들 (서버에서는 로깅으로 대체)
      declareAPI('alertError', (id: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        console.error('[Lua Alert Error]', value);
      });

      declareAPI('alertNormal', (id: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        console.log('[Lua Alert]', value);
      });

      declareAPI('alertInput', (id: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        // 서버에서는 입력을 반환할 수 없으므로 빈 문자열 반환
        console.log('[Lua Alert Input]', value);
        return '';
      });

      declareAPI('alertSelect', (id: string, value: string[]) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        // 서버에서는 첫 번째 옵션 반환
        console.log('[Lua Alert Select]', value);
        return value[0] || '';
      });

      declareAPI('alertConfirm', (id: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        // 서버에서는 기본적으로 false 반환
        console.log('[Lua Alert Confirm]', value);
        return Promise.resolve(false);
      });

      declareAPI('getChatMain', (id: string, index: number) => {
        const message = engineState.chat?.message?.at(index);
        if (!message) {
          return JSON.stringify(null);
        }
        const data = {
          role: message.role,
          data: message.data,
          time: message.time ?? 0,
        };
        return JSON.stringify(data);
      });

      declareAPI('setChat', (id: string, index: number, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        const message = engineState.chat?.message?.at(index);
        if (message) {
          message.data = value ?? '';
        }
      });

      declareAPI('setChatRole', (id: string, index: number, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        const message = engineState.chat?.message?.at(index);
        if (message) {
          message.role = value === 'user' ? 'user' : 'char';
        }
      });

      declareAPI('cutChat', (id: string, start: number, end: number) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (engineState.chat?.message) {
          engineState.chat.message = engineState.chat.message.slice(start, end);
        }
      });

      declareAPI('removeChat', (id: string, index: number) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        engineState.chat?.message.splice(index, 1);
      });

      declareAPI('addChat', (id: string, role: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        const roleData: 'user' | 'char' = role === 'user' ? 'user' : 'char';
        engineState.chat?.message.push({ role: roleData, data: value ?? '' });
      });

      declareAPI('insertChat', (id: string, index: number, role: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        const roleData: 'user' | 'char' = role === 'user' ? 'user' : 'char';
        engineState.chat?.message.splice(index, 0, { role: roleData, data: value ?? '' });
      });

      declareAPI('getTokens', async (id: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!tokenizerContext) {
          throw new Error('TokenizerContext is required');
        }
        return await tokenize(value, tokenizerContext);
      });

      declareAPI('getChatLength', (id: string) => {
        return engineState.chat?.message.length || 0;
      });

      declareAPI('getFullChatMain', (id: string) => {
        const data = JSON.stringify(
          (engineState.chat?.message || []).map((v) => ({
            role: v.role,
            data: v.data,
            time: v.time ?? 0,
          }))
        );
        return data;
      });

      declareAPI('setFullChatMain', (id: string, value: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        const realValue = JSON.parse(value);
        if (engineState.chat?.message) {
          engineState.chat.message = realValue.map((v: any) => ({
            role: v.role,
            data: v.data,
          }));
        }
      });

      declareAPI('sleep', (id: string, time: number) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, time);
        });
      });

      declareAPI('cbs', (value: string) => {
        return risuChatParser(value, { chara: char }, parserContexts);
      });

      declareAPI('logMain', (value: string) => {
        console.log('[Lua]', JSON.parse(value));
      });

      // reloadDisplay, reloadChat은 서버에서는 불필요 (UI 전용)
      declareAPI('reloadDisplay', (id: string) => {
        // 서버에서는 아무 작업도 하지 않음
      });

      declareAPI('reloadChat', (id: string, index: number) => {
        // 서버에서는 아무 작업도 하지 않음
      });

      // Low Level Access API
      declareAPI('similarity', async (id: string, source: string, value: string[]) => {
        if (!scriptingLowLevelIds.has(id)) {
          return;
        }
        if (!dbData) {
          throw new Error('Database is required');
        }
        const processer = new HypaProcessor('auto', undefined, userId, chatId, dbData);
        await processer.addText(value, dbData);
        return await processer.similaritySearch(source);
      });

      declareAPI('request', async (id: string, url: string) => {
        if (!scriptingLowLevelIds.has(id)) {
          return;
        }

        // 요청 제한 체크
        if (lastRequestResetTime + 60000 < Date.now()) {
          lastRequestsCount = 0;
          lastRequestResetTime = Date.now();
        }

        if (lastRequestsCount > 5) {
          return JSON.stringify({
            status: 429,
            data: 'Too many requests. you can request 5 times per minute',
          });
        }

        lastRequestsCount++;

        try {
          if (url.length > 120) {
            return JSON.stringify({
              status: 413,
              data: 'URL too large. max is 120 characters',
            });
          }

          if (!url.startsWith('https://')) {
            return JSON.stringify({
              status: 400,
              data: 'Only https requests are allowed',
            });
          }

          const bannedURL = ['https://realm.risuai.net', 'https://risuai.net', 'https://risuai.xyz'];

          for (const burl of bannedURL) {
            if (url.startsWith(burl)) {
              return JSON.stringify({
                status: 400,
                data: 'request to ' + url + ' is not allowed',
              });
            }
          }

          const response = await fetch(url, { method: 'GET' });
          const text = await response.text();
          return JSON.stringify({
            status: response.status,
            data: text,
          });
        } catch (error) {
          return JSON.stringify({
            status: 400,
            data: 'internal error',
          });
        }
      });

      declareAPI('generateImage', async (id: string, value: string, negValue: string = '') => {
        if (!scriptingLowLevelIds.has(id)) {
          return;
        }
        if (!char || char.type !== 'character') {
          return 'Error: Character is a group or invalid';
        }
        // TODO: 서버 사이드 이미지 생성 구현
        const gen = await generateAIImage(value, char, negValue, 'inlay');
        if (!gen) {
          return 'Error: Image generation failed';
        }
        // 서버에서는 이미지 URL 또는 ID 반환
        return `{{inlay::${gen}}}`;
      });

      declareAPI('getCharacterImageMain', async (id: string) => {
        try {
          if (!char || char.type === 'group' || !char.image) {
            return '';
          }
          
          const img = await readImage(char.image);
          const imgObj = new Image();
          const extention = char.image.split('.').at(-1);

          imgObj.src = URL.createObjectURL(new Blob([asBuffer(img)], {type: `image/${extention}`}));

          const imgid = await writeInlayImage(imgObj, { name: char.image, ext: extention, id: char.image});

          if (imgid) {
            return `{{inlayed::${imgid}}}`;
          }
          console.warn('Failed to create character image inlay');
          return '';
        } catch (error) {
          console.error('Error in getCharacterImageMain:', error);
          return '';
        }
      });

      declareAPI('getPersonaImageMain', async (id: string) => {
        try {
          const icon = getUserIcon();

          if(!icon) {
            return '';
          }

          const img = await readImage(icon);
          const extention = icon.split('.').at(-1) || 'png';

          const imgid = await writeInlayImage(img, { name: icon, ext: extention, id: icon }, userId);

          if (imgid) {
            return `{{inlayed::${imgid}}}`;
          }
          
          console.warn('Failed to create persona image inlay');
          return '';
        } catch (error) {
          console.error('Error in getPersonaImageMain:', error);
          return '';
        }
      });

      declareAPI('hash', async (id: string, value: string) => {
        return await hasher(new TextEncoder().encode(value));
      });

      // LLM API
      declareAPI('LLMMain', async (id: string, promptStr: string, useMultimodal: boolean = false) => {
        if (!scriptingLowLevelIds.has(id)) {
          return;
        }
        if (!dbData) {
          throw new Error('Database is required');
        }

        let prompt: {
          role: string;
          content: string;
        }[] = JSON.parse(promptStr);

        let promptbody: OpenAIChat[] = prompt.map((dict) => {
          let role: 'system' | 'user' | 'assistant' = 'assistant';
          switch (dict['role']) {
            case 'system':
            case 'sys':
              role = 'system';
              break;
            case 'user':
              role = 'user';
              break;
            case 'assistant':
            case 'bot':
            case 'char': {
              role = 'assistant';
              break;
            }
          }

          return {
            content: dict['content'] ?? '',
            role: role,
          };
        });

        if (useMultimodal) {
          for (const msg of promptbody) {
            const inlays: string[] = [];
            msg.content = msg.content.replace(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g, (
              match: string,
              p1: string,
              p2: string
            ) => {
              if (msg.role === 'assistant') {
                if (p2 && p1 === 'inlayeddata') {
                  inlays.push(p2);
                }
              } else {
                if (p2) {
                  inlays.push(p2);
                }
              }
              return '';
            });
            
            const multimodals: any[] = [];
            for (const inlay of inlays) {
              const inlayData = await getInlayAsset(userId, inlay);
              multimodals.push({
                type: inlayData?.type,
                base64: inlayData?.data,
                width: inlayData?.width,
                height: inlayData?.height,
              });
            }

            msg.multimodals = multimodals.length > 0 ? multimodals : undefined;
          }
        }

        const result = await requestChatData(
          {
            formated: promptbody,
            bias: {},
            useStreaming: false,
            noMultiGen: true,
          },
          'model',
          dbData,
          null,
          userId
        );

        if (result.type === 'fail') {
          return JSON.stringify({
            success: false,
            result: 'Error: ' + result.result,
          });
        }

        if (result.type === 'streaming' || result.type === 'multiline') {
          return JSON.stringify({
            success: false,
            result: result.result,
          });
        }

        return JSON.stringify({
          success: true,
          result: result.result,
        });
      });

      declareAPI('simpleLLM', async (id: string, prompt: string) => {
        if (!scriptingLowLevelIds.has(id)) {
          return;
        }
        if (!dbData) {
          throw new Error('Database is required');
        }

        const result = await requestChatData(
          {
            formated: [{
              role: 'user',
              content: prompt,
            }],
            bias: {},
            useStreaming: false,
            noMultiGen: true,
          },
          'model',
          dbData,
          null,
          userId
        );

        if (result.type === 'fail') {
          return {
            success: false,
            result: 'Error: ' + result.result,
          };
        }

        if (result.type === 'streaming' || result.type === 'multiline') {
          return {
            success: false,
            result: result.result,
          };
        }

        return {
          success: true,
          result: result.result,
        };
      });

      // 캐릭터 정보 API
      declareAPI('getName', (id: string) => {
        return char?.name || '';
      });

      declareAPI('setName', (id: string, name: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!char || typeof name !== 'string') {
          throw 'Invalid data type';
        }
        char.name = name;
        // TODO: 데이터베이스에 저장
      });

      declareAPI('getDescription', (id: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!char || char.type !== 'character') {
          throw 'Character is a group or invalid';
        }
        return char.desc || '';
      });

      declareAPI('setDescription', (id: string, desc: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!char || typeof desc !== 'string') {
          throw 'Invalid data type';
        }
        if (char.type === 'group') {
          throw 'Character is a group';
        }
        char.desc = desc;
        // TODO: 데이터베이스에 저장
      });

      declareAPI('getCharacterFirstMessage', (id: string) => {
        return char?.firstMessage || '';
      });

      declareAPI('setCharacterFirstMessage', (id: string, data: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!char || typeof data !== 'string') {
          return false;
        }
        char.firstMessage = data;
        // TODO: 데이터베이스에 저장
        return true;
      });

      declareAPI('getPersonaName', (id: string) => {
        return getUserName();
      });

      declareAPI('getPersonaDescription', (id: string) => {
        if (!char) {
          return '';
        }
        return risuChatParser(getPersonaPrompt(), { chara: char }, parserContexts);
      });

      declareAPI('getAuthorsNote', (id: string) => {
        return engineState.chat?.note ?? '';
      });

      declareAPI('getBackgroundEmbedding', (id: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!char || char.type !== 'character') {
          return '';
        }
        return char.backgroundHTML || '';
      });

      declareAPI('setBackgroundEmbedding', (id: string, data: string) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }
        if (!char || typeof data !== 'string') {
          return false;
        }
        if (char.type !== 'character') {
          return false;
        }
        char.backgroundHTML = data;
        // TODO: 데이터베이스에 저장
        return true;
      });

      // Lorebook API
      declareAPI('getLoreBooksMain', (id: string, search: string) => {
        if (!char || char.type !== 'character') {
          return JSON.stringify([]);
        }

        const loreBooks = [
          ...(engineState.chat?.localLore ?? []),
          ...(char.globalLore ?? []),
          ...(getModuleLorebooks(dbData, char, engineState.chat) || []),
        ];
        const found = loreBooks.filter((b) => b.comment === search);

        return JSON.stringify(found.map((b) => ({ ...b, content: risuChatParser(b.content, { chara: char }, parserContexts) })));
      });

      declareAPI('upsertLocalLoreBook', (
        id: string,
        name: string,
        content: string,
        options: {
          alwaysActive?: boolean;
          insertOrder?: number;
          key?: string;
          secondKey?: string;
          regex?: boolean;
        } = {}
      ) => {
        if (!scriptingSafeIds.has(id)) {
          return;
        }

        if (!char || char.type !== 'character') {
          return;
        }

        const {
          alwaysActive = false,
          insertOrder = 100,
          key = '',
          regex = false,
          secondKey = '',
        } = options;

        if (!engineState.chat) {
          return;
        }

        const newLocalLoreBooks = (engineState.chat.localLore || []).filter((book) => book.comment !== name);
        newLocalLoreBooks.push({
          alwaysActive,
          comment: name,
          content: content,
          insertorder: insertOrder,
          mode: 'normal',
          key,
          secondkey: secondKey,
          selective: !!secondKey,
          useRegex: regex,
        });
        engineState.chat.localLore = newLocalLoreBooks;
        // TODO: 데이터베이스에 저장
      });

      declareAPI('loadLoreBooksMain', async (id: string, reserve: number) => {
        if (!scriptingLowLevelIds.has(id)) {
          return JSON.stringify([]);
        }
        if (!dbData || !char || char.type !== 'character' || !engineState.chat) {
          return JSON.stringify([]);
        }

        const lorebookContext: LorebookLoadContext = {
          character: char,
          chat: engineState.chat!,
          database: dbData,
          tokenizerContext: tokenizerContext!,
          getChatVar: finalGetVar,
          setChatVar: finalSetVar,
          findCharacterbyId: async (id: string) => {
            // TODO: 캐릭터 찾기 구현
            return null;
          },
        };
        const fullLoreBooks = (await loadLoreBookV3Prompt(lorebookContext)).actives;

        const maxContext = dbData.maxContext - reserve;
        if (maxContext < 0) {
          return JSON.stringify([]);
        }

        let totalTokens = 0;
        const loreBooks: any[] = [];

        for (const book of fullLoreBooks) {
          const parsed = risuChatParser(book.prompt, { chara: char }, parserContexts).trim();
          if (parsed.length === 0) {
            continue;
          }

          if (!tokenizerContext) {
            continue;
          }
          const tokens = await tokenize(parsed, tokenizerContext);

          if (totalTokens + tokens > maxContext) {
            break;
          }
          totalTokens += tokens;
          loreBooks.push({
            data: parsed,
            role: book.role === 'assistant' ? 'char' : book.role,
          });
        }

        return JSON.stringify(loreBooks);
      });

      declareAPI('axLLMMain', async (id: string, promptStr: string, useMultimodal: boolean = false) => {
        if (!scriptingLowLevelIds.has(id)) {
          return;
        }
        if (!dbData) {
          throw new Error('Database is required');
        }

        let prompt: {
          role: string;
          content: string;
        }[] = JSON.parse(promptStr);

        let promptbody: OpenAIChat[] = prompt.map((dict) => {
          let role: 'system' | 'user' | 'assistant' = 'assistant';
          switch (dict['role']) {
            case 'system':
            case 'sys':
              role = 'system';
              break;
            case 'user':
              role = 'user';
              break;
            case 'assistant':
            case 'bot':
            case 'char': {
              role = 'assistant';
              break;
            }
          }

          return {
            content: dict['content'] ?? '',
            role: role,
          };
        });

        if (useMultimodal) {
          for (const msg of promptbody) {
            const inlays: string[] = [];
            msg.content = msg.content.replace(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g, (
              match: string,
              p1: string,
              p2: string
            ) => {
              if (msg.role === 'assistant') {
                if (p2 && p1 === 'inlayeddata') {
                  inlays.push(p2);
                }
              } else {
                if (p2) {
                  inlays.push(p2);
                }
              }
              return '';
            });
            
            const multimodals: any[] = [];
            for (const inlay of inlays) {
              const inlayData = await getInlayAsset(userId, inlay);
              multimodals.push({
                type: inlayData?.type,
                base64: inlayData?.data,
                width: inlayData?.width,
                height: inlayData?.height,
              });
            }

            msg.multimodals = multimodals.length > 0 ? multimodals : undefined;
          }
        }

        const result = await requestChatData(
          {
            formated: promptbody,
            bias: {},
            useStreaming: false,
            noMultiGen: true,
          },
          'otherAx',
          dbData,
          null,
          userId
        );

        if (result.type === 'fail') {
          return JSON.stringify({
            success: false,
            result: 'Error: ' + result.result,
          });
        }

        if (result.type === 'streaming' || result.type === 'multiline') {
          return JSON.stringify({
            success: false,
            result: result.result,
          });
        }

        return JSON.stringify({
          success: true,
          result: result.result,
        });
      });

      declareAPI('getCharacterLastMessage', (id: string) => {
        const chat = engineState.chat;
        if (!chat) {
          return char?.firstMessage || '';
        }

        let pointer = chat.message.length - 1;
        while (pointer >= 0) {
          if (chat.message[pointer].role === 'char') {
            return chat.message[pointer].data;
          }
          pointer--;
        }

        return char?.firstMessage || '';
      });

      declareAPI('getUserLastMessage', (id: string) => {
        const chat = engineState.chat;
        if (!chat) {
          return '';
        }

        let pointer = chat.message.length - 1;
        while (pointer >= 0) {
          if (chat.message[pointer].role === 'user') {
            return chat.message[pointer].data;
          }
          pointer--;
        }

        return '';
      });

      // Lua 코드 실행
      await luaEngine.doString(luaCodeWrapper(code));
      engineState.code = code;
    }

    // 접근 키 생성
    const accessKey = uuidv4();
    if (mode === 'editDisplay') {
      scriptingEditDisplayIds.add(accessKey);
    } else {
      scriptingSafeIds.add(accessKey);
      if (lowLevelAccess) {
        scriptingLowLevelIds.add(accessKey);
      }
    }

    let res: any;
    const luaEngine = engineState.engine!;

    try {
      switch (mode) {
        case 'input': {
          const func = luaEngine.global.get('onInput');
          if (func) {
            res = await func(accessKey);
          }
          break;
        }
        case 'output': {
          const func = luaEngine.global.get('onOutput');
          if (func) {
            res = await func(accessKey);
          }
          break;
        }
        case 'start': {
          const func = luaEngine.global.get('onStart');
          if (func) {
            res = await func(accessKey);
          }
          break;
        }
        case 'onButtonClick': {
          const func = luaEngine.global.get('onButtonClick');
          if (func) {
            res = await func(accessKey, data);
          }
          break;
        }
        case 'editRequest':
        case 'editDisplay':
        case 'editInput':
        case 'editOutput': {
          const func = luaEngine.global.get('callListenMain');
          if (func) {
            res = await func(mode, accessKey, JSON.stringify(data), JSON.stringify(meta));
            res = JSON.parse(res);
          }
          break;
        }
        default: {
          const func = luaEngine.global.get(mode);
          if (func) {
            res = await func(accessKey);
          }
          break;
        }
      }

      if (res === false) {
        stopSending = true;
      }
    } catch (error) {
      console.error('[Lua Service] Error executing script:', error);
    }

    // 접근 키 제거
    scriptingSafeIds.delete(accessKey);
    scriptingLowLevelIds.delete(accessKey);
    scriptingEditDisplayIds.delete(accessKey);

    // 스크립트 변수 저장
    if (scriptVars && Object.keys(scriptVars).length > 0) {
      await redis.setScriptVars(userId, characterId, chatId, scriptVars);
    }

    return {
      stopSending,
      chat: engineState.chat,
      res,
    };
  });
}

/**
 * 트리거 스크립트 실행 (edit 모드)
 */
export async function runLuaEditTrigger<T extends string | OpenAIChat[]>(
  userId: string,
  characterId: string,
  chatId: string,
  char: character,
  mode: string,
  content: T,
  meta?: object,
  database?: Database,
  tokenizerContext?: TokenizerContext
): Promise<T> {
  switch (mode) {
    case 'editinput':
      mode = 'editInput';
      break;
    case 'editoutput':
      mode = 'editOutput';
      break;
    case 'editdisplay':
      mode = 'editDisplay';
      break;
    case 'editprocess':
      return content;
  }

  try {
    let data = content;

    // 트리거 스크립트 가져오기
    const triggers = (char.triggerscript || []).filter((t) => t.effect?.[0]?.type === 'triggerlua');

    for (const trigger of triggers) {
      if (trigger?.effect?.[0]?.type === 'triggerlua') {
        const runResult = await runScripted(trigger.effect[0].code, {
          userId,
          characterId,
          chatId,
          char,
          lowLevelAccess: false,
          mode: mode,
          data,
          meta,
          database,
          tokenizerContext,
        });
        data = (runResult.res ?? data) as T;
      }
    }

    return data;
  } catch (error) {
    console.error('[Lua Service] Error in runLuaEditTrigger:', error);
    return content;
  }
}

/**
 * 버튼 클릭 트리거 실행
 */
export async function runLuaButtonTrigger(
  userId: string,
  characterId: string,
  chatId: string,
  char: character,
  data: string,
  database?: Database,
  tokenizerContext?: TokenizerContext
): Promise<any> {
  let runResult;
  try {
    const triggers = (char.triggerscript || []).filter((t) => t.effect?.[0]?.type === 'triggerlua');

    for (const trigger of triggers) {
      if (trigger?.effect?.[0]?.type === 'triggerlua') {
        runResult = await runScripted(trigger.effect[0].code, {
          userId,
          characterId,
          chatId,
          char,
          lowLevelAccess: trigger.lowLevelAccess || false,
          mode: 'onButtonClick',
          data: data,
          database,
          tokenizerContext,
        });
      }
    }
  } catch (error) {
    console.error('[Lua Service] Error in runLuaButtonTrigger:', error);
    throw error;
  }
  return runResult;
}

/**
 * Lua 엔진 정리
 */
export async function cleanupLuaEngines(): Promise<void> {
  for (const [mode, engineState] of luaEngines.entries()) {
    try {
      await engineState.mutex.runExclusive(async () => {
        engineState.engine?.global.close();
      });
    } catch (error) {
      console.error(`[Lua Service] Error cleaning up engine ${mode}:`, error);
    }
  }
  luaEngines.clear();
  pendingEngineCreations.clear();
}
