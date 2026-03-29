interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly label: string;
  private hits = 0;
  private misses = 0;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize: number, ttlMs: number, label?: string) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.label = label ?? "unnamed";

    this.monitorInterval = setInterval(() => {
      const total = this.hits + this.misses;
      if (total > 0) {
        const hitRate = ((this.hits / total) * 100).toFixed(1);
        console.log(`[lru-cache:${this.label}] size=${this.cache.size}/${this.maxSize} hits=${this.hits} misses=${this.misses} hitRate=${hitRate}%`);
        this.hits = 0;
        this.misses = 0;
      }
    }, 60_000);

    if (this.monitorInterval.unref) {
      this.monitorInterval.unref();
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.delete(key);
    this.cache.set(key, { value, fetchedAt: Date.now() });

    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}
