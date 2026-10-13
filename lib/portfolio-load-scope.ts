/** Share work only within one operation; failures can be retried and no data survives a request. */
export function createPortfolioLoadScope<T>(load: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>();
  return (key: string): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const result = Promise.resolve().then(() => load(key)).catch(error => {
      pending.delete(key);
      throw error;
    });
    pending.set(key, result);
    return result;
  };
}
