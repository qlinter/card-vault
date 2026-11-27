import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getStudioAiSettings, getAiSettings } from "../lib/ai-settings.ts";

test("image generation resolves only the configured source, independently of chat and vision models", t => {
  const root = mkdtempSync(path.join(os.tmpdir(), "cv-studio-settings-"));
  const file = path.join(root, "settings.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { CARD_VAULT_AI_CONFIG_PATH: file, CARD_VAULT_AI_PROVIDER: "deepseek", OPENAI_API_KEY: "fixture-shared", CARD_VAULT_STUDIO_API_KEY: "fixture-independent" };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  writeFileSync(file, "{}");
  assert.equal(getStudioAiSettings().apiKey, "fixture-shared");
  assert.equal(getStudioAiSettings().imageModel, "gpt-image-2");
  writeFileSync(file, JSON.stringify({ studio: { keySource: "independent", model: "fixture-image" } }));
  assert.equal(getAiSettings().provider, "deepseek");
  assert.equal(getStudioAiSettings().apiKey, "fixture-independent");
  assert.equal(getStudioAiSettings().imageModel, "fixture-image");
  process.env.CARD_VAULT_STUDIO_API_KEY = "";
  assert.equal(getStudioAiSettings().apiKey, "");
});
