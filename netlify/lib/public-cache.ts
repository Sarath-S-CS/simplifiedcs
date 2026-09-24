// Shared cache for PUBLIC vulnerability data only (CISA KEV catalog, NVD
// keyword results). Nothing organisation-specific - no answers, no AI
// output - is ever written here, so sharing it across visitors is safe
// (SEC-2c). It exists to cut upstream calls (CISA's catalog is ~1.5 MB; NVD's
// unauthenticated API allows ~5 requests per 30 s) and to keep a last-known
// copy when a source is briefly down.
//
// The cache is best-effort: if the store itself fails, fetch directly. A
// stale copy is returned (flagged `stale`) only when the live fetch fails.

export interface JsonKv {
  get(key: string, opts: { type: "json" }): Promise<any | null>;
  setJSON(key: string, value: unknown): Promise<unknown>;
}

export type Cached<T> = { data: T; fetchedAt: string; stale: boolean; fromCache: boolean };

type Entry<T> = { data: T; fetchedAt: number };

export async function cachedJson<T>(
  store: JsonKv | null,
  key: string,
  ttlMs: number,
  maxStaleMs: number,
  fetcher: () => Promise<T>,
  now = Date.now(),
): Promise<Cached<T>> {
  let entry: Entry<T> | null = null;
  if (store) {
    try {
      entry = (await store.get(key, { type: "json" })) as Entry<T> | null;
    } catch {
      entry = null;
    }
  }
  if (entry && now - entry.fetchedAt < ttlMs) {
    return { data: entry.data, fetchedAt: new Date(entry.fetchedAt).toISOString(), stale: false, fromCache: true };
  }
  try {
    const data = await fetcher();
    if (store) {
      try {
        await store.setJSON(key, { data, fetchedAt: now });
      } catch {
        /* cache write is best-effort */
      }
    }
    return { data, fetchedAt: new Date(now).toISOString(), stale: false, fromCache: false };
  } catch (e) {
    if (entry && now - entry.fetchedAt < maxStaleMs) {
      return { data: entry.data, fetchedAt: new Date(entry.fetchedAt).toISOString(), stale: true, fromCache: true };
    }
    throw e;
  }
}
