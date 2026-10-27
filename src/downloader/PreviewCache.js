export const PREVIEW_CACHE_TTL_MS = 120_000;
export const PREVIEW_CACHE_MAX_ENTRIES = 64;

export class PreviewCache {
  constructor(now = Date.now) {
    this.now = now;
    this.entries = new Map();
  }

  getOrCreate(key, create) {
    const now = this.now();
    for (const [id, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(id);
    }
    const existing = this.entries.get(key);
    if (existing) return existing.promise;
    while (this.entries.size >= PREVIEW_CACHE_MAX_ENTRIES) {
      this.entries.delete(this.entries.keys().next().value);
    }
    const entry = { expires: now + PREVIEW_CACHE_TTL_MS };
    entry.promise = Promise.resolve().then(create).catch(error => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }
}
