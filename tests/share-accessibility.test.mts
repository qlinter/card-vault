import assert from "node:assert/strict";
import test from "node:test";
import { auditExportHtmlAccessibility, auditShareAccessibility } from "../lib/share-accessibility.ts";
import type { ExportData } from "../lib/share-export-types.ts";
import { defaultSharePresentation } from "../lib/share-presentation.ts";

const data: ExportData = {
  title: "测试展馆", theme: "spotlight", presentation: { ...defaultSharePresentation, featuredCardIds: ["card-1"] },
  subtitle: null, description: null, themeNarrative: null, themeHighlights: null, groupNotes: null,
  coverImage: null, backgroundImage: null, generatedAt: new Date(0).toISOString(), mode: "static", sections: [],
  cards: [{ id: "card-1", playerName: "球员", cardTitle: "卡片", displayTitle: "卡片", description: "", sport: "篮球", team: null, year: null, brand: null, productLine: null, subsetName: null, parallel: null, cardNumber: null, serialNumber: null, serialRange: null, isRookie: false, isAutograph: false, autoType: null, isPatch: false, patchType: null, gradingCompany: null, grade: null, certNumber: null, href: "cards/card.html", images: [] }]
};

test("gallery accessibility audit reports actionable non-blocking content gaps", () => {
  const issues = auditShareAccessibility(data);
  assert.ok(issues.some((issue) => issue.code === "a11y-featured-story" && issue.level === "warning"));
  assert.ok(issues.some((issue) => issue.code === "a11y-card-image-placeholder"));
  assert.equal(issues.some((issue) => issue.level === "error"), false);
});

test("rendered HTML audit enforces language, landmarks, headings, alt text and button labels", () => {
  const invalid = auditExportHtmlAccessibility("index.html", '<html><body><img src="x"><button><svg></svg></button></body></html>');
  assert.ok(invalid.some((issue) => issue.code === "a11y-html-lang"));
  assert.ok(invalid.some((issue) => issue.code === "a11y-image-alt"));
  assert.ok(invalid.some((issue) => issue.code === "a11y-button-label"));
  const valid = auditExportHtmlAccessibility("index.html", '<html lang="zh-CN"><head><meta name="viewport" content="width=device-width"></head><body><main><h1>标题</h1><img src="x" alt="图片"><button type="button" aria-label="下一张"><svg></svg></button></main></body></html>');
  assert.deepEqual(valid, []);
});
