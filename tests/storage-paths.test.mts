import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  resolveDataDir,
  resolveDatabasePath,
  resolveEntryQueueDir,
  resolveShareBackgroundsDir,
  resolveShareCoversDir,
  resolveUploadsDir
} from "../lib/storage-resolver.ts";

const require = createRequire(import.meta.url);
const scriptPaths = require("../scripts/storage-paths.js") as typeof import("../lib/storage-paths-core.js");

test("script and application storage paths share the same default layout", () => {
  const rootDir = process.cwd();
  const env = {};

  assert.equal(scriptPaths.resolveDataDir(rootDir, env), resolveDataDir(env));
  assert.equal(scriptPaths.resolveDbPath(rootDir, env), resolveDatabasePath(env));
  assert.equal(scriptPaths.resolveUploadsDir(rootDir, env), resolveUploadsDir(env));
  assert.equal(scriptPaths.resolveEntryQueueDir(rootDir, env), resolveEntryQueueDir(env));
  assert.equal(scriptPaths.resolveShareCoversDir(rootDir, env), resolveShareCoversDir(env));
  assert.equal(scriptPaths.resolveShareBackgroundsDir(rootDir, env), resolveShareBackgroundsDir(env));
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
  assert.equal(resolveUploadsDir(env), path.join(expectedDataDir, "uploads"));
  assert.equal(resolveEntryQueueDir(env), path.join(expectedDataDir, "entry-queue"));
  assert.equal(resolveShareCoversDir(env), path.join(expectedDataDir, "share-covers"));
  assert.equal(resolveShareBackgroundsDir(env), path.join(expectedDataDir, "share-backgrounds"));
});

test("database defaults to the selected data directory when no explicit database path exists", () => {
  const env = { CARD_VAULT_DATA_DIR: "D:\\Card Vault\\data" };
  assert.equal(scriptPaths.resolveDbPath(process.cwd(), env), path.join(env.CARD_VAULT_DATA_DIR, "dev.db"));
  assert.equal(resolveDatabasePath(env), path.join(env.CARD_VAULT_DATA_DIR, "dev.db"));
});
