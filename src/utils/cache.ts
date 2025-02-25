interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 60000) {
    // Default 1 minute TTL
    this.defaultTTL = defaultTTL;
    setInterval(() => this.cleanup(), 300000); // Cleanup every 5 minutes
  }

  set(key: string, value: T, ttl: number = this.defaultTTL): void {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttl,
    });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.store.delete(key);
      }
    }
  }
}
