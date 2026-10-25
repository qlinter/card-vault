import { statSync } from "node:fs";

type ResetResult = { changed: boolean; counts: Record<string, number>; backupPath: string | null };
const shared = globalThis as typeof globalThis & { cardVaultHistoryReadiness?: Map<string, { identity: string; version: number }> };
const completed = shared.cardVaultHistoryReadiness ??= new Map();

/** Avoid repeated SQLite connections after a reset; replacement/restored files invalidate the guard. */
export function ensureHistoryReady(dbPath: string, version: number, reset: (path: string) => ResetResult): ResetResult {
  let identity: string;
  try {
    const file = statSync(dbPath);
    identity = `${file.dev}:${file.ino}:${file.birthtimeMs}`;
  } catch { return reset(dbPath); }
  const previous = completed.get(dbPath);
  if (previous?.identity === identity && previous.version >= version) return { changed: false, counts: {}, backupPath: null };
  const result = reset(dbPath);
  if (completed.size >= 16) completed.delete(completed.keys().next().value!);
  completed.set(dbPath, { identity, version });
  return result;
}
