import { open, stat, unlink } from "node:fs/promises";

export const studioLockTimeout = 15 * 60_000;
export async function lockStudioFile(file: string, busyMessage = "这张卡牌正在生成。") {
  const lock = file + ".lock";
  // Each desktop instance can resume work abandoned by a previous process.
  const stale = await stat(lock).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (stale && Date.now() - stale.mtimeMs > studioLockTimeout) await unlink(lock).catch(() => {});
  const handle = await open(lock, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error(busyMessage);
    throw error;
  });
  return async () => { await handle.close(); await unlink(lock).catch(() => {}); };
}
