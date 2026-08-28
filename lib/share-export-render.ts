import type { ExportCard, ExportData, ExportImage, ExportSection, ExportSubject } from "./share-export-types.ts";
import { fallbackShareSections } from "./share-sections.ts";
import { normalizeShareTheme, shareThemeCssVariables } from "./share-themes.ts";
import { normalizeCardImageRotation } from "./card-image-rotation.ts";

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphHtml(value: string | null | undefined): string {
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

export const shareGalleryFeaturedCardLimit = 24;
export const shareGallerySegmentSize = 48;

function renderImage(
  image: ExportImage,
  alt: string,
  options: { prefix?: string; thumbnail?: boolean; eager?: boolean; sizes?: string } = {}
): string {
  const prefix = options.prefix ?? "";
  const source = options.thumbnail ? image.thumbnailSrc : image.src;
  const dimensions = image.width > 0 && image.height > 0 ? ` width="${image.width}" height="${image.height}"` : "";
  const srcset = image.thumbnailSrc !== image.src
    ? ` srcset="${escapeHtml(`${prefix}${image.thumbnailSrc}`)} 640w, ${escapeHtml(`${prefix}${image.src}`)} 1600w" sizes="${escapeHtml(options.sizes ?? "(max-width: 820px) 78vw, 330px")}"`
    : "";
  const rotation = normalizeCardImageRotation(image.rotation);
  const rotationStyle = rotation
    ? ` style="transform:rotate(${rotation}deg) scale(${rotation % 180 === 0 ? 1 : 0.72});transform-origin:center"`
    : "";
  return `<img src="${escapeHtml(`${prefix}${source}`)}"${srcset}${dimensions}${rotationStyle} alt="${escapeHtml(alt)}" loading="${options.eager ? "eager" : "lazy"}" decoding="async"${options.eager ? ' fetchpriority="high"' : ""} />`;
}

function cardMeta(card: ExportCard): Array<[string, string]> {
  const rows: Array<[string, string | null]> = [
    ["年份", card.year],
    ["运动", card.sport],
    ["Team", card.team],
    ["品牌", card.brand],
    ["产品线", card.productLine],
    ["子系列", card.subsetName],
    ["平行版本", card.parallel],
    ["卡号", card.cardNumber],
    ["限量编号", [card.serialNumber, card.serialRange].filter(Boolean).join(" / ") || null],
    ["评级", [card.gradingCompany, card.grade].filter(Boolean).join(" ") || null],
    ["证书号", card.certNumber],
    ["签名", card.isAutograph ? card.autoType || "是" : null],
    ["Patch", card.isPatch ? card.patchType || "是" : null],
    ["Rookie", card.isRookie ? "是" : null]
  ];

  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

function renderLayout(
  title: string,
  body: string,
  data: ExportData,
  depth: "root" | "card" = "root",
  inlineAssets = false,
  preloadImage?: string | null
): string {
  const prefix = depth === "root" ? "" : "../";
  const presentation = data.presentation;
  const variables = {
    ...shareThemeCssVariables(data.theme),
    "--share-bg-position-x": `${presentation.backgroundPosition.x}%`,
    "--share-bg-position-y": `${presentation.backgroundPosition.y}%`,
    "--gallery-panel-alpha": (presentation.panelOpacity / 100).toFixed(2)
  };
  const backgroundVariable = data.backgroundImage
    ? `--share-bg-image:url('${prefix}${escapeHtml(data.backgroundImage)}');`
    : "";
  const variableStyle = Object.entries(variables).map(([key, value]) => `${key}:${value};`).join("");
  const backgroundStyle = ` style="${backgroundVariable}${variableStyle}"`;
  const themeClass = `theme-${normalizeShareTheme(data.theme)}`;
  const bodyClass = ` class="${themeClass} layout-${presentation.layout} typography-${presentation.typography} density-${presentation.density} image-fit-${presentation.imageFit} text-scale-${presentation.textScale} template-${presentation.templateId}${data.backgroundImage ? " has-custom-bg" : ""}" data-gallery-protocol="${presentation.version}" data-gallery-template="${presentation.templateId}"`;
  const assets = inlineAssets
    ? `<style>${siteCss()}</style>\n  <script>${siteJs()}</script>`
    : `<link rel="stylesheet" href="${prefix}assets/site.css" />\n  <script src="${prefix}assets/site.js" defer></script>`;
  const robots = data.mode === "drop" ? `\n  <meta name="robots" content="noindex, nofollow, noarchive" />` : "";
  const preload = preloadImage ? `\n  <link rel="preload" as="image" href="${escapeHtml(`${prefix}${preloadImage}`)}" />` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>${robots}${preload}
  ${assets}
</head>
<body${bodyClass}${backgroundStyle}>
${body}
</body>
</html>
`;
}

function cardLinkOpen(card: ExportCard, className: string, inlineDetails: boolean, content: string, ariaLabel?: string): string {
  if (inlineDetails) {
    return `<button type="button" class="${className} preview-card-link" data-preview-card="${escapeHtml(card.id)}"${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ""}>${content}</button>`;
  }
  return `<a class="${className}" href="${escapeHtml(card.href)}"${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ""}>${content}</a>`;
}

function renderGalleryCard(card: ExportCard, className: string, inlineDetails = false, prefix = "", featured = false): string {
  const image = card.images[0]
    ? renderImage(card.images[0], card.displayTitle, { prefix, thumbnail: true, sizes: "(max-width: 820px) 48vw, 220px" })
    : `<div class="placeholder" role="img" aria-label="无可用图片"></div>`;
  const linkedCard = prefix ? { ...card, href: `${prefix}${card.href}` } : card;
  return cardLinkOpen(linkedCard, className, inlineDetails, `
    ${featured ? `<span class="featured-badge">重点卡</span>` : ""}
    ${image}
    <span><strong>${escapeHtml(card.playerName)}</strong><small>${escapeHtml(card.displayTitle)}</small></span>
  `);
}

function legacySections(data: ExportData) {
  return fallbackShareSections({
    themeNarrative: data.themeNarrative,
    themeHighlights: data.themeHighlights,
    groupNotes: data.groupNotes,
    cardIds: data.cards.map((card) => card.id)
  });
}

function renderSections(data: ExportData, inlineDetails = false): string {
  const sections: ExportSection[] = data.sections.length > 0
    ? data.sections
    : legacySections(data).map((section) => ({ ...section }));
  if (sections.length === 0) {
    return "";
  }
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  const featuredIds = new Set(data.presentation.featuredCardIds);
  return `<section class="curated-sections">
    ${sections.map((section, index) => {
      const sectionCards = section.cardIds.map((cardId) => cards.get(cardId)).filter((card): card is ExportCard => Boolean(card));
      const cardHtml = sectionCards.length > 0
        ? `<div class="section-cards">${sectionCards.map((card) => renderGalleryCard(card, "section-card", inlineDetails, "", featuredIds.has(card.id))).join("")}</div>`
        : "";
      return `<article class="curated-section section-${escapeHtml(section.layout)}">
        <div class="section-number">${String(index + 1).padStart(2, "0")}</div>
        <div class="section-copy"><p class="kicker">策展章节</p><h2>${!inlineDetails && section.href ? `<a href="${escapeHtml(section.href)}">${escapeHtml(section.title)}</a>` : escapeHtml(section.title)}</h2>${paragraphHtml(section.description)}</div>
        ${cardHtml}
      </article>`;
    }).join("")}
  </section>`;
}

function orderedFeaturedCards(data: ExportData): ExportCard[] {
  const cardsById = new Map(data.cards.map((card) => [card.id, card]));
  const explicit = data.presentation.featuredCardIds
    .map((cardId) => cardsById.get(cardId))
    .filter((card): card is ExportCard => Boolean(card));
  const explicitIds = new Set(explicit.map((card) => card.id));
  return [...explicit, ...data.cards.filter((card) => !explicitIds.has(card.id))];
}

function renderFeaturedStories(data: ExportData, inlineDetails = false): string {
  const featuredIds = new Set(data.presentation.featuredCardIds);
  const cards = orderedFeaturedCards(data).filter((card) => featuredIds.has(card.id));
  if (cards.length === 0) return "";
  return `<section class="featured-stories" aria-labelledby="featured-stories-title">
    <div class="featured-stories-head"><p class="kicker">重点馆藏</p><h2 id="featured-stories-title">重点卡故事</h2><span>${cards.length} 张</span></div>
    <div class="featured-story-grid">${cards.map((card) => {
      const image = card.images[0]
        ? renderImage(card.images[0], card.displayTitle, { thumbnail: true, sizes: "(max-width: 820px) 34vw, 180px" })
        : `<div class="placeholder" role="img" aria-label="无可用图片"></div>`;
      return cardLinkOpen(card, "featured-story", inlineDetails, `${image}<span><small>${escapeHtml(card.playerName)}</small><strong>${escapeHtml(card.displayTitle)}</strong>${paragraphHtml(card.description || "这张重点卡尚未添加故事。")}</span>`, `查看重点卡 ${card.displayTitle}`);
    }).join("")}</div>
  </section>`;
}

function renderHero(data: ExportData, coverImage: string | undefined, coverTitle: string): string {
  const playerCount = new Set(data.cards.map((card) => card.playerName)).size;
  return `<section class="hero">
    <div class="hero-copy">
      <p class="kicker">Card Vault 展馆</p>
      <h1>${escapeHtml(data.title)}</h1>
      ${data.subtitle ? `<p class="subtitle">${escapeHtml(data.subtitle)}</p>` : ""}
      ${paragraphHtml(data.description)}
      <div class="stats"><span>${data.cards.length} 张卡片</span><span>${playerCount} 个卡片主体</span></div>
    </div>
    ${coverImage ? `<div class="hero-cover"><img src="${escapeHtml(coverImage)}"${normalizeCardImageRotation(data.coverRotation) ? ` style="transform:rotate(${normalizeCardImageRotation(data.coverRotation)}deg) scale(${normalizeCardImageRotation(data.coverRotation) % 180 === 0 ? 1 : 0.72});transform-origin:center"` : ""} alt="${escapeHtml(coverTitle)}" loading="eager" decoding="async" fetchpriority="high" /></div>` : ""}
  </section>`;
}

function renderCarousel(data: ExportData, inlineDetails = false): string {
  const explicitFeaturedIds = new Set(data.presentation.featuredCardIds);
  const featuredCards = orderedFeaturedCards(data).slice(0, shareGalleryFeaturedCardLimit);
  const cardsHtml = featuredCards.map((card, index) => {
    const image = card.images[0]
      ? renderImage(card.images[0], card.displayTitle, { eager: index === 0 })
      : `<div class="placeholder" role="img" aria-label="无可用图片"></div>`;
    return `<article class="card carousel-card${explicitFeaturedIds.has(card.id) ? " is-featured" : ""}" data-index="${index}" aria-label="${escapeHtml(`${card.playerName} ${card.displayTitle}`)}" style="--offset:${index};--abs-offset:${Math.abs(index)}">
      ${explicitFeaturedIds.has(card.id) ? `<span class="featured-badge">重点卡</span>` : ""}
      ${cardLinkOpen(card, "card-image", inlineDetails, image, `查看 ${card.displayTitle}`)}
    </article>`;
  }).join("");
  return `<section class="carousel" aria-label="卡片立体切换">
    <div class="carousel-toolbar">
      <button type="button" data-carousel-prev aria-label="上一张"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
      <span><strong data-carousel-current>1</strong> / ${featuredCards.length}${data.cards.length > featuredCards.length ? ` <small>精选自 ${data.cards.length}</small>` : ""}</span>
      <button type="button" data-carousel-next aria-label="下一张"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
    </div>
    <div class="card-stage">${cardsHtml}</div>
  </section>`;
}

function renderCollectionBrowser(data: ExportData, inlineDetails = false): string {
  if (data.cards.length <= shareGalleryFeaturedCardLimit) return "";
  return `<section class="collection-browser" data-segmented-gallery data-segment-size="${shareGallerySegmentSize}">
    <div class="collection-browser-head"><div><p class="kicker">完整馆藏</p><h2>浏览全部 ${data.cards.length} 张卡片</h2></div><span data-segment-status>已显示 ${Math.min(shareGallerySegmentSize, data.cards.length)} / ${data.cards.length}</span></div>
    <div class="collection-card-grid">${data.cards.map((card, index) => `<div data-segment-item${index >= shareGallerySegmentSize ? " hidden" : ""}>${renderGalleryCard(card, "section-card", inlineDetails, "", data.presentation.featuredCardIds.includes(card.id))}</div>`).join("")}</div>
    ${data.cards.length > shareGallerySegmentSize ? `<button type="button" class="segment-more" data-segment-more>显示更多（剩余 ${data.cards.length - shareGallerySegmentSize}）</button>` : ""}
  </section>`;
}

function renderInlineCardDetails(data: ExportData): string {
  return `<div class="preview-detail-layer" data-preview-detail-layer hidden>
    ${data.cards.map((card) => {
      const images = card.images
        .map((image) => renderImage(image, card.displayTitle))
        .join("");
      const meta = cardMeta(card)
        .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
        .join("");
      return `<article class="preview-detail" data-preview-detail="${escapeHtml(card.id)}" hidden>
        <button type="button" class="preview-detail-back" data-preview-back>← 返回展馆</button>
        <section class="detail">
          <div class="detail-images">${images || `<div class="placeholder large" role="img" aria-label="无可用图片"></div>`}</div>
          <div class="detail-copy">
            <p class="kicker">${escapeHtml(data.title)}</p>
            <h1>${escapeHtml(card.playerName)}</h1>
            <p class="subtitle">${escapeHtml(card.displayTitle)}</p>
            ${paragraphHtml(card.description)}
            <div class="meta">${meta}</div>
          </div>
        </section>
      </article>`;
    }).join("")}
  </div>`;
}

export function renderIndex(data: ExportData, inlineAssets = false, inlineDetails = false): string {
  const cover = data.cards.find((card) => card.images.length > 0);
  const coverImage = data.coverImage ?? cover?.images[0]?.src;
  const groups = new Map<string, number>();
  for (const card of data.cards) {
    groups.set(card.playerName, (groups.get(card.playerName) ?? 0) + 1);
  }

  const subjects = new Map((data.subjects ?? []).map((subject) => [subject.name, subject]));
  const groupHtml = [...groups.entries()]
    .map(([name, count]) => {
      const content = `${escapeHtml(name)} <strong>${count}</strong>`;
      const subject = subjects.get(name);
      return subject && !inlineDetails ? `<a class="chip" href="${escapeHtml(subject.href)}">${content}</a>` : `<span class="chip">${content}</span>`;
    })
    .join("");
  const hero = renderHero(data, coverImage, cover?.displayTitle ?? data.title);
  const sections = renderSections(data, inlineDetails);
  const carousel = renderCarousel(data, inlineDetails);
  const featuredStories = renderFeaturedStories(data, inlineDetails);
  const collectionBrowser = renderCollectionBrowser(data, inlineDetails);
  const layoutContent = data.presentation.layout === "archive"
    ? `${hero}${featuredStories}<div class="archive-catalog"><aside><p class="kicker">馆藏索引</p><div class="groups">${groupHtml}</div></aside>${sections}</div>${carousel}${collectionBrowser}`
    : data.presentation.layout === "arena"
      ? `${hero}${featuredStories}<section class="arena-board"><div><strong>${data.cards.length}</strong><span>CARDS</span></div><div><strong>${groups.size}</strong><span>PLAYERS</span></div><div class="groups">${groupHtml}</div></section>${carousel}${sections}${collectionBrowser}`
      : `${hero}${featuredStories}${sections}<div class="groups">${groupHtml}</div>${carousel}${collectionBrowser}`;
  const body = `<main class="shell" data-preview-gallery>${layoutContent}</main>${inlineDetails ? renderInlineCardDetails(data) : ""}`;

  return renderLayout(data.title, body, data, "root", inlineAssets, coverImage);
}

export function renderPreviewDocument(data: ExportData): string {
  return renderIndex(data, true, true);
}

export function renderCardPage(data: ExportData, card: ExportCard): string {
  const images = card.images
    .map((image, index) => renderImage(image, card.displayTitle, { prefix: "../", eager: index === 0, sizes: "(max-width: 820px) 100vw, 720px" }))
    .join("");
  const meta = cardMeta(card)
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");

  const subject = data.subjects?.find((entry) => entry.name === card.playerName);
  const body = `<main class="shell detail-shell">
    <nav class="back"><a href="../index.html">返回展馆</a>${subject ? `<a href="../${escapeHtml(subject.href)}">查看${escapeHtml(subject.name)}专题</a>` : ""}</nav>
    <section class="detail">
      <div class="detail-images">${images || `<div class="placeholder large" role="img" aria-label="无可用图片"></div>`}</div>
      <div class="detail-copy">
        <p class="kicker">${data.presentation.featuredCardIds.includes(card.id) ? "重点卡 · " : ""}${escapeHtml(data.title)}</p>
        <h1>${escapeHtml(card.playerName)}</h1>
        <p class="subtitle">${escapeHtml(card.displayTitle)}</p>
        ${paragraphHtml(card.description)}
        <div class="meta">${meta}</div>
      </div>
    </section>
  </main>`;

  return renderLayout(`${card.playerName} - ${data.title}`, body, data, "card", false, card.images[0]?.src);
}

function renderCollectionPage(data: ExportData, title: string, kicker: string, description: string, cards: ExportCard[]): string {
  const body = `<main class="shell collection-page">
    <nav class="back"><a href="../index.html">← 返回展馆首页</a></nav>
    <header class="collection-page-head"><p class="kicker">${escapeHtml(kicker)}</p><h1>${escapeHtml(title)}</h1>${paragraphHtml(description)}<span>${cards.length} 张卡片</span></header>
    <div class="collection-card-grid">${cards.map((card) => renderGalleryCard(card, "section-card", false, "../", data.presentation.featuredCardIds.includes(card.id))).join("")}</div>
  </main>`;
  return renderLayout(`${title} - ${data.title}`, body, data, "card", false, cards.find((card) => card.images.length > 0)?.images[0]?.src);
}

export function renderSectionPage(data: ExportData, section: ExportSection): string {
  const cardsById = new Map(data.cards.map((card) => [card.id, card]));
  const cards = section.cardIds.map((cardId) => cardsById.get(cardId)).filter((card): card is ExportCard => Boolean(card));
  return renderCollectionPage(data, section.title, "策展章节", section.description, cards);
}

export function renderSubjectPage(data: ExportData, subject: ExportSubject): string {
  const cards = data.cards.filter((card) => subject.cardIds.includes(card.id));
  return renderCollectionPage(data, subject.name, "卡片主体专题", `汇集 ${subject.name} 在本展馆中的全部卡片。`, cards);
}

export function renderNotFound(data: ExportData): string {
  const description = data.mode === "drop"
    ? "这个地址可能有误，或者 Cloudflare Drop 的一小时临时预览已经结束。"
    : "这个地址可能有误，请返回展馆首页继续浏览。";
  const body = `<main class="shell">
    <section class="detail-copy">
      <p class="kicker">Card Vault 临时分享</p>
      <h1>页面不存在</h1>
      <p>${description}</p>
      <a class="back" href="index.html">← 返回展馆首页</a>
    </section>
  </main>`;
  return renderLayout(`页面不存在 - ${data.title}`, body, data);
}

export function siteCss(): string {
  return `:root {
  color-scheme: dark;
  --bg: #08090b;
  --text: var(--gallery-text, #f5f7fb);
  --muted: var(--gallery-muted, #a8b0bd);
  --accent: var(--gallery-accent, #d7bb7a);
  --line: var(--gallery-line, rgba(255, 255, 255, 0.14));
  --panel: rgba(var(--gallery-panel-rgb, 8, 14, 24), var(--gallery-panel-alpha, 0.14));
  --panel-strong: rgba(var(--gallery-panel-rgb, 8, 14, 24), calc(var(--gallery-panel-alpha, 0.14) + 0.14));
  --gallery-content-max: 1160px;
  --gallery-page-gutter: clamp(16px, 3vw, 32px);
  --gallery-cover-safe-inline: clamp(0px, 2.2vw, 28px);
  --gallery-section-gap: clamp(18px, 2.5vw, 30px);
  --gallery-copy-measure: 68ch;
  --gallery-title-measure: 12ch;
}
* { box-sizing: border-box; }
body {
  position: relative;
  margin: 0;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(215, 187, 122, 0.16), transparent 28rem),
    linear-gradient(145deg, #08090b 0%, #111722 55%, #06070a 100%);
  color: var(--text);
}
body.has-custom-bg::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  background: var(--share-bg-image) var(--share-bg-position-x, 50%) var(--share-bg-position-y, 50%) / cover no-repeat;
}
a { color: inherit; text-decoration: none; }
button.preview-card-link { color: inherit; font: inherit; text-align: inherit; cursor: pointer; }
img { display: block; max-width: 100%; }
.text-scale-small { font-size: 14px; }
.text-scale-standard { font-size: 16px; }
.text-scale-large { font-size: 18px; }
.shell { position: relative; z-index: 1; width: min(var(--gallery-content-max), calc(100% - (var(--gallery-page-gutter) * 2))); margin: 0 auto; padding: 32px 0 48px; }
body.has-custom-bg .back {
  display: inline-flex;
  padding: 9px 13px;
}
body.has-custom-bg .hero-copy {
  padding: clamp(20px, 3vw, 32px);
}
body.has-custom-bg .carousel-toolbar {
  width: fit-content;
  margin-inline: auto;
  padding: 9px 13px;
}
body.has-custom-bg .hero-copy h1,
body.has-custom-bg .detail-copy h1,
body.has-custom-bg .subtitle,
body.has-custom-bg .hero-copy p:not(.kicker):not(.subtitle),
body.has-custom-bg .curated-section p,
body.has-custom-bg .detail-copy p {
  color: var(--text);
  text-shadow: 0 2px 18px rgba(0,0,0,0.62);
}
.hero {
  min-height: 72vh;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.7fr);
  gap: var(--gallery-section-gap);
  align-items: center;
  padding-inline: var(--gallery-cover-safe-inline);
}
.hero-copy h1, .detail-copy h1 { max-inline-size: var(--gallery-title-measure); margin: 0; font-size: clamp(40px, 8vw, 92px); line-height: 0.96; letter-spacing: 0; overflow-wrap: anywhere; text-wrap: balance; }
.kicker { color: var(--accent); text-transform: uppercase; font-size: 12px; letter-spacing: 0; font-weight: 800; }
.subtitle { color: var(--muted); font-size: clamp(18px, 2.2vw, 26px); line-height: 1.45; }
.hero-copy p:not(.kicker):not(.subtitle), .curated-section p, .detail-copy p { max-inline-size: var(--gallery-copy-measure); color: var(--muted); line-height: 1.85; }
.hero-cover, .curated-section, .detail-images, .detail-copy {
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(18px);
}
.hero-cover { padding: 14px; }
.hero-cover img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.stats, .groups { display: flex; flex-wrap: wrap; gap: 10px; }
.stats span, .chip {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  padding: 8px 12px;
  font-size: 13px;
}
.curated-sections { display: grid; gap: var(--gallery-section-gap); margin: 0 0 var(--gallery-section-gap); }
.curated-section {
  position: relative;
  display: grid;
  grid-template-columns: 52px minmax(220px, 0.75fr) minmax(0, 1.25fr);
  gap: 22px;
  align-items: start;
  padding: clamp(20px, 3vw, 34px);
  overflow: hidden;
}
.curated-section h2 { margin: 0 0 12px; font-size: clamp(24px, 4vw, 42px); line-height: 1.08; }
.section-number { color: var(--accent); font-size: 13px; font-weight: 900; border-top: 2px solid currentColor; padding-top: 8px; }
.section-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.section-card { min-width: 0; padding: 0; border-radius: 12px; overflow: hidden; background: var(--panel-strong); border: 1px solid var(--line); }
.section-card img, .section-card .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.section-card span { display: grid; gap: 2px; padding: 10px; }
.section-card strong, .section-card small { overflow-wrap: anywhere; }
.section-card small { color: var(--muted); }
.featured-badge { position: absolute; z-index: 2; inset: 10px auto auto 10px; display: inline-flex !important; width: auto; padding: 6px 9px !important; border-radius: 999px; color: #111820; background: var(--accent); font-size: 11px; font-weight: 900; box-shadow: 0 6px 18px rgba(0,0,0,0.25); }
.section-card, .featured-story { position: relative; }
.featured-stories { display: grid; gap: 16px; margin: 0 0 var(--gallery-section-gap); padding: clamp(20px, 3vw, 34px); border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(18px); }
.featured-stories-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
.featured-stories-head h2 { margin: 3px 0 0; font-size: clamp(26px, 4vw, 42px); }
.featured-stories-head > span { color: var(--accent); font-weight: 900; }
.featured-story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.featured-story { display: grid; grid-template-columns: minmax(92px, 0.32fr) minmax(0, 1fr); gap: 14px; align-items: stretch; min-width: 0; padding: 0; overflow: hidden; border: 1px solid var(--line); background: var(--panel-strong); }
.featured-story > img, .featured-story > .placeholder { width: 100%; height: 100%; min-height: 170px; aspect-ratio: 3 / 4; object-fit: cover; }
.featured-story > span { display: grid; align-content: center; gap: 5px; padding: 14px 16px 14px 0; }
.featured-story strong { font-size: 18px; overflow-wrap: anywhere; }
.featured-story small, .featured-story p { color: var(--muted); }
.featured-story p { margin: 4px 0 0; line-height: 1.55; }
.section-editorial { grid-template-columns: 52px minmax(0, 1fr); }
.section-editorial .section-cards { grid-column: 2; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.section-rail .section-cards { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
.section-rail .section-card { flex: 0 0 min(190px, 48vw); scroll-snap-align: start; }
.section-grid .section-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.collection-browser { display: grid; gap: 18px; margin-top: var(--gallery-section-gap); padding-top: var(--gallery-section-gap); border-top: 1px solid var(--line); }
.collection-browser-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.collection-browser-head h2 { margin: 4px 0 0; font-size: clamp(26px, 4vw, 42px); }
.collection-browser-head > span { color: var(--muted); font-size: 13px; }
.collection-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.collection-card-grid > [data-segment-item] { min-width: 0; }
.collection-card-grid .section-card { display: block; height: 100%; }
.segment-more { justify-self: center; min-width: 220px; padding: 12px 18px; border: 1px solid var(--line); border-radius: 999px; color: var(--text); background: var(--panel-strong); font: inherit; font-weight: 800; cursor: pointer; }
.collection-page { display: grid; gap: var(--gallery-section-gap); }
.collection-page-head { max-width: 820px; padding: clamp(22px, 4vw, 42px); border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(18px); }
.collection-page-head h1 { max-inline-size: var(--gallery-title-measure); margin: 4px 0 14px; font-size: clamp(38px, 7vw, 78px); line-height: 0.98; overflow-wrap: anywhere; text-wrap: balance; }
.collection-page-head > span { color: var(--accent); font-size: 13px; font-weight: 900; }
.groups { margin-bottom: 24px; }
.carousel { margin-top: 20px; }
.carousel-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
}
.carousel-toolbar button {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  width: 42px;
  height: 42px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  padding: 0;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.carousel-toolbar button svg {
  display: block;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.card-stage {
  position: relative;
  min-height: 460px;
  perspective: 1500px;
  overflow: hidden;
  touch-action: pan-y;
}
.carousel-card {
  position: absolute;
  top: 0;
  left: 50%;
  width: min(330px, 76vw);
  padding: 0;
  border: 0;
  --card-radius: 24px;
  border-radius: var(--card-radius);
  overflow: hidden;
  clip-path: inset(0 round var(--card-radius));
  contain: paint;
  isolation: isolate;
  background: transparent;
  background-clip: padding-box;
  box-shadow: 0 24px 60px rgba(0,0,0,0.24);
  transform:
    translateX(calc(-50% + (var(--offset) * 250px)))
    rotateY(calc(var(--offset) * -14deg))
    scale(calc(1 - (var(--abs-offset) * 0.08)));
  opacity: calc(1 - (var(--abs-offset) * 0.24));
  z-index: calc(10 - var(--abs-offset));
  transition: transform 220ms ease, opacity 220ms ease;
}
.carousel-card[aria-hidden="true"] { pointer-events: none; opacity: 0; }
.card-image { display: block; width: 100%; padding: 0; border: 0; background: transparent; }
.card-image img, .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; background: rgba(255,255,255,0.06); }
.typography-modern .hero-copy h1,
.typography-modern .detail-copy h1,
.typography-modern .curated-section h2,
.typography-modern .featured-stories h2,
.typography-modern .collection-browser h2 { font-family: "Arial Narrow", "Segoe UI", "Microsoft YaHei", sans-serif; font-weight: 900; }
.typography-editorial .hero-copy h1,
.typography-editorial .detail-copy h1,
.typography-editorial .curated-section h2,
.typography-editorial .featured-stories h2,
.typography-editorial .collection-browser h2 { font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif; font-weight: 700; letter-spacing: -0.025em; }
.text-scale-small .hero-copy h1, .text-scale-small .detail-copy h1 { font-size: clamp(34px, 6.5vw, 72px); }
.text-scale-large .hero-copy h1, .text-scale-large .detail-copy h1 { font-size: clamp(48px, 9vw, 106px); }
.text-scale-small .subtitle { font-size: clamp(15px, 1.8vw, 20px); }
.text-scale-large .subtitle { font-size: clamp(21px, 2.7vw, 31px); }
.density-compact { --gallery-section-gap: clamp(12px, 1.5vw, 18px); }
.density-compact .shell { width: min(1240px, calc(100% - (var(--gallery-page-gutter) * 2))); padding-top: 16px; padding-bottom: 24px; }
.density-compact .hero { min-height: 48vh; gap: 14px; }
.density-compact .curated-sections { gap: 10px; }
.density-compact .curated-section { gap: 12px; padding: clamp(12px, 1.6vw, 18px); }
.density-compact .section-cards { gap: 8px; }
.density-compact .card-stage { min-height: 380px; }
.density-compact .collection-card-grid { grid-template-columns: repeat(auto-fill, minmax(126px, 1fr)); gap: 9px; }
.density-comfortable .hero { min-height: 72vh; }
.image-fit-contain .card-image img,
.image-fit-contain .section-card img,
.image-fit-contain .hero-cover img { padding: 10px; object-fit: contain; background: var(--panel-strong); }
.carousel-card .card-image img,
.carousel-card .placeholder {
  display: block;
  border-radius: 24px;
  box-shadow: none;
}
.detail-shell { padding-top: 20px; }
.back { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-bottom: 18px; color: var(--accent); font-weight: 700; }
.detail { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(320px, 0.8fr); gap: 24px; align-items: start; }
.detail-images { padding: 14px; display: grid; gap: 14px; }
.detail-images img { width: 100%; max-height: 78vh; object-fit: contain; background: #050608; }
.detail-copy { padding: 24px; position: sticky; top: 16px; }
.meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
.meta div { border-top: 1px solid var(--line); padding-top: 10px; }
.meta strong { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.meta span { overflow-wrap: anywhere; }
.large { min-height: 420px; }
.preview-detail-layer { position: relative; z-index: 2; width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 20px 0 48px; }
.preview-detail-back { margin-bottom: 18px; padding: 9px 13px; border: 1px solid var(--line); border-radius: 999px; color: var(--accent); background: var(--panel-strong); font: inherit; font-weight: 800; cursor: pointer; }
.archive-catalog { display: grid; grid-template-columns: minmax(190px, 0.3fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.archive-catalog > aside { position: sticky; top: 20px; padding: 22px; border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(14px); }
.archive-catalog > aside .groups { display: grid; margin: 0; }
.layout-archive .shell { width: min(1320px, calc(100% - 32px)); }
.layout-archive .hero { min-height: 54vh; grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.45fr); border-bottom: 1px solid var(--line); margin-bottom: 30px; }
.layout-archive .hero-copy h1 { max-width: 13ch; font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif; font-size: clamp(46px, 7vw, 88px); }
.layout-archive.typography-modern .hero-copy h1 { font-family: "Arial Narrow", "Segoe UI", "Microsoft YaHei", sans-serif; }
.layout-archive.text-scale-small .hero-copy h1 { font-size: clamp(34px, 5vw, 64px); }
.layout-archive.text-scale-large .hero-copy h1 { font-size: clamp(56px, 9vw, 112px); }
.layout-archive.density-compact .hero { min-height: 42vh; }
.layout-archive.density-comfortable .hero { min-height: 66vh; }
.layout-archive .curated-section { grid-template-columns: 64px minmax(0, 0.72fr) minmax(0, 1.28fr); border-radius: 0; border-width: 0 0 1px; background: transparent; backdrop-filter: none; }
.layout-archive .section-number { font-family: Georgia, "Times New Roman", serif; font-size: 20px; }
.layout-archive .carousel { border-top: 1px solid var(--line); padding-top: 28px; }
.arena-board { display: grid; grid-template-columns: 150px 150px minmax(0, 1fr); gap: 12px; align-items: stretch; margin: -40px 0 34px; position: relative; z-index: 2; }
.arena-board > div { display: grid; align-content: center; padding: 18px; border: 1px solid var(--line); background: var(--panel-strong); backdrop-filter: blur(14px); }
.arena-board strong { color: var(--accent); font-size: 34px; line-height: 1; }
.arena-board span { color: var(--muted); font-size: 11px; font-weight: 800; }
.arena-board .groups { display: flex; margin: 0; }
.layout-arena .hero { min-height: 76vh; grid-template-columns: minmax(0, 0.92fr) minmax(320px, 0.72fr); }
.layout-arena.density-compact .hero { min-height: 54vh; }
.layout-arena.density-comfortable .hero { min-height: 80vh; }
.layout-arena .hero-copy { border-left: 5px solid var(--accent); }
.layout-arena .hero-cover { transform: perspective(1100px) rotateY(-8deg); box-shadow: 28px 30px 70px rgba(0,0,0,0.28); }
.layout-arena .card-stage { min-height: 520px; }
.layout-arena .curated-section { border-left: 4px solid var(--accent); }
body.theme-archive {
  color-scheme: light;
  --bg: #f4f0e8;
  --line: rgba(36, 57, 88, 0.18);
  --text: #1b2d49;
  --muted: #52627a;
  --accent: #a36f24;
  background:
    radial-gradient(circle at top left, rgba(163, 111, 36, 0.14), transparent 28rem),
    linear-gradient(145deg, #f7f4ee 0%, #e6edf4 56%, #f7f4ee 100%);
}
body.theme-archive .hero-cover,
body.theme-archive .curated-section,
body.theme-archive .detail-images,
body.theme-archive .detail-copy {
  background: var(--panel);
  border-color: var(--line);
}
body.theme-archive .card-image img,
body.theme-archive .placeholder,
body.theme-archive .detail-images img { background: #e6ebf0; }
body.theme-football {
  color: #f5fbf4;
  --accent: #cde83d;
  --muted: #b9d8c5;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 25% 100%,
    linear-gradient(145deg, #08271e 0%, #0d5f40 55%, #062118 100%);
}
body.theme-football .hero { border-left: 6px solid #cde83d; padding-left: 20px; }
body.theme-football .curated-section,
body.theme-football .hero-cover,
body.theme-football .detail-images,
body.theme-football .detail-copy { border-color: rgba(205,232,61,0.34); background: var(--panel); }
body.theme-basketball {
  color: #fff8ee;
  --accent: #ffc46d;
  --muted: #ead0b5;
  background: radial-gradient(circle at 78% 18%, rgba(255,195,109,0.22), transparent 13rem), linear-gradient(145deg, #552516 0%, #b95c2a 50%, #102c4d 100%);
}
body.theme-basketball .curated-section,
body.theme-basketball .hero-cover,
body.theme-basketball .detail-images,
body.theme-basketball .detail-copy { border-color: rgba(255,196,109,0.38); background: var(--panel); }
body.theme-tennis {
  color: #f4fbff;
  --accent: #d8ef44;
  --muted: #b9d8e7;
  background: linear-gradient(135deg, transparent 0 46%, rgba(216,239,68,0.18) 47% 52%, transparent 53%), linear-gradient(145deg, #071d31 0%, #0e5c8d 56%, #06243e 100%);
}
body.theme-tennis .hero { transform: skewY(-1deg); }
body.theme-tennis .curated-section,
body.theme-tennis .hero-cover,
body.theme-tennis .detail-images,
body.theme-tennis .detail-copy { border-color: rgba(216,239,68,0.36); background: var(--panel); }
body.theme-f1 {
  color: #f7f8fa;
  --accent: #f0524e;
  --muted: #b9bec8;
  background: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 18px), linear-gradient(145deg, #090a0d 0%, #252931 60%, #120f13 100%);
}
body.theme-f1 .hero-copy h1 { text-transform: uppercase; letter-spacing: 0; }
body.theme-f1 .curated-section,
body.theme-f1 .hero-cover,
body.theme-f1 .detail-images,
body.theme-f1 .detail-copy { border-color: rgba(240,82,78,0.4); background: var(--panel); }
body.theme-nerazzurri {
  color: #10233c;
  --accent: #004e9a;
  --muted: #3f5875;
  --line: rgba(0,78,154,0.22);
  background: radial-gradient(circle at 72% 18%, rgba(0,83,167,0.14), transparent 16rem), linear-gradient(145deg, #f7fbff 0%, #dceafa 56%, #f8fbff 100%);
}
body.theme-nerazzurri .hero { border-left: 6px solid #0067d8; padding-left: 20px; }
body.theme-nerazzurri .hero-copy h1 { color: #07182e; text-shadow: 0 0 28px rgba(255,255,255,0.72); }
body.theme-nerazzurri .curated-section,
body.theme-nerazzurri .hero-cover,
body.theme-nerazzurri .detail-images,
body.theme-nerazzurri .detail-copy { border-color: rgba(0,78,154,0.22); background: var(--panel); }
body.theme-nerazzurri-2 {
  color: #f2f7ff;
  --accent: #d9ad54;
  --muted: #b9c8dc;
  background: repeating-linear-gradient(90deg, rgba(0,85,170,0.22) 0 7rem, rgba(3,11,24,0.22) 7rem 14rem), radial-gradient(circle at 72% 18%, rgba(218,170,76,0.22), transparent 16rem), linear-gradient(145deg, #020916 0%, #043b82 45%, #01050d 100%);
}
body.theme-nerazzurri-2 .hero { border-left: 6px solid #0067d8; padding-left: 20px; }
body.theme-nerazzurri-2 .hero-copy h1 { text-shadow: 0 0 28px rgba(0,103,216,0.46); }
body.theme-nerazzurri-2 .curated-section,
body.theme-nerazzurri-2 .hero-cover,
body.theme-nerazzurri-2 .detail-images,
body.theme-nerazzurri-2 .detail-copy { border-color: rgba(217,173,84,0.36); background: var(--panel); }
body.has-custom-bg .back,
body.has-custom-bg .hero-copy,
body.has-custom-bg .carousel-toolbar,
body.has-custom-bg .curated-section,
body.has-custom-bg .detail-copy {
  border: 1px solid rgba(255,255,255,0.24);
  border-radius: 24px;
  background: var(--panel);
  box-shadow: 0 14px 38px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(255,255,255,0.05);
  backdrop-filter: blur(10px) saturate(125%);
}
body.has-custom-bg .stats span,
body.has-custom-bg .chip {
  border-color: rgba(255,255,255,0.22);
  background: var(--panel-strong);
  backdrop-filter: blur(8px) saturate(125%);
}
.template-collector-spotlight .hero-cover { border-radius: 26px; transform: perspective(1200px) rotateY(-5deg); box-shadow: 28px 30px 70px rgba(0,0,0,0.3); }
.template-collector-spotlight .curated-section { border-radius: 22px; }
.template-archive-journal .hero { border-bottom: 1px solid var(--line); }
.template-archive-journal .hero-cover,
.template-archive-journal .curated-section { border-radius: 2px; }
.template-arena-lineup .arena-board > div { box-shadow: inset 0 3px 0 var(--accent); }
.template-arena-lineup .curated-section { border-radius: 0 18px 18px 0; }
@media (max-width: 1024px) and (min-width: 821px) {
  :root {
    --gallery-content-max: 900px;
    --gallery-page-gutter: 24px;
    --gallery-cover-safe-inline: 18px;
    --gallery-section-gap: 20px;
  }
  .hero,
  .layout-arena .hero { grid-template-columns: minmax(0, 1fr) minmax(250px, 0.62fr); min-height: 64vh; }
  .hero-copy h1, .detail-copy h1 { font-size: clamp(42px, 7vw, 72px); }
  .curated-section { grid-template-columns: 44px minmax(180px, 0.8fr) minmax(0, 1.2fr); gap: 16px; }
  .section-cards, .section-grid .section-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .arena-board { grid-template-columns: 120px 120px minmax(0, 1fr); }
}
@media (max-width: 820px) {
  :root {
    --gallery-content-max: 680px;
    --gallery-page-gutter: 11px;
    --gallery-cover-safe-inline: 0px;
    --gallery-section-gap: 16px;
    --gallery-title-measure: 100%;
  }
  .shell { padding-top: 20px; }
  .hero,
  .layout-arena .hero,
  .layout-archive .hero,
  .detail { grid-template-columns: minmax(0, 1fr); min-height: auto; }
  .archive-catalog { grid-template-columns: 1fr; }
  .archive-catalog > aside { position: static; }
  .arena-board { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 0; }
  .arena-board .groups { grid-column: 1 / -1; }
  .curated-section,
  .layout-archive .curated-section { grid-template-columns: 42px minmax(0, 1fr); gap: 14px; }
  .curated-section .section-cards { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .featured-story-grid { grid-template-columns: 1fr; }
  .collection-browser-head { align-items: start; flex-direction: column; }
  .collection-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .section-rail .section-cards { display: flex; }
  .layout-arena .hero-cover { transform: none; }
  .template-collector-spotlight .hero-cover { transform: none; }
  .layout-arena .hero-copy { border-left-width: 3px; padding-left: 16px; }
  .hero-copy h1, .detail-copy h1 { font-size: clamp(34px, 14vw, 58px); }
  .detail-copy { position: static; }
  .meta { grid-template-columns: 1fr; }
  .card-stage { min-height: 420px; }
  .carousel-card {
    width: min(300px, 78vw);
    transform:
      translateX(calc(-50% + (var(--offset) * 170px)))
      rotateY(calc(var(--offset) * -10deg))
      scale(calc(1 - (var(--abs-offset) * 0.09)));
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}`;
}

export function siteJs(): string {
  return `(() => {
  function initGallery() {
  const cards = Array.from(document.querySelectorAll(".carousel-card"));
  const current = document.querySelector("[data-carousel-current]");
  const prev = document.querySelector("[data-carousel-prev]");
  const next = document.querySelector("[data-carousel-next]");
  const stage = document.querySelector(".card-stage");
  if (!cards.length || !stage) return;

  let activeIndex = 0;
  let touchStartX = null;

  function render() {
    cards.forEach((card, index) => {
      const offset = index - activeIndex;
      card.style.setProperty("--offset", String(offset));
      card.style.setProperty("--abs-offset", String(Math.abs(offset)));
      card.classList.toggle("active", offset === 0);
      card.setAttribute("aria-hidden", Math.abs(offset) > 2 ? "true" : "false");
    });
    if (current) current.textContent = String(activeIndex + 1);
  }

  function goTo(index) {
    activeIndex = (index + cards.length) % cards.length;
    render();
  }

  cards.forEach((card, index) => card.addEventListener("click", (event) => {
    if (index !== activeIndex) {
      event.preventDefault();
      goTo(index);
    }
  }));
  prev?.addEventListener("click", () => goTo(activeIndex - 1));
  next?.addEventListener("click", () => goTo(activeIndex + 1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goTo(activeIndex - 1);
    if (event.key === "ArrowRight") goTo(activeIndex + 1);
  });
  stage.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX ?? null;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) < 36) return;
    goTo(activeIndex + (delta < 0 ? 1 : -1));
  });

  render();
  }

  function initPreviewDetails() {
    const gallery = document.querySelector("[data-preview-gallery]");
    const layer = document.querySelector("[data-preview-detail-layer]");
    if (!gallery || !layer) return;

    function closeDetail() {
      layer.querySelectorAll("[data-preview-detail]").forEach((detail) => { detail.hidden = true; });
      layer.hidden = true;
      gallery.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll("[data-preview-card]").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        const carouselCard = trigger.closest(".carousel-card");
        if (carouselCard && !carouselCard.classList.contains("active")) return;
        event.preventDefault();
        event.stopPropagation();
        const cardId = trigger.getAttribute("data-preview-card");
        const detail = cardId
          ? Array.from(layer.querySelectorAll("[data-preview-detail]")).find((entry) => entry.getAttribute("data-preview-detail") === cardId)
          : null;
        if (!detail) return;
        layer.querySelectorAll("[data-preview-detail]").forEach((entry) => { entry.hidden = entry !== detail; });
        gallery.hidden = true;
        layer.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    layer.querySelectorAll("[data-preview-back]").forEach((button) => button.addEventListener("click", closeDetail));
  }

  function initSegmentedGalleries() {
    document.querySelectorAll("[data-segmented-gallery]").forEach((gallery) => {
      const items = Array.from(gallery.querySelectorAll("[data-segment-item]"));
      const button = gallery.querySelector("[data-segment-more]");
      const status = gallery.querySelector("[data-segment-status]");
      const segmentSize = Math.max(1, Number(gallery.getAttribute("data-segment-size")) || ${shareGallerySegmentSize});
      let visibleCount = items.filter((item) => !item.hidden).length;
      if (!button) return;
      button.addEventListener("click", () => {
        const nextVisibleCount = Math.min(items.length, visibleCount + segmentSize);
        items.slice(visibleCount, nextVisibleCount).forEach((item) => { item.hidden = false; });
        visibleCount = nextVisibleCount;
        if (status) status.textContent = "已显示 " + visibleCount + " / " + items.length;
        const remaining = items.length - visibleCount;
        button.textContent = remaining > 0 ? "显示更多（剩余 " + remaining + "）" : "已显示全部卡片";
        button.hidden = remaining === 0;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { initGallery(); initPreviewDetails(); initSegmentedGalleries(); }, { once: true });
  } else {
    initGallery();
    initPreviewDetails();
    initSegmentedGalleries();
  }
})();`;
}

export function readmeDeploy(data: ExportData): string {
  return `# ${data.title}

这是 Card Vault 生成的静态分享展馆。

## 本地查看

直接打开 \`index.html\` 即可浏览。请保持 \`assets\`、\`cards\`、\`sections\` 和 \`subjects\` 目录与 \`index.html\` 在同一目录。

## 分享

可以压缩整个目录发送给他人，也可以上传到任意静态网站托管服务。

## 隐私

导出内容只包含展示字段，不包含购买价格、评级费用、总投入、当前估值、购买渠道、备注、AI Key 或本地数据库路径。
`;
}

export function dropReadme(data: ExportData): string {
  return `# ${data.title} - Cloudflare Drop 临时发布说明

本目录是 Card Vault 生成的 Cloudflare Drop 临时预览包。它只包含静态 HTML、CSS、JavaScript、JSON 和图片，不需要服务器程序。

## 发布步骤

1. 打开 Cloudflare Drop。
2. 上传本导出目录，或直接上传与本目录同时生成的 ZIP。
3. 等待临时地址生成后，检查首页、章节、单卡详情、图片以及手机显示。
4. 需要长期保留时，请在 Cloudflare 提示的期限内登录并认领；否则临时预览约一小时后失效。

## 发布前检查

导出时已检查根目录首页、内部资源引用、私密字段、文件数量和单文件大小。结果见 \`CHECK-REPORT.md\`，导出内容摘要见 \`publish-manifest.json\`。

## 隐私与链接

- 包内默认生成 \`robots.txt\` 和 \`noindex\` 元数据，减少临时页面被搜索引擎收录的概率。
- 临时地址仍是公开地址；知道地址的人可以访问，\`noindex\` 不等于密码保护。
- Card Vault 不记录临时发布地址或认领链接。认领链接具有敏感性，请不要粘贴到日志、备注或公开聊天中。

## 本地复核

上传前可以直接打开 \`index.html\`。上传后只需在临时有效期内人工确认显示结果，不需要将 URL 填回 Card Vault。
`;
}

export function cloudflareHeaders(): string {
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Robots-Tag: noindex, nofollow, noarchive
`;
}

export function cloudflareRobots(): string {
  return `User-agent: *
Disallow: /
`;
}
