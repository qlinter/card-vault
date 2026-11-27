import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  resolveDataDir,
  resolveDatabasePath,
  getEntryQueueDir,
  getShareBackgroundsDir,
  getShareCoversDir,
  getThumbnailsDir,
  getUploadsDir
} from "../lib/storage-paths.ts";

const require = createRequire(import.meta.url);
const scriptPaths = require("../lib/storage-paths-core.js") as typeof import("../lib/storage-paths-core.js");

test("script and application storage paths share the same default layout", () => {
  const rootDir = process.cwd();
  const env = {};

  assert.equal(scriptPaths.resolveDataDir(rootDir, env), resolveDataDir(env));
  assert.equal(scriptPaths.resolveDbPath(rootDir, env), resolveDatabasePath(env));
  assert.equal(scriptPaths.resolveUploadsDir(rootDir, env), getUploadsDir(env));
  assert.equal(scriptPaths.resolveThumbnailsDir(rootDir, env), getThumbnailsDir(env));
  assert.equal(scriptPaths.resolveEntryQueueDir(rootDir, env), getEntryQueueDir(env));
  assert.equal(scriptPaths.resolveShareCoversDir(rootDir, env), getShareCoversDir(env));
  assert.equal(scriptPaths.resolveShareBackgroundsDir(rootDir, env), getShareBackgroundsDir(env));
  assert.equal(resolveDataDir(env), path.join(rootDir, "data"));
  assert.equal(resolveDatabasePath(env), path.join(rootDir, "prisma", "dev.db"));
});

test("storage paths consistently honor custom data and database locations", () => {
  const env = { CARD_VAULT_DATA_DIR: "  D:\\Card Vault\\data  ", CARD_VAULT_DB_PATH: "  D:\\Card Vault\\custom.db  " };
  const expectedDataDir = "D:\\Card Vault\\data";
  const expectedDbPath = "D:\\Card Vault\\custom.db";

  assert.equal(scriptPaths.resolveDataDir(process.cwd(), env), expectedDataDir);
  assert.equal(resolveDataDir(env), expectedDataDir);
  assert.equal(scriptPaths.resolveDbPath(process.cwd(), env), expectedDbPath);
  assert.equal(resolveDatabasePath(env), expectedDbPath);
  assert.equal(getUploadsDir(env), path.join(expectedDataDir, "uploads"));
  assert.equal(getThumbnailsDir(env), path.join(expectedDataDir, "thumbnails"));
  assert.equal(getEntryQueueDir(env), path.join(expectedDataDir, "entry-queue"));
  assert.equal(getShareCoversDir(env), path.join(expectedDataDir, "share-covers"));
  assert.equal(getShareBackgroundsDir(env), path.join(expectedDataDir, "share-backgrounds"));
});

test("database defaults to the selected data directory when no explicit database path exists", () => {
  const env = { CARD_VAULT_DATA_DIR: "D:\\Card Vault\\data" };
  assert.equal(scriptPaths.resolveDbPath(process.cwd(), env), path.join(env.CARD_VAULT_DATA_DIR, "dev.db"));
  assert.equal(resolveDatabasePath(env), path.join(env.CARD_VAULT_DATA_DIR, "dev.db"));
});
