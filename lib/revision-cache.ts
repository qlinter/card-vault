type Cached<T> = { version: string; value: T; createdAt: number; expiresAt: number; weight: number };

/** Bounded calculation reuse. A revision and a known time boundary are both required. */
export function createRevisionCache<T>({ maxEntries = 3, maxBytes = 32 * 1024 * 1024, now = Date.now } = {}) {
  const values = new Map<string, Cached<T>>();
  const pending = new Map<string, Promise<T>>();
  const latest = new Map<string, symbol>();
  let bytes = 0;
  function remove(key: string) { const old = values.get(key); if (old) bytes -= old.weight; values.delete(key); }
  async function get(key: string, version: string, load: () => Promise<{ value: T; createdAt: number; expiresAt: number; weight: number }>): Promise<T> {
    const time = now(), cached = values.get(key);
    if (cached && cached.version === version && time >= cached.createdAt && time < cached.expiresAt) {
      values.delete(key); values.set(key, cached); return cached.value;
    }
    if (cached) remove(key);
    const token = JSON.stringify([key, version]);
    const existing = pending.get(token);
    if (existing) return existing;
    const generation = Symbol(); latest.set(key, generation);
    const result = Promise.resolve().then(load).then(entry => {
      if (latest.get(key) === generation && entry.weight <= maxBytes && now() < entry.expiresAt && now() >= entry.createdAt) {
        remove(key);
        while (values.size && (values.size >= maxEntries || bytes + entry.weight > maxBytes)) remove(values.keys().next().value!);
        values.set(key, { ...entry, version }); bytes += entry.weight;
      }
      return entry.value;
    }).finally(() => { pending.delete(token); if (latest.get(key) === generation) latest.delete(key); });
    pending.set(token, result);
    return result;
  }
  return { get, clear: () => { values.clear(); bytes = 0; latest.clear(); }, stats: () => ({ entries: values.size, bytes, pending: pending.size }) };
}
