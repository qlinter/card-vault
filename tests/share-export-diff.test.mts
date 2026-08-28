import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareShareExportData,
  findPreviousShareExportData,
  renderShareExportDiffReport
} from "../lib/share-export-diff.ts";
import type { ExportData } from "../lib/share-export-types.ts";
import { defaultSharePresentation } from "../lib/share-presentation.ts";

function data(cardIds: string[]): ExportData {
  return {
    title: "展馆", theme: "spotlight", presentation: defaultSharePresentation, subtitle: null, description: null,
    themeNarrative: null, themeHighlights: null, groupNotes: null, coverImage: null, backgroundImage: null,
    generatedAt: new Date(0).toISOString(), mode: "static", sections: [], cards: cardIds.map((id) => ({
      id, playerName: `球员 ${id}`, cardTitle: "卡片", displayTitle: "标题", description: "故事", sport: "篮球",
      team: null, year: null, brand: null, productLine: null, subsetName: null, parallel: null, cardNumber: null,
      serialNumber: null, serialRange: null, isRookie: false, isAutograph: false, autoType: null, isPatch: false,
      patchType: null, gradingCompany: null, grade: null, certNumber: null, href: `cards/${id}.html`, images: []
    }))
  };
}

test("export diff distinguishes first export, added, removed, changed and presentation updates", () => {
  const first = compareShareExportData(data(["a"]), null);
  assert.equal(first.isFirstExport, true);
  assert.deepEqual(first.addedCardIds, ["a"]);

  const previous = data(["a", "b"]);
  const current = data(["a", "c"]);
  current.cards[0].description = "新故事";
  current.presentation = { ...defaultSharePresentation, featuredCardIds: ["a"] };
  const diff = compareShareExportData(current, previous);
  assert.deepEqual(diff.addedCardIds, ["c"]);
  assert.deepEqual(diff.removedCardIds, ["b"]);
  assert.deepEqual(diff.changedCardIds, ["a"]);
  assert.equal(diff.presentationChanged, true);
  const report = renderShareExportDiffReport(diff, current);
  assert.match(report, /新增卡片：1/);
  assert.match(report, /球员 b \/ 标题/);
  assert.doesNotMatch(report, /  - b$/m);
});

test("previous export lookup follows a stable collection key across slug changes and skips failed exports", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "card-vault-export-history-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  async function writeExport(folderName: string, options: { passed: boolean; collectionKey: string; title: string }) {
    const folder = path.join(root, folderName);
    await mkdir(path.join(folder, "assets"), { recursive: true });
    await writeFile(path.join(folder, "publish-manifest.json"), JSON.stringify({
      slug: "old-title",
      mode: "static",
      collectionKey: options.collectionKey
    }));
    await writeFile(path.join(folder, "CHECK-REPORT.md"), `- 结果：${options.passed ? "通过" : "未通过"}`);
    await writeFile(path.join(folder, "assets", "data.json"), JSON.stringify({
      ...data(["a"]),
      title: options.title
    }));
  }

  await writeExport("old-title-static-20260828090000", { passed: true, collectionKey: "stable-key", title: "有效历史" });
  await writeExport("new-title-static-20260828100000", { passed: false, collectionKey: "stable-key", title: "失败导出" });
  await writeExport("another-static-20260828110000", { passed: true, collectionKey: "another-key", title: "其他展馆" });

  const previous = await findPreviousShareExportData(root, {
    slug: "new-title",
    mode: "static",
    collectionKey: "stable-key"
  });

  assert.equal(previous?.title, "有效历史");
});
