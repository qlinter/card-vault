import { ExportCard, ExportData } from "@/lib/share-export-types";
import { fallbackShareSections } from "@/lib/share-sections";
import { normalizeShareTheme, shareThemeCssVariables } from "@/lib/share-themes";

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "share";
}

function paragraphHtml(value: string | null | undefined): string {
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function cardMeta(card: ExportCard): Array<[string, string]> {
  const rows: Array<[string, string | null]> = [
    ["年份", card.year],
    ["运动", card.sport],
    ["球队", card.team],
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
  inlineAssets = false
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
  const bodyClass = ` class="${themeClass} layout-${presentation.layout}${data.backgroundImage ? " has-custom-bg" : ""}"`;
  const assets = inlineAssets
    ? `<style>${siteCss()}</style>\n  <script>${siteJs()}</script>`
    : `<link rel="stylesheet" href="${prefix}assets/site.css" />\n  <script src="${prefix}assets/site.js" defer></script>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  ${assets}
</head>
<body${bodyClass}${backgroundStyle}>
${body}
</body>
</html>
`;
}

function renderGalleryCard(card: ExportCard, className: string): string {
  const image = card.images[0]
    ? `<img src="${escapeHtml(card.images[0])}" alt="${escapeHtml(card.displayTitle)}" loading="lazy" />`
    : `<div class="placeholder"></div>`;
  return `<a class="${className}" href="${escapeHtml(card.href)}">
    ${image}
    <span><strong>${escapeHtml(card.playerName)}</strong><small>${escapeHtml(card.displayTitle)}</small></span>
  </a>`;
}

function legacySections(data: ExportData) {
  return fallbackShareSections({
    themeNarrative: data.themeNarrative,
    themeHighlights: data.themeHighlights,
    groupNotes: data.groupNotes,
    cardIds: data.cards.map((card) => card.id)
  });
}

function renderSections(data: ExportData): string {
  const sections = data.sections.length > 0 ? data.sections : legacySections(data);
  if (sections.length === 0) {
    return "";
  }
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  return `<section class="curated-sections">
    ${sections.map((section, index) => {
      const sectionCards = section.cardIds.map((cardId) => cards.get(cardId)).filter((card): card is ExportCard => Boolean(card));
      const cardHtml = sectionCards.length > 0
        ? `<div class="section-cards">${sectionCards.map((card) => renderGalleryCard(card, "section-card")).join("")}</div>`
        : "";
      return `<article class="curated-section section-${escapeHtml(section.layout)}">
        <div class="section-number">${String(index + 1).padStart(2, "0")}</div>
        <div class="section-copy"><p class="kicker">策展章节</p><h2>${escapeHtml(section.title)}</h2>${paragraphHtml(section.description)}</div>
        ${cardHtml}
      </article>`;
    }).join("")}
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
      <div class="stats"><span>${data.cards.length} 张卡片</span><span>${playerCount} 位球员或组合</span></div>
    </div>
    ${coverImage ? `<div class="hero-cover"><img src="${escapeHtml(coverImage)}" alt="${escapeHtml(coverTitle)}" /></div>` : ""}
  </section>`;
}

function renderCarousel(data: ExportData): string {
  const cardsHtml = data.cards.map((card, index) => {
    const image = card.images[0]
      ? `<img src="${escapeHtml(card.images[0])}" alt="${escapeHtml(card.displayTitle)}" />`
      : `<div class="placeholder"></div>`;
    return `<article class="card carousel-card" data-index="${index}" aria-label="${escapeHtml(`${card.playerName} ${card.displayTitle}`)}" style="--offset:${index};--abs-offset:${Math.abs(index)}">
      <a class="card-image" href="${escapeHtml(card.href)}" aria-label="查看 ${escapeHtml(card.displayTitle)}">${image}</a>
    </article>`;
  }).join("");
  return `<section class="carousel" aria-label="卡片立体切换">
    <div class="carousel-toolbar">
      <button type="button" data-carousel-prev aria-label="上一张">‹</button>
      <span><strong data-carousel-current>1</strong> / ${data.cards.length}</span>
      <button type="button" data-carousel-next aria-label="下一张">›</button>
    </div>
    <div class="card-stage">${cardsHtml}</div>
  </section>`;
}

export function renderIndex(data: ExportData, inlineAssets = false): string {
  const cover = data.cards.find((card) => card.images.length > 0);
  const coverImage = data.coverImage ?? cover?.images[0];
  const groups = new Map<string, number>();
  for (const card of data.cards) {
    groups.set(card.playerName, (groups.get(card.playerName) ?? 0) + 1);
  }

  const groupHtml = [...groups.entries()]
    .map(([name, count]) => `<span class="chip">${escapeHtml(name)} <strong>${count}</strong></span>`)
    .join("");
  const hero = renderHero(data, coverImage, cover?.displayTitle ?? data.title);
  const sections = renderSections(data);
  const carousel = renderCarousel(data);
  const layoutContent = data.presentation.layout === "archive"
    ? `${hero}<div class="archive-catalog"><aside><p class="kicker">馆藏索引</p><div class="groups">${groupHtml}</div></aside>${sections}</div>${carousel}`
    : data.presentation.layout === "arena"
      ? `${hero}<section class="arena-board"><div><strong>${data.cards.length}</strong><span>CARDS</span></div><div><strong>${groups.size}</strong><span>PLAYERS</span></div><div class="groups">${groupHtml}</div></section>${carousel}${sections}`
      : `${hero}${sections}<div class="groups">${groupHtml}</div>${carousel}`;
  const body = `<main class="shell">${layoutContent}</main>`;

  return renderLayout(data.title, body, data, "root", inlineAssets);
}

export function renderPreviewDocument(data: ExportData): string {
  return renderIndex(data, true);
}

export function renderCardPage(data: ExportData, card: ExportCard): string {
  const images = card.images
    .map((image) => `<img src="../${escapeHtml(image)}" alt="${escapeHtml(card.displayTitle)}" />`)
    .join("");
  const meta = cardMeta(card)
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");

  const body = `<main class="shell detail-shell">
    <nav class="back"><a href="../index.html">返回展馆</a></nav>
    <section class="detail">
      <div class="detail-images">${images || `<div class="placeholder large"></div>`}</div>
      <div class="detail-copy">
        <p class="kicker">${escapeHtml(data.title)}</p>
        <h1>${escapeHtml(card.playerName)}</h1>
        <p class="subtitle">${escapeHtml(card.displayTitle)}</p>
        ${paragraphHtml(card.description)}
        <div class="meta">${meta}</div>
      </div>
    </section>
  </main>`;

  return renderLayout(`${card.playerName} - ${data.title}`, body, data, "card");
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
img { display: block; max-width: 100%; }
.shell { position: relative; z-index: 1; width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
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
  gap: 28px;
  align-items: center;
}
.hero-copy h1, .detail-copy h1 { margin: 0; font-size: clamp(40px, 8vw, 92px); line-height: 0.96; letter-spacing: 0; }
.kicker { color: var(--accent); text-transform: uppercase; font-size: 12px; letter-spacing: 0; font-weight: 800; }
.subtitle { color: var(--muted); font-size: clamp(18px, 2.2vw, 26px); line-height: 1.45; }
.hero-copy p:not(.kicker):not(.subtitle), .curated-section p, .detail-copy p { color: var(--muted); line-height: 1.85; }
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
.curated-sections { display: grid; gap: 22px; margin: 0 0 30px; }
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
.section-card { min-width: 0; border-radius: 12px; overflow: hidden; background: var(--panel-strong); border: 1px solid var(--line); }
.section-card img, .section-card .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.section-card span { display: grid; gap: 2px; padding: 10px; }
.section-card strong, .section-card small { overflow-wrap: anywhere; }
.section-card small { color: var(--muted); }
.section-editorial { grid-template-columns: 52px minmax(0, 1fr); }
.section-editorial .section-cards { grid-column: 2; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.section-rail .section-cards { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
.section-rail .section-card { flex: 0 0 min(190px, 48vw); scroll-snap-align: start; }
.section-grid .section-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
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
  font-size: 25px;
  cursor: pointer;
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
.card-image img, .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; background: rgba(255,255,255,0.06); }
.carousel-card .card-image img,
.carousel-card .placeholder {
  display: block;
  border-radius: 24px;
  box-shadow: none;
}
.detail-shell { padding-top: 20px; }
.back { margin-bottom: 18px; color: var(--accent); font-weight: 700; }
.detail { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(320px, 0.8fr); gap: 24px; align-items: start; }
.detail-images { padding: 14px; display: grid; gap: 14px; }
.detail-images img { width: 100%; max-height: 78vh; object-fit: contain; background: #050608; }
.detail-copy { padding: 24px; position: sticky; top: 16px; }
.meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
.meta div { border-top: 1px solid var(--line); padding-top: 10px; }
.meta strong { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.meta span { overflow-wrap: anywhere; }
.large { min-height: 420px; }
.archive-catalog { display: grid; grid-template-columns: minmax(190px, 0.3fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.archive-catalog > aside { position: sticky; top: 20px; padding: 22px; border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(14px); }
.archive-catalog > aside .groups { display: grid; margin: 0; }
.layout-archive .shell { width: min(1320px, calc(100% - 32px)); }
.layout-archive .hero { min-height: 54vh; grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.45fr); border-bottom: 1px solid var(--line); margin-bottom: 30px; }
.layout-archive .hero-copy h1 { max-width: 13ch; font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif; font-size: clamp(46px, 7vw, 88px); }
.layout-archive .curated-section { grid-template-columns: 64px minmax(0, 0.72fr) minmax(0, 1.28fr); border-radius: 0; border-width: 0 0 1px; background: transparent; backdrop-filter: none; }
.layout-archive .section-number { font-family: Georgia, "Times New Roman", serif; font-size: 20px; }
.layout-archive .carousel { border-top: 1px solid var(--line); padding-top: 28px; }
.arena-board { display: grid; grid-template-columns: 150px 150px minmax(0, 1fr); gap: 12px; align-items: stretch; margin: -40px 0 34px; position: relative; z-index: 2; }
.arena-board > div { display: grid; align-content: center; padding: 18px; border: 1px solid var(--line); background: var(--panel-strong); backdrop-filter: blur(14px); }
.arena-board strong { color: var(--accent); font-size: 34px; line-height: 1; }
.arena-board span { color: var(--muted); font-size: 11px; font-weight: 800; }
.arena-board .groups { display: flex; margin: 0; }
.layout-arena .hero { min-height: 76vh; grid-template-columns: minmax(0, 0.92fr) minmax(320px, 0.72fr); }
.layout-arena .hero-copy { border-left: 5px solid var(--accent); }
.layout-arena .hero-cover { transform: perspective(1100px) rotateY(-8deg); box-shadow: 28px 30px 70px rgba(0,0,0,0.28); }
.layout-arena .card-stage { min-height: 520px; }
.layout-arena .curated-section { border-left: 4px solid var(--accent); }
body.theme-archive {
  color-scheme: light;
  --bg: #f4f0e8;
  --panel: rgba(255, 255, 255, 0.72);
  --panel-strong: rgba(255, 255, 255, 0.88);
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
body.theme-football .detail-copy { border-color: rgba(205,232,61,0.34); background: rgba(3,35,24,0.72); }
body.theme-basketball {
  color: #fff8ee;
  --accent: #ffc46d;
  --muted: #ead0b5;
  background: radial-gradient(circle at 78% 18%, rgba(255,195,109,0.22), transparent 13rem), linear-gradient(145deg, #552516 0%, #b95c2a 50%, #102c4d 100%);
}
body.theme-basketball .curated-section,
body.theme-basketball .hero-cover,
body.theme-basketball .detail-images,
body.theme-basketball .detail-copy { border-color: rgba(255,196,109,0.38); background: rgba(47,24,19,0.68); }
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
body.theme-tennis .detail-copy { border-color: rgba(216,239,68,0.36); background: rgba(4,36,61,0.7); }
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
body.theme-f1 .detail-copy { border-color: rgba(240,82,78,0.4); background: rgba(8,10,14,0.78); }
body.theme-nerazzurri {
  color: #10233c;
  --accent: #004e9a;
  --muted: #3f5875;
  --panel: rgba(255,255,255,0.72);
  --panel-strong: rgba(255,255,255,0.9);
  --line: rgba(0,78,154,0.22);
  background: radial-gradient(circle at 72% 18%, rgba(0,83,167,0.14), transparent 16rem), linear-gradient(145deg, #f7fbff 0%, #dceafa 56%, #f8fbff 100%);
}
body.theme-nerazzurri .hero { border-left: 6px solid #0067d8; padding-left: 20px; }
body.theme-nerazzurri .hero-copy h1 { color: #07182e; text-shadow: 0 0 28px rgba(255,255,255,0.72); }
body.theme-nerazzurri .curated-section,
body.theme-nerazzurri .hero-cover,
body.theme-nerazzurri .detail-images,
body.theme-nerazzurri .detail-copy { border-color: rgba(0,78,154,0.22); background: rgba(255,255,255,0.72); }
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
body.theme-nerazzurri-2 .detail-copy { border-color: rgba(217,173,84,0.36); background: rgba(3,12,28,0.72); }
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
@media (max-width: 820px) {
  .shell { width: min(100% - 22px, 680px); padding-top: 20px; }
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
  .section-rail .section-cards { display: flex; }
  .layout-arena .hero-cover { transform: none; }
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGallery, { once: true });
  } else {
    initGallery();
  }
})();`;
}

export function readmeDeploy(data: ExportData): string {
  return `# ${data.title}

这是 Card Vault 生成的静态分享展馆。

## 本地查看

直接打开 \`index.html\` 即可浏览。请保持 \`assets\` 和 \`cards\` 目录与 \`index.html\` 在同一目录。

## 分享

可以压缩整个目录发送给他人，也可以上传到任意静态网站托管服务。

## 隐私

导出内容只包含展示字段，不包含购买价格、评级费用、总投入、当前估值、购买渠道、备注、AI Key 或本地数据库路径。
`;
}

export function cloudReadme(data: ExportData): string {
  return `# ${data.title} - 云端部署说明

本目录是 Card Vault 生成的静态展馆发布包，适合上传到服务器静态目录，并通过 Nginx 等服务对外访问。

## 推荐目录

\`\`\`bash
/var/www/card-vault/${slugify(data.title)}/
\`\`\`

## 部署步骤

1. 将本目录内所有文件上传到服务器静态目录。
2. 确认 Nginx root 指向该目录，或将该目录作为某个 location 的 alias。
3. 重载 Nginx。

## 服务器开关

没有分享需求时可以关闭服务器。服务器关闭时公网链接不可访问；重新启动后，只要文件仍保留在服务器目录中，链接会恢复。

## 后续一键发布预留

后续版本可在 Card Vault 设置中配置 SSH/SFTP 信息，将本目录同步到远程目录。不会把服务器凭证写入导出包。
`;
}

export function nginxConf(data: ExportData): string {
  const slug = slugify(data.title);
  return `server {
    listen 80;
    server_name example.com;

    location /shares/${slug}/ {
        alias /var/www/card-vault/${slug}/;
        index index.html;
        try_files $uri $uri/ =404;
    }

    location ~* \\.(?:css|js|jpg|jpeg|png|webp|gif|json)$ {
        expires 30d;
        add_header Cache-Control "public";
    }
}
`;
}
