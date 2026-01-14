/**
 * DB 동기화 Worker 프로세스
 * Redis의 변경사항을 DB에 비동기로 동기화
 * 별도 Node.js 프로세스로 실행
 */

require('dotenv').config();
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

class DBSyncWorker {
  constructor() {
    this.redis = null;
    this.prisma = new PrismaClient();
    this.isRunning = false;
    this.intervalId = null;
    this.batchSize = 10; // 한 번에 처리할 작업 수
    this.pollInterval = 5000; // 5초마다 큐 확인
  }

  /**
   * Worker 시작
   */
  async start() {
    if (this.isRunning) {
      console.log('[DB Sync Worker] Already running');
      return;
    }

    // Redis 연결
    const redisUrl = process.env.REDIS_URL;
    const redisUsername = process.env.REDIS_USERNAME || 'default';
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisHost = process.env.REDIS_SOCKET_URL;
    const redisPort = parseInt(process.env.REDIS_SOCKET_PORT || '6379');

    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else if (redisHost && redisPassword) {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        username: redisUsername,
        password: redisPassword,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      });
    } else {
      throw new Error('Redis connection configuration is missing');
    }

    this.isRunning = true;

    console.log('[DB Sync Worker] Started');

    // 주기적으로 큐 확인 및 처리
    this.intervalId = setInterval(() => {
      this.processQueue().catch((err) => {
        console.error('[DB Sync Worker] Error processing queue:', err);
      });
    }, this.pollInterval);

    // 초기 실행
    this.processQueue().catch((err) => {
      console.error('[DB Sync Worker] Error in initial process:', err);
    });
  }

  /**
   * Worker 중지
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.prisma.$disconnect();
    if (this.redis) {
      await this.redis.quit();
    }

    console.log('[DB Sync Worker] Stopped');
  }

  /**
   * 큐에서 작업 가져와서 처리
   */
  async processQueue() {
    try {
      // 업데이트 대기 중인 사용자 ID 목록 조회
      const queueKeys = await this.redis.keys('db:update:queue:*');

      if (queueKeys.length === 0) {
        return;
      }

      // 배치로 처리
      const batch = queueKeys.slice(0, this.batchSize);

      await Promise.all(
        batch.map((key) => this.processDatabaseUpdate(key))
      );
    } catch (error) {
      console.error('[DB Sync Worker] Error in processQueue:', error);
    }
  }

  /**
   * 개별 데이터베이스 업데이트 처리
   */
  async processDatabaseUpdate(queueKey) {
    try {
      // 큐에서 작업 가져오기
      const queueData = await this.redis.get(queueKey);

      if (!queueData) {
        return; // 이미 처리되었거나 만료됨
      }

      const { userId, database } = JSON.parse(queueData);

      // DB에 저장
      await this.saveDatabaseToDB(userId, database);

      // 큐에서 제거
      await this.redis.del(queueKey);

      console.log(`[DB Sync Worker] Synced database for user ${userId}`);
    } catch (error) {
      console.error(`[DB Sync Worker] Error processing ${queueKey}:`, error);
      // 에러 발생 시 큐에서 제거하여 무한 루프 방지
      await this.redis.del(queueKey);
    }
  }

  /**
   * Database를 DB에 저장
   */
  async saveDatabaseToDB(userId, database) {
    try {
      // 트랜잭션으로 모든 업데이트 처리
      await this.prisma.$transaction(async (tx) => {
        // UserSettings 업데이트
        await tx.userSettings.upsert({
          where: { userId },
          update: {
            username: database.username,
            userIconUrl: database.userIcon,
            userNote: database.userNote,
            language: database.language,
            theme: database.theme,
            customSettings: this.extractAdvancedSettings(database),
          },
          create: {
            userId,
            username: database.username,
            userIconUrl: database.userIcon,
            userNote: database.userNote,
            language: database.language,
            theme: database.theme,
            customSettings: this.extractAdvancedSettings(database),
          },
        });

        // Persona 업데이트
        if (database.persona) {
          await tx.persona.upsert({
            where: { userId },
            update: {
              name: database.persona.name,
              personaPrompt: database.persona.personaPrompt,
              iconUrl: database.persona.icon,
              note: database.persona.note,
              largePortrait: database.persona.largePortrait,
            },
            create: {
              userId,
              name: database.persona.name || 'Default',
              personaPrompt: database.persona.personaPrompt,
              iconUrl: database.persona.icon,
              note: database.persona.note,
              largePortrait: database.persona.largePortrait || false,
            },
          });
        }

        // Characters 업데이트 (간단한 예시, 실제로는 더 복잡한 로직 필요)
        if (database.characters && database.characters.length > 0) {
          for (const char of database.characters) {
            await tx.character.upsert({
              where: { chaId: char.chaId },
              update: this.transformCharacterToPrisma(char, userId),
              create: this.transformCharacterToPrisma(char, userId),
            });
          }
        }
      });
    } catch (error) {
      console.error(`[DB Sync Worker] Error saving database for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Database에서 advancedSettings 추출
   */
  extractAdvancedSettings(database) {
    const advancedSettings = { ...database };
    
    // 기본 필드 제거
    delete advancedSettings.username;
    delete advancedSettings.userIcon;
    delete advancedSettings.userNote;
    delete advancedSettings.language;
    delete advancedSettings.theme;
    delete advancedSettings.characters;
    delete advancedSettings.characterOrder;
    delete advancedSettings.chats;
    delete advancedSettings.loreBook;
    delete advancedSettings.persona;
    delete advancedSettings.personaPrompt;

    return advancedSettings;
  }

  /**
   * Character를 Prisma 모델로 변환
   */
  transformCharacterToPrisma(char, userId) {
    return {
      userId,
      chaId: char.chaId,
      name: char.name,
      description: char.description,
      personality: char.personality,
      scenario: char.scenario,
      firstMessage: char.firstMessage,
      notes: char.notes,
      creatorNotes: char.creatorNotes,
      systemPrompt: char.systemPrompt,
      postHistoryInstructions: char.postHistoryInstructions,
      exampleMessage: char.exampleMessage,
      additionalText: char.additionalText,
      replaceGlobalNote: char.replaceGlobalNote,
      translatorNote: char.translatorNote,
      imageUrl: char.imageUrl,
      characterVersion: char.characterVersion,
      creator: char.creator,
      tags: char.tags || [],
      license: char.license,
      isPrivate: char.isPrivate !== undefined ? char.isPrivate : true,
      isPublished: char.isPublished || false,
      viewScreen: char.viewScreen || 'none',
      utilityBot: char.utilityBot || false,
      ttsMode: char.ttsMode,
      ttsSpeech: char.ttsSpeech,
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
      emotionImages: char.emotionImages || [],
      additionalAssets: char.additionalAssets || [],
      sdData: char.sdData || [],
      bias: char.bias || [],
      alternateGreetings: char.alternateGreetings || [],
      customScript: char.customScript || [],
      triggerScript: char.triggerScript || [],
      voiceConfig: char.voiceConfig || {},
      loreSettings: char.loreSettings || {},
      newGenData: char.newGenData || {},
      loreExt: char.loreExt || {},
      additionalData: char.additionalData || {},
      depthPrompt: char.depthPrompt || {},
      extentions: char.extentions || {},
      scriptstate: char.scriptstate || {},
      backgroundHTML: char.backgroundHTML,
      backgroundCSS: char.backgroundCSS,
      reloadKeys: char.reloadKeys,
      virtualscript: char.virtualscript,
      defaultVariables: char.defaultVariables,
      prebuiltAssetStyle: char.prebuiltAssetStyle,
      prebuiltAssetExclude: char.prebuiltAssetExclude || [],
      modules: char.modules || [],
      nickname: char.nickname,
      source: char.source || [],
      groupOnlyGreetings: char.groupOnlyGreetings || [],
      ccAssets: char.ccAssets || {},
      realmId: char.realmId,
      imported: char.imported || false,
      trashTime: char.trashTime,
      creationDate: char.creationDate,
      modificationDate: char.modificationDate,
      lastInteraction: char.lastInteraction,
    };
  }
}

// Worker 실행
const worker = new DBSyncWorker();

(async () => {
  try {
    await worker.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[DB Sync Worker] SIGTERM received, shutting down gracefully...');
      await worker.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[DB Sync Worker] SIGINT received, shutting down gracefully...');
      await worker.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('[DB Sync Worker] Failed to start:', error);
    process.exit(1);
  }
})();
