import "server-only";
import { resetScoutHistory, scoutResetVersion } from "../scripts/reset-scout-history";
import { ensureHistoryReady } from "./history-readiness";
import { resolveDatabasePath } from "./storage-resolver";
import path from "node:path";

export function resolveCollectionDatabasePath() {
  const url = process.env.DATABASE_URL;
  if (url && !url.startsWith("file:")) throw new Error("数据库地址不是本地文件，未清理寻卡记录。");
  const file = url ? decodeURIComponent(url.slice(5).split("?")[0]) : resolveDatabasePath();
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), "prisma", file);
}

export function ensureScoutReady() {
  return ensureHistoryReady(resolveCollectionDatabasePath(), scoutResetVersion, resetScoutHistory);
}
