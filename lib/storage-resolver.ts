import fs from "fs";
import path from "path";

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
  return getEnvValue(env, "CARD_VAULT_DATA_DIR") || path.join(process.cwd(), "data");
}

export function resolveDatabasePath(env: StorageEnv = process.env): string {
  const customDbPath = getEnvValue(env, "CARD_VAULT_DB_PATH");
  if (customDbPath) {
    return customDbPath;
  }

  const dataDir = getEnvValue(env, "CARD_VAULT_DATA_DIR");
  if (dataDir) {
    return path.join(dataDir, "dev.db");
  }

  return path.join(process.cwd(), "prisma", "dev.db");
}

export function resolveUploadsDir(env: StorageEnv = process.env): string {
  return path.join(resolveDataDir(env), "uploads");
}

export function resolveShareCoversDir(env: StorageEnv = process.env): string {
  return path.join(resolveDataDir(env), "share-covers");
}

export function resolveShareBackgroundsDir(env: StorageEnv = process.env): string {
  return path.join(resolveDataDir(env), "share-backgrounds");
}
