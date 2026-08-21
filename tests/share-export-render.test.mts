import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudflareHeaders,
  cloudflareRobots,
  dropReadme,
  renderIndex,
  renderNotFound,
  renderPreviewDocument
} from "../lib/share-export-render.ts";
import type { ExportData } from "../lib/share-export-types.ts";
import { defaultSharePresentation } from "../lib/share-presentation.ts";
import { sharePreviewSandboxPolicy } from "../lib/share-preview-policy.ts";

const data: ExportData = {
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
  mode: "static",
  sections: [{ id: "section", title: "精选", description: "", layout: "grid", cardIds: ["card-1"] }],
  cards: [{
    id: "card-1",
    playerName: "测试球员",
    cardTitle: "测试卡片",
    displayTitle: "单卡详情",
    description: "公开说明",
    sport: "篮球",
    team: null,
    year: null,
    brand: null,
    productLine: null,
    subsetName: null,
    parallel: null,
    cardNumber: null,
    serialNumber: null,
    serialRange: null,
    isRookie: false,
    isAutograph: false,
    autoType: null,
    isPatch: false,
    patchType: null,
    gradingCompany: null,
    grade: null,
    certNumber: null,
    href: "cards/card-1.html",
    images: []
  }]
};

test("application preview opens an inline card detail without navigating its iframe", () => {
  const html = renderPreviewDocument(data);
  assert.match(html, /data-preview-card="card-1"/);
  assert.match(html, /data-preview-detail="card-1"/);
  assert.match(html, /返回展馆/);
  assert.doesNotMatch(html, /href="#card-/);
  assert.doesNotMatch(html, /href="cards\/card-1\.html"/);
  assert.match(html, /data-carousel-prev aria-label="上一张"><svg viewBox="0 0 24 24"/);
  assert.match(html, /data-carousel-next aria-label="下一张"><svg viewBox="0 0 24 24"/);
});

test("application preview keeps a same-origin sandbox for local theme and media assets", () => {
  assert.equal(sharePreviewSandboxPolicy, "allow-scripts allow-same-origin");

  const html = renderPreviewDocument({
    ...data,
    theme: "tennis",
    backgroundImage: "/share-themes/tennis-center.webp"
  });
  assert.match(html, /class="theme-tennis[^\"]*has-custom-bg"/);
  assert.match(html, /--share-bg-image:url\('\/share-themes\/tennis-center\.webp'\)/);
});

test("static export keeps standalone card page links", () => {
  const html = renderIndex(data);
  assert.match(html, /href="cards\/card-1\.html"/);
  assert.doesNotMatch(html, /data-preview-detail-layer/);
});

test("Cloudflare Drop export is noindex and includes temporary-publish guidance", () => {
  const cloudData = { ...data, mode: "drop" as const };
  assert.match(renderIndex(cloudData), /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(renderNotFound(cloudData), /一小时临时预览/);
  assert.match(dropReadme(cloudData), /不记录临时发布地址或认领链接/);
  assert.match(cloudflareHeaders(), /X-Robots-Tag: noindex/);
  assert.match(cloudflareRobots(), /Disallow: \/$/m);
});
