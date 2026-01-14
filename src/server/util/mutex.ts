/**
 * Mutex (상호 배제) 클래스
 * 원본: src/ts/mutex.ts
 * 서버 사이드에서 사용할 수 있도록 구현
 */

/**
 * Mutex 클래스
 * 비동기 작업의 상호 배제를 보장
 */
export class Mutex {
    private locked = false;
    private queue: Array<() => void> = [];

    /**
     * 락 획득
     */
    async acquire(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    /**
     * 락 해제
     */
    release(): void {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) {
                next();
            }
        } else {
            this.locked = false;
        }
    }

    /**
     * 락이 해제될 때까지 대기한 후 함수 실행
     */
    async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    /**
     * 락 상태 확인
     */
    isLocked(): boolean {
        return this.locked;
    }
}
