/**
 * 동시성 제어 클래스
 * 원본: src/ts/util.ts
 */

/**
 * Semaphore: 동시성 제어 메커니즘
 *
 * 동시에 실행될 수 있는 작업 수를 제한합니다.
 * 최대 동시 작업 수가 실행 중이면 새로운 작업은 대기열에서 대기합니다.
 *
 * 예시: max=3이면, 최대 3개의 에셋 저장만 동시에 실행됩니다.
 * 4번째 저장은 처음 3개 중 하나가 완료될 때까지 대기합니다.
 */
export class Semaphore {
    private available: number;
    private readonly max: number;
    private waiting: Array<() => void> = [];

    constructor(max: number) {
        this.available = max;
        this.max = max;
    }

    async acquire(): Promise<void> {
        if (this.available > 0) {
            this.available -= 1;
            return;
        }
        await new Promise<void>(resolve => this.waiting.push(resolve));
    }

    release(): void {
        const next = this.waiting.shift();
        if (next) {
            next();
            return;
        }
        if (this.available < this.max) {
            this.available += 1;
        }
    }
}
