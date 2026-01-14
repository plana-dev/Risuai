/**
 * Process 상태 관리
 * 원본: src/ts/process/index.svelte.ts의 doingChat, chatProcessStage 등
 * 
 * 서버 사이드에서는 Redis를 사용하여 상태를 관리합니다.
 */

import { getRedisService } from '../redis-service';
import { ChatProcessStage } from './types';

/**
 * 상태 관리 인터페이스
 */
export interface ProcessStateManager {
    getDoingChat(userId: string, chatId: string): Promise<boolean>;
    setDoingChat(userId: string, chatId: string, value: boolean): Promise<void>;
    getChatProcessStage(userId: string, chatId: string): Promise<ChatProcessStage>;
    setChatProcessStage(userId: string, chatId: string, stage: ChatProcessStage): Promise<void>;
    getAbortChat(userId: string, chatId: string): Promise<boolean>;
    setAbortChat(userId: string, chatId: string, value: boolean): Promise<void>;
    clearState(userId: string, chatId: string): Promise<void>;
}

/**
 * Redis 기반 상태 관리 구현
 */
export class RedisProcessStateManager implements ProcessStateManager {
    private redis = getRedisService();

    async getDoingChat(userId: string, chatId: string): Promise<boolean> {
        try {
            const value = await this.redis.get(`process:${userId}:${chatId}:doingChat`);
            return value === 'true';
        } catch (error) {
            console.error('[Process State] Failed to get doingChat:', error);
            return false;
        }
    }

    async setDoingChat(userId: string, chatId: string, value: boolean): Promise<void> {
        try {
            await this.redis.set(`process:${userId}:${chatId}:doingChat`, value.toString(), 300); // 5분 TTL
        } catch (error) {
            console.error('[Process State] Failed to set doingChat:', error);
        }
    }

    async getChatProcessStage(userId: string, chatId: string): Promise<ChatProcessStage> {
        try {
            const value = await this.redis.get(`process:${userId}:${chatId}:stage`);
            return value ? parseInt(value, 10) as ChatProcessStage : ChatProcessStage.Idle;
        } catch (error) {
            console.error('[Process State] Failed to get chatProcessStage:', error);
            return ChatProcessStage.Idle;
        }
    }

    async setChatProcessStage(userId: string, chatId: string, stage: ChatProcessStage): Promise<void> {
        try {
            await this.redis.set(`process:${userId}:${chatId}:stage`, stage.toString(), 300); // 5분 TTL
        } catch (error) {
            console.error('[Process State] Failed to set chatProcessStage:', error);
        }
    }

    async getAbortChat(userId: string, chatId: string): Promise<boolean> {
        try {
            const value = await this.redis.get(`process:${userId}:${chatId}:abort`);
            return value === 'true';
        } catch (error) {
            console.error('[Process State] Failed to get abortChat:', error);
            return false;
        }
    }

    async setAbortChat(userId: string, chatId: string, value: boolean): Promise<void> {
        try {
            await this.redis.set(`process:${userId}:${chatId}:abort`, value.toString(), 300); // 5분 TTL
        } catch (error) {
            console.error('[Process State] Failed to set abortChat:', error);
        }
    }

    async clearState(userId: string, chatId: string): Promise<void> {
        try {
            await Promise.all([
                this.redis.del(`process:${userId}:${chatId}:doingChat`),
                this.redis.del(`process:${userId}:${chatId}:stage`),
                this.redis.del(`process:${userId}:${chatId}:abort`),
            ]);
        } catch (error) {
            console.error('[Process State] Failed to clear state:', error);
        }
    }
}

/**
 * 메모리 기반 상태 관리 구현 (개발/테스트용)
 */
export class MemoryProcessStateManager implements ProcessStateManager {
    private state = new Map<string, {
        doingChat: boolean;
        stage: ChatProcessStage;
        abort: boolean;
    }>();

    private getKey(userId: string, chatId: string): string {
        return `${userId}:${chatId}`;
    }

    async getDoingChat(userId: string, chatId: string): Promise<boolean> {
        const key = this.getKey(userId, chatId);
        return this.state.get(key)?.doingChat ?? false;
    }

    async setDoingChat(userId: string, chatId: string, value: boolean): Promise<void> {
        const key = this.getKey(userId, chatId);
        const current = this.state.get(key) || { doingChat: false, stage: ChatProcessStage.Idle, abort: false };
        current.doingChat = value;
        this.state.set(key, current);
    }

    async getChatProcessStage(userId: string, chatId: string): Promise<ChatProcessStage> {
        const key = this.getKey(userId, chatId);
        return this.state.get(key)?.stage ?? ChatProcessStage.Idle;
    }

    async setChatProcessStage(userId: string, chatId: string, stage: ChatProcessStage): Promise<void> {
        const key = this.getKey(userId, chatId);
        const current = this.state.get(key) || { doingChat: false, stage: ChatProcessStage.Idle, abort: false };
        current.stage = stage;
        this.state.set(key, current);
    }

    async getAbortChat(userId: string, chatId: string): Promise<boolean> {
        const key = this.getKey(userId, chatId);
        return this.state.get(key)?.abort ?? false;
    }

    async setAbortChat(userId: string, chatId: string, value: boolean): Promise<void> {
        const key = this.getKey(userId, chatId);
        const current = this.state.get(key) || { doingChat: false, stage: ChatProcessStage.Idle, abort: false };
        current.abort = value;
        this.state.set(key, current);
    }

    async clearState(userId: string, chatId: string): Promise<void> {
        const key = this.getKey(userId, chatId);
        this.state.delete(key);
    }
}

// 기본 상태 관리자 인스턴스
let defaultStateManager: ProcessStateManager | null = null;

/**
 * 기본 상태 관리자 반환
 */
export function getProcessStateManager(): ProcessStateManager {
    if (!defaultStateManager) {
        // Redis가 사용 가능하면 Redis 사용, 아니면 메모리 사용
        try {
            defaultStateManager = new RedisProcessStateManager();
        } catch (error) {
            console.warn('[Process State] Redis not available, using memory state manager');
            defaultStateManager = new MemoryProcessStateManager();
        }
    }
    return defaultStateManager;
}

/**
 * 상태 관리자 설정
 */
export function setProcessStateManager(manager: ProcessStateManager): void {
    defaultStateManager = manager;
}
