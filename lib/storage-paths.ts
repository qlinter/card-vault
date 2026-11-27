import fs from "node:fs";
import path from "node:path";
import paths from "./storage-paths-core.js";

type StorageEnv = Record<string, string | undefined>;

function getEnvValue(env: StorageEnv, key: keyof StorageEnv): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

function resolveStorageConfigPath(env: StorageEnv = process.env): string | null {
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
  return paths.resolveDataDir(process.cwd(), env);
}

export function resolveDatabasePath(env: StorageEnv = process.env): string {
  return paths.resolveDbPath(process.cwd(), env);
}

export function getUploadsDir(env: StorageEnv = process.env): string {
  return paths.resolveUploadsDir(process.cwd(), env);
}

export function getThumbnailsDir(env: StorageEnv = process.env): string {
  return paths.resolveThumbnailsDir(process.cwd(), env);
}

export function getEntryQueueDir(env: StorageEnv = process.env): string {
  return paths.resolveEntryQueueDir(process.cwd(), env);
}

export function getShareCoversDir(env: StorageEnv = process.env): string {
  return paths.resolveShareCoversDir(process.cwd(), env);
}

export function getShareBackgroundsDir(env: StorageEnv = process.env): string {
  return paths.resolveShareBackgroundsDir(process.cwd(), env);
}
