/**
 * Database 어댑터
 * Prisma 모델을 Database 인터페이스 형태로 변환
 * Redis 캐시와 통합하여 빠른 데이터 접근 제공
 */

import { PrismaClient } from '../generated/prisma/client.js';
import type { Database, character } from './database';
import { getRedisService } from './redis-service';
import prisma from '../lib/prisma';

export class DatabaseAdapter {
  private redis = getRedisService();

  /**
   * 초기화
   */
  async initialize(): Promise<void> {
    await this.redis.connect();
  }

  /**
   * 사용자 데이터 로드 (Redis 우선, DB 조회 후 캐시)
   */
  async loadUserDatabase(userId: string): Promise<Database> {
    // Redis에서 먼저 조회
    const cached = await this.redis.getSessionData(userId, 'main');
    if (cached) {
      return cached;
    }

    // DB에서 조회
    const [user, characters, chats, lorebooks] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          userSettings: true,
          persona: true,
        },
      }),
      prisma.character.findMany({
        where: { userId },
        orderBy: { lastInteractionAt: 'desc' },
      }),
      prisma.chat.findMany({
        where: { userId },
        include: { 
          messages: {
            orderBy: { time: 'asc' }
          }
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.lorebook.findMany({
        where: { userId },
      }),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    // Database 인터페이스 형태로 변환
    const database = this.transformToDatabaseInterface(
      user,
      user?.userSettings || null,
      user?.persona || null,
      characters,
      chats,
      lorebooks
    );

    // Redis에 캐시
    await this.redis.setSessionData(userId, 'main', database);

    return database;
  }

  /**
   * Prisma 모델을 Database 인터페이스로 변환
   */
  private transformToDatabaseInterface(
    user: any,
    userSettings: any,
    persona: any,
    characters: any[],
    chats: any[],
    lorebooks: any[]
  ): Database {
    const settings = userSettings || {};
    const advancedSettings = (settings.customSettings as any) || {};

    // 기본 Database 구조 생성
    const database: Database = {
      // 사용자 기본 정보
      username: settings.username || user.username || 'User',
      userIcon: settings.userIconUrl || user.avatarUrl || '',
      userNote: settings.userNote || '',
      language: settings.language || 'en',
      didFirstSetup: user.isActive,

      // 캐릭터
      characters: characters.map((char) => this.transformCharacter(char)),
      characterOrder: characters.map((char) => char.chaId),

      // 채팅 (간단한 형태로 변환)
      chats: chats.map((chat) => ({
        id: chat.id,
        characterId: chat.characterId,
        messages: chat.messages || [],
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })),

      // 로어북
      loreBook: lorebooks.map((lb) => ({
        name: lb.name,
        data: lb.entries || [],
      })),

      // 페르소나
      persona: persona ? {
        personaPrompt: persona.personaPrompt || '',
        name: persona.name || '',
        icon: persona.iconUrl || '',
        largePortrait: persona.largePortrait || false,
        id: persona.id,
        note: persona.note || '',
      } : null,
      personaPrompt: persona?.personaPrompt || '',

      // UI 설정
      theme: settings.theme || 'default',
      zoomsize: advancedSettings.zoomsize || 100,
      iconsize: advancedSettings.iconsize || 100,
      textTheme: advancedSettings.textTheme || 'standard',
      customTextTheme: advancedSettings.customTextTheme || {},
      customBackground: advancedSettings.customBackground || '',

      // 고급 설정 (advancedSettings에 모든 나머지 설정 포함)
      ...this.mapAdvancedSettings(advancedSettings),

      // 기본값들
      apiType: advancedSettings.apiType || 'gemini-3-flash-preview',
      aiModel: advancedSettings.aiModel || 'gemini-3-flash-preview',
      subModel: advancedSettings.subModel || '',
      temperature: advancedSettings.temperature || 80,
      maxContext: advancedSettings.maxContext || 4000,
      maxResponse: advancedSettings.maxResponse || 500,
      frequencyPenalty: advancedSettings.frequencyPenalty || 70,
      PresensePenalty: advancedSettings.presencePenalty || 70,
      mainPrompt: advancedSettings.mainPrompt || '',
      jailbreak: advancedSettings.jailbreak || '',
      globalNote: advancedSettings.globalNote || '',
      loreBookDepth: advancedSettings.loreBookDepth || 5,
      loreBookToken: advancedSettings.loreBookToken || 800,
      loreBookPage: advancedSettings.loreBookPage || 0,
      supaMemoryPrompt: advancedSettings.supaMemoryPrompt || '',
      autoTranslate: advancedSettings.autoTranslate || false,
      swipe: advancedSettings.swipe !== undefined ? advancedSettings.swipe : true,
      sendWithEnter: advancedSettings.sendWithEnter !== undefined ? advancedSettings.sendWithEnter : true,
      clickToEdit: advancedSettings.clickToEdit || false,
    } as Database;

    return database;
  }

  /**
   * Character 모델을 Database 인터페이스로 변환
   */
  private transformCharacter(char: any): character {
    return {
      chaId: char.chaId,
      name: char.name,
      description: char.description || '',
      personality: char.personality || '',
      scenario: char.scenario || '',
      firstMessage: char.firstMessage || '',
      notes: char.notes || '',
      creatorNotes: char.creatorNotes || '',
      systemPrompt: char.systemPrompt || '',
      postHistoryInstructions: char.postHistoryInstructions || '',
      exampleMessage: char.exampleMessage || '',
      additionalText: char.additionalText || '',
      replaceGlobalNote: char.replaceGlobalNote || '',
      translatorNote: char.translatorNote || '',
      imageUrl: char.imageUrl || '',
      characterVersion: char.characterVersion || '',
      creator: char.creator || '',
      tags: char.tags || [],
      license: char.license || '',
      isPrivate: char.isPrivate,
      isPublished: char.isPublished,
      viewScreen: char.viewScreen || 'none',
      utilityBot: char.utilityBot || false,
      ttsMode: char.ttsMode || '',
      ttsSpeech: char.ttsSpeech || '',
      ttsReadOnlyQuoted: char.ttsReadOnlyQuoted || false,
      chatPage: char.chatPage || 0,
      firstMsgIndex: char.firstMsgIndex || 0,
      removedQuotes: char.removedQuotes || false,
      largePortrait: char.largePortrait || false,
      lorePlus: char.lorePlus || false,
      inlayViewScreen: char.inlayViewScreen || false,
      lowLevelAccess: char.lowLevelAccess || false,
      hideChatIcon: char.hideChatIcon || false,
      doNotChangeSeperateModels: char.doNotChangeSeperateModels || false,
      escapeOutput: char.escapeOutput || false,
      prebuiltAssetCommand: char.prebuiltAssetCommand || false,
      supaMemory: char.supaMemory || false,
      emotionImages: (char.emotionImages as any) || [],
      additionalAssets: (char.additionalAssets as any) || [],
      sdData: (char.sdData as any) || [],
      bias: (char.bias as any) || [],
      alternateGreetings: char.alternateGreetings || [],
      customScript: (char.customScript as any) || [],
      triggerScript: (char.triggerScript as any) || [],
      voiceConfig: (char.voiceConfig as any) || {},
      loreSettings: (char.loreSettings as any) || {},
      newGenData: (char.newGenData as any) || {},
      loreExt: (char.loreExt as any) || {},
      additionalData: (char.additionalData as any) || {},
      depthPrompt: (char.depthPrompt as any) || {},
      extentions: (char.extentions as any) || {},
      scriptstate: (char.scriptstate as any) || {},
      backgroundHTML: char.backgroundHTML || '',
      backgroundCSS: char.backgroundCSS || '',
      reloadKeys: char.reloadKeys || null,
      virtualscript: char.virtualscript || '',
      defaultVariables: char.defaultVariables || '',
      prebuiltAssetStyle: char.prebuiltAssetStyle || '',
      prebuiltAssetExclude: char.prebuiltAssetExclude || [],
      modules: char.modules || [],
      nickname: char.nickname || '',
      source: char.source || [],
      groupOnlyGreetings: char.groupOnlyGreetings || [],
      ccAssets: (char.ccAssets as any) || {},
      realmId: char.realmId || '',
      imported: char.imported || false,
      trashTime: char.trashTime || null,
      creationDate: char.creationDate || null,
      modificationDate: char.modificationDate || null,
      lastInteraction: char.lastInteraction || null,
      // character 인터페이스의 필수 필드들
      desc: char.description || '',
      chats: [], // 채팅은 별도로 관리
      chatFolders: [], // 폴더는 별도로 관리
      globalLore: [], // 로어북은 별도로 관리
      image: char.imageUrl || '',
      type: 'character' as const,
      customscript: (char.customScript as any) || [],
      triggerscript: (char.triggerScript as any) || [],
    } as unknown as character;
  }

  /**
   * advancedSettings 매핑
   */
  private mapAdvancedSettings(advancedSettings: any): Partial<Database> {
    // advancedSettings의 모든 필드를 그대로 반환
    return advancedSettings || {};
  }

  /**
   * 사용자 데이터 저장 (Redis 즉시 업데이트, Worker 큐에 DB 저장 작업 추가)
   */
  async saveUserDatabase(userId: string, database: Database): Promise<void> {
    // Redis 즉시 업데이트
    await this.redis.setSessionData(userId, 'main', database);

    // Worker 큐에 DB 저장 작업 추가 (비동기)
    await this.enqueueDatabaseUpdate(userId, database);
  }

  /**
   * DB 업데이트 작업을 큐에 추가
   */
  private async enqueueDatabaseUpdate(userId: string, database: Database): Promise<void> {
    // Redis에 업데이트 대기 큐 추가
    const queueKey = `db:update:queue:${userId}`;
    await this.redis.set(queueKey, {
      userId,
      database,
      timestamp: Date.now(),
    }, 3600); // 1시간 TTL
  }

  /**
   * 캐릭터 데이터 로드
   */
  async loadCharacter(userId: string, characterId: string): Promise<character | null> {
    const char = await prisma.character.findFirst({
      where: {
        userId,
        chaId: characterId,
      },
    });

    return char ? this.transformCharacter(char) : null;
  }

  /**
   * 채팅 데이터 로드
   */
  async loadChat(userId: string, chatId: string): Promise<any> {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
      include: {
        messages: {
          orderBy: { time: 'asc' },
        },
      },
    });

    return chat;
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
    await this.redis.disconnect();
  }
}

// 싱글톤 인스턴스
let databaseAdapterInstance: DatabaseAdapter | null = null;

/**
 * Database 어댑터 싱글톤 인스턴스 반환
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (!databaseAdapterInstance) {
    databaseAdapterInstance = new DatabaseAdapter();
  }
  return databaseAdapterInstance;
}
