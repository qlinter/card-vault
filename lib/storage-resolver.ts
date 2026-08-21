import fs from "fs";
import path from "path";
import { resolveDataDir as resolveCoreDataDir, resolveDbPath as resolveCoreDbPath, resolveEntryQueueDir as resolveCoreEntryQueueDir, resolveShareBackgroundsDir as resolveCoreShareBackgroundsDir, resolveShareCoversDir as resolveCoreShareCoversDir, resolveUploadsDir as resolveCoreUploadsDir } from "./storage-paths-core.js";

type StorageEnv = Record<string, string | undefined>;

function getEnvValue(env: StorageEnv, key: keyof StorageEnv): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

export function resolveStorageConfigPath(env: StorageEnv = process.env): string | null {
  const customPath = getEnvValue(env, "CARD_VAULT_STORAGE_CONFIG_PATH");
  if (customPath) {
    return customPath;
  }

  const appData = getEnvValue(env, "APPDATA");
  return appData ? path.join(appData, "Electron", "storage-config.json") : null;
}

export function resolveConfiguredDataDir(env: StorageEnv = process.env): string | null {
  const configPath = resolveStorageConfigPath(env);
  const envDataDir = getEnvValue(env, "CARD_VAULT_DATA_DIR");

  if (!configPath || !fs.existsSync(configPath)) {
    return envDataDir;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as { dataDir?: string };
    return parsed.dataDir?.trim() || envDataDir;
  } catch {
    return envDataDir;
  }
}

export function resolveDataDir(env: StorageEnv = process.env): string {
  return resolveCoreDataDir(process.cwd(), env);
}

export function resolveDatabasePath(env: StorageEnv = process.env): string {
  return resolveCoreDbPath(process.cwd(), env);
}

export function resolveUploadsDir(env: StorageEnv = process.env): string {
  return resolveCoreUploadsDir(process.cwd(), env);
}

export function resolveEntryQueueDir(env: StorageEnv = process.env): string {
  return resolveCoreEntryQueueDir(process.cwd(), env);
}

export function resolveShareCoversDir(env: StorageEnv = process.env): string {
  return resolveCoreShareCoversDir(process.cwd(), env);
}

export function resolveShareBackgroundsDir(env: StorageEnv = process.env): string {
  return resolveCoreShareBackgroundsDir(process.cwd(), env);
}
