/**
 * 서비스 초기화 및 관리
 * 모든 서비스를 한 곳에서 초기화하고 관리
 */

import { getRedisService } from './redis-service';
import { getDatabaseAdapter } from './database-adapter';
import { getAssetService } from './asset-service';
import { runServerScript, runLuaEditTrigger, runLuaButtonTrigger } from './lua-service';

export class ServiceManager {
  private redis = getRedisService();
  private database = getDatabaseAdapter();
  private asset = getAssetService();
  private isInitialized = false;

  /**
   * 모든 서비스 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[Service Manager] Initializing services...');

      // Redis 서비스 초기화
      await this.redis.connect();
      console.log('[Service Manager] Redis service initialized');

      // Database 어댑터 초기화
      await this.database.initialize();
      console.log('[Service Manager] Database adapter initialized');

      // Asset 서비스 초기화
      await this.asset.initialize();
      console.log('[Service Manager] Asset service initialized');

      this.isInitialized = true;
      console.log('[Service Manager] All services initialized successfully');
    } catch (error) {
      console.error('[Service Manager] Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * 모든 서비스 종료
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('[Service Manager] Shutting down services...');

      // Database 어댑터 종료
      await this.database.disconnect();

      // Redis 연결 종료
      await this.redis.disconnect();

      this.isInitialized = false;
      console.log('[Service Manager] All services shut down');
    } catch (error) {
      console.error('[Service Manager] Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * 서비스 인스턴스 반환
   */
  getRedis() {
    return this.redis;
  }

  getDatabase() {
    return this.database;
  }

  getAsset() {
    return this.asset;
  }
}

// 싱글톤 인스턴스
let serviceManagerInstance: ServiceManager | null = null;

/**
 * Service Manager 싱글톤 인스턴스 반환
 */
export function getServiceManager(): ServiceManager {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ServiceManager();
  }
  return serviceManagerInstance;
}

// 서비스 개별 export
export { getRedisService } from './redis-service';
export { getDatabaseAdapter } from './database-adapter';
export { getAssetService } from './asset-service';
export { runServerScript, runLuaEditTrigger, runLuaButtonTrigger } from './lua-service';