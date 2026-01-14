/**
 * Redis 캐싱 서비스
 * RedisLabs Cloud 연결 및 캐시 전략 구현
 */

import Redis from 'ioredis';

export class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  /**
   * Redis 클라이언트 초기화 및 연결
   */
  async connect(): Promise<Redis> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      const redisUrl = process.env.REDIS_URL;
      const redisUsername = process.env.REDIS_USERNAME || 'default';
      const redisPassword = process.env.REDIS_PASSWORD;
      const redisHost = process.env.REDIS_SOCKET_URL;
      const redisPort = parseInt(process.env.REDIS_SOCKET_PORT || '6379');

      if (redisUrl) {
        // URL 형식으로 연결
        this.client = new Redis(redisUrl, {
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });
      } else if (redisHost && redisPassword) {
        // 개별 설정으로 연결
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          username: redisUsername,
          password: redisPassword,
          tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });
      } else {
        throw new Error('Redis connection configuration is missing');
      }

      // 연결 이벤트 리스너
      this.client.on('connect', () => {
        console.log('[Redis] Connected to Redis server');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('[Redis] Connection error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('[Redis] Connection closed');
        this.isConnected = false;
      });

      // 연결 확인
      await this.client.ping();
      this.isConnected = true;

      return this.client;
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Redis 연결 종료
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * 세션 데이터 캐시 (TTL: 1시간)
   */
  async setSessionData(userId: string, characterId: string, data: any): Promise<void> {
    const key = `session:${userId}:${characterId}:data`;
    await this.client!.setex(key, 3600, JSON.stringify(data));
  }

  /**
   * 세션 데이터 조회
   */
  async getSessionData(userId: string, characterId: string): Promise<any | null> {
    const key = `session:${userId}:${characterId}:data`;
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 현재 채팅 상태 캐시 (TTL: 30분)
   */
  async setChatState(userId: string, characterId: string, chatData: any): Promise<void> {
    const key = `session:${userId}:${characterId}:chat`;
    await this.client!.setex(key, 1800, JSON.stringify(chatData));
  }

  /**
   * 현재 채팅 상태 조회
   */
  async getChatState(userId: string, characterId: string): Promise<any | null> {
    const key = `session:${userId}:${characterId}:chat`;
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 스크립트 변수 캐시 (TTL: 2시간)
   */
  async setScriptVars(userId: string, characterId: string, chatId: string, vars: any): Promise<void> {
    const key = `session:${userId}:${characterId}:${chatId}:vars`;
    await this.client!.setex(key, 7200, JSON.stringify(vars));
  }

  /**
   * 스크립트 변수 조회
   */
  async getScriptVars(userId: string, characterId: string, chatId: string): Promise<any | null> {
    const key = `session:${userId}:${characterId}:${chatId}:vars`;
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 메모리 캐시 (TTL: 1시간)
   */
  async setMemoryCache(userId: string, characterId: string, chatId: string, memoryData: any): Promise<void> {
    const key = `session:${userId}:${characterId}:${chatId}:memory`;
    await this.client!.setex(key, 3600, JSON.stringify(memoryData));
  }

  /**
   * 메모리 캐시 조회
   */
  async getMemoryCache(userId: string, characterId: string, chatId: string): Promise<any | null> {
    const key = `session:${userId}:${characterId}:${chatId}:memory`;
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 프롬프트 캐시 (TTL: 5분)
   */
  async setPromptCache(userId: string, characterId: string, chatId: string, promptData: any): Promise<void> {
    const key = `session:${userId}:${characterId}:${chatId}:prompt`;
    await this.client!.setex(key, 300, JSON.stringify(promptData));
  }

  /**
   * 프롬프트 캐시 조회
   */
  async getPromptCache(userId: string, characterId: string, chatId: string): Promise<any | null> {
    const key = `session:${userId}:${characterId}:${chatId}:prompt`;
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 일반적인 키-값 저장
   */
  async set(key: string, value: any, ttl: number | null = null): Promise<void> {
    if (ttl) {
      await this.client!.setex(key, ttl, JSON.stringify(value));
    } else {
      await this.client!.set(key, JSON.stringify(value));
    }
  }

  /**
   * 일반적인 키-값 조회
   */
  async get(key: string): Promise<any | null> {
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 키 삭제
   */
  async delete(key: string): Promise<void> {
    await this.client!.del(key);
  }

  /**
   * 패턴으로 키 삭제
   */
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.client!.keys(pattern);
    if (keys.length > 0) {
      await this.client!.del(...keys);
    }
  }

  /**
   * TTL 설정
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client!.expire(key, seconds);
  }

  /**
   * Inlay 에셋 저장 (TTL: 24시간)
   */
  async setInlayAsset(userId: string, assetId: string, asset: any): Promise<void> {
    const key = `inlay:${userId}:${assetId}`;
    await this.client!.setex(key, 86400, JSON.stringify(asset));
  }

  /**
   * Inlay 에셋 조회
   */
  async getInlayAsset(userId: string, assetId: string): Promise<any | null> {
    const key = `inlay:${userId}:${assetId}`;
    const data = await this.client!.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 클라이언트 인스턴스 반환 (내부 사용)
   */
  getClient(): Redis | null {
    return this.client;
  }
}

// 싱글톤 인스턴스
let redisServiceInstance: RedisService | null = null;

/**
 * Redis 서비스 싱글톤 인스턴스 반환
 */
export function getRedisService(): RedisService {
  if (!redisServiceInstance) {
    redisServiceInstance = new RedisService();
  }
  return redisServiceInstance;
}
