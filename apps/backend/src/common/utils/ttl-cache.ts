/**
 * Minimal in-memory TTL cache for read-heavy content that is identical for
 * every student (subject lists, topic trees, the career catalogue). One
 * Railway instance means in-process memory is authoritative enough; entries
 * expire so content ingestion shows up within minutes without invalidation.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
    const value = await load();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}
