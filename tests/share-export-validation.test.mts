import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  validateExportDirectory,
  validatePublicExportData
} from "../lib/share-export-validation.ts";
import type { ExportData } from "../lib/share-export-types.ts";
import { defaultSharePresentation } from "../lib/share-presentation.ts";

function exportData(): ExportData {
  return {
    title: "测试展馆",
    theme: "spotlight",
    presentation: defaultSharePresentation,
    subtitle: null,
    description: null,
    themeNarrative: null,
    themeHighlights: null,
    groupNotes: null,
    coverImage: null,
    backgroundImage: null,
    generatedAt: new Date(0).toISOString(),
    mode: "drop",
    sections: [],
    cards: []
  };
}

test("public export validation rejects private keys and local paths", () => {
  const safeIssues = validatePublicExportData(exportData());
  assert.deepEqual(safeIssues, []);

  const unsafe = exportData() as ExportData & { purchasePrice: number; extraPath: string };
  unsafe.purchasePrice = 100;
  unsafe.extraPath = "file:///C:/Users/example/private.jpg";
  const issues = validatePublicExportData(unsafe);
  assert.ok(issues.some((issue) => issue.code === "private-field"));
  assert.ok(issues.some((issue) => issue.code === "local-path"));
});

test("export directory validation detects broken links and accepts a complete package", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "card-vault-export-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), '<html lang="zh-CN"><head><meta name="viewport" content="width=device-width"><link href="assets/site.css"></head><body><main><h1>展馆</h1><a href="cards/card.html">卡片</a><img alt="卡片" src="assets/thumb.webp" srcset="assets/thumb.webp 640w, assets/full.webp 1600w"></main></body></html>', "utf8");
  await writeFile(path.join(root, "assets", "site.css"), "body{}", "utf8");
  await writeFile(path.join(root, "assets", "thumb.webp"), "thumb", "utf8");

  const broken = await validateExportDirectory(root);
  assert.equal(broken.valid, false);
  assert.ok(broken.issues.some((issue) => issue.code === "broken-reference"));
  assert.ok(broken.issues.some((issue) => issue.message.includes("assets/full.webp")));

  await mkdir(path.join(root, "cards"));
  await writeFile(path.join(root, "cards", "card.html"), '<html lang="zh-CN"><head><meta name="viewport" content="width=device-width"></head><body><main><h1>卡片</h1><a href="../index.html">返回</a></main></body></html>', "utf8");
  await writeFile(path.join(root, "assets", "full.webp"), "full", "utf8");
  const complete = await validateExportDirectory(root);
  assert.equal(complete.valid, true);
  assert.equal(complete.fileCount, 5);
});
