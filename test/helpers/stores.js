// In-memory stand-ins for Netlify Blobs used by the endpoint tests.
// casStore implements conditional writes (onlyIfNew / onlyIfMatch on an
// ETag) and yields between operations so concurrent calls interleave.

export function casStore({ failReads = false, failWrites = false } = {}) {
  const data = new Map();
  let etagSeq = 0;
  const tick = () => new Promise((r) => setImmediate(r));
  return {
    data,
    async getWithMetadata(key) {
      await tick();
      if (failReads) throw new Error("blobs unavailable");
      const e = data.get(key);
      return e ? { data: JSON.parse(e.json), etag: e.etag } : null;
    },
    async setJSON(key, value, opts = {}) {
      await tick();
      if (failWrites) throw new Error("blobs unavailable");
      const cur = data.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch !== undefined && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = `e${++etagSeq}`;
      data.set(key, { json: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
    async delete(key) {
      await tick();
      data.delete(key);
    },
    async list({ prefix }) {
      await tick();
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

export function kvStore() {
  const data = new Map();
  return {
    data,
    async get(key) {
      return data.has(key) ? JSON.parse(data.get(key)) : null;
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
  };
}
