interface CacheEntry<T> {
  value: T;
  expires: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  clear(key: string) {
    this.store.delete(key);
  }

  clearAll() {
    this.store.clear();
  }
}

const cache = new InMemoryCache();
export default cache;
