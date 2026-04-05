export class BlobCache {
  private cache: Map<string, string> = new Map();

  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  set(key: string, blobUrl: string): Promise<void> {
    this.cache.set(key, blobUrl);
    return Promise.resolve();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    const blobUrl = this.cache.get(key);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.cache.delete(key);
    }
  }

  clear(): void {
    for (const blobUrl of this.cache.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.cache.clear();
  }
}
