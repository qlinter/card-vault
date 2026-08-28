import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudflareHeaders,
  cloudflareRobots,
  dropReadme,
  renderIndex,
  renderNotFound,
  renderPreviewDocument,
  renderSectionPage,
  renderSubjectPage,
  shareGalleryFeaturedCardLimit,
  shareGallerySegmentSize,
  siteCss
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
  assert.match(html, /data-gallery-protocol="3"/);
  assert.match(html, /data-gallery-template="custom"/);
  assert.match(siteCss(), /--gallery-cover-safe-inline/);
  assert.match(siteCss(), /max-width: 1024px/);
  assert.match(siteCss(), /body\.theme-football[\s\S]*background: var\(--panel\)/);
  assert.match(siteCss(), /text-scale-large[\s\S]*106px/);
  assert.match(siteCss(), /density-compact[\s\S]*minmax\(126px, 1fr\)/);
  assert.match(siteCss(), /image-fit-contain[\s\S]*padding: 10px/);
  assert.doesNotMatch(html, /data-preview-detail-layer/);
});

test("explicit featured cards lead the carousel and expose their stories", () => {
  const second = { ...data.cards[0], id: "card-2", href: "cards/card-2.html", playerName: "重点球员", displayTitle: "重点标题", description: "为什么值得收藏" };
  const html = renderIndex({
    ...data,
    presentation: { ...defaultSharePresentation, featuredCardIds: ["card-2"] },
    cards: [data.cards[0], second]
  });
  assert.match(html, /id="featured-stories-title">重点卡故事/);
  assert.match(html, /为什么值得收藏/);
  assert.ok(html.indexOf('href="cards/card-2.html"') < html.indexOf('href="cards/card-1.html"'));
  assert.match(html, /class="card carousel-card is-featured"/);
});

test("Cloudflare Drop export is noindex and includes temporary-publish guidance", () => {
  const cloudData = { ...data, mode: "drop" as const };
  assert.match(renderIndex(cloudData), /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(renderNotFound(cloudData), /一小时临时预览/);
  assert.match(dropReadme(cloudData), /不记录临时发布地址或认领链接/);
  assert.match(cloudflareHeaders(), /X-Robots-Tag: noindex/);
  assert.match(cloudflareRobots(), /Disallow: \/$/m);
});

test("static gallery uses responsive images and links section and subject pages", () => {
  const richData: ExportData = {
    ...data,
    coverImage: "assets/images/cover.webp",
    sections: [{ ...data.sections[0], href: "sections/featured.html" }],
    subjects: [{ name: "测试球员", href: "subjects/player.html", cardIds: ["card-1"] }],
    cards: [{
      ...data.cards[0],
      images: [{
        src: "assets/images/card.webp",
        thumbnailSrc: "assets/images/card-thumb.webp",
        width: 1200,
        height: 1600
      }]
    }]
  };

  const index = renderIndex(richData);
  assert.match(index, /href="sections\/featured\.html"/);
  assert.match(index, /href="subjects\/player\.html"/);
  assert.match(index, /srcset="assets\/images\/card-thumb\.webp 640w, assets\/images\/card\.webp 1600w"/);
  assert.match(index, /rel="preload" as="image" href="assets\/images\/cover\.webp"/);

  const sectionPage = renderSectionPage(richData, richData.sections[0]);
  assert.match(sectionPage, /src="\.\.\/assets\/images\/card-thumb\.webp"/);
  assert.match(sectionPage, /href="\.\.\/cards\/card-1\.html"/);
  const subjectPage = renderSubjectPage(richData, richData.subjects![0]);
  assert.match(subjectPage, /卡片主体专题/);
  assert.match(subjectPage, /汇集 测试球员/);
});

test("preview rendering honors unprocessed card and cover rotations", () => {
  const rotatedImage = {
    src: "assets/images/card.png",
    thumbnailSrc: "assets/images/card.png",
    width: 400,
    height: 800,
    rotation: 90,
    sourceRotation: 90
  };
  const html = renderPreviewDocument({
    ...data,
    coverImage: rotatedImage.src,
    coverRotation: 90,
    cards: [{ ...data.cards[0], images: [rotatedImage] }]
  });

  assert.match(html, /hero-cover[^>]*><img[^>]*transform:rotate\(90deg\)/);
  assert.match(html, /card-image[^>]*><img[^>]*transform:rotate\(90deg\)/);
});

test("large galleries cap the carousel and reveal the complete collection in segments", () => {
  const cards = Array.from({ length: shareGallerySegmentSize + 7 }, (_, index) => ({
    ...data.cards[0],
    id: `card-${index + 1}`,
    href: `cards/card-${index + 1}.html`,
    displayTitle: `卡片 ${index + 1}`
  }));
  const html = renderIndex({ ...data, sections: [], cards });

  assert.equal((html.match(/class="card carousel-card"/g) ?? []).length, shareGalleryFeaturedCardLimit);
  assert.equal((html.match(/data-segment-item/g) ?? []).length, cards.length);
  assert.match(html, new RegExp(`data-segment-size="${shareGallerySegmentSize}"`));
  assert.match(html, /显示更多（剩余 7）/);
});
