function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  private lastRunAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  async waitTurn() {
    const now = Date.now();
    const diff = now - this.lastRunAt;
    if (diff < this.minIntervalMs) {
      await sleep(this.minIntervalMs - diff);
    }
    this.lastRunAt = Date.now();
  }
}
