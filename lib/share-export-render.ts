import { siteCss } from "./share-gallery-styles.ts";
import { siteJs, shareGallerySegmentSize } from "./share-gallery-runtime.ts";
export { siteCss, siteJs, shareGallerySegmentSize };
import type { ExportCard, ExportData, ExportImage, ExportSection, ExportSubject } from "./share-export-types.ts";
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

function renderSections(data: ExportData, inlineDetails = false): string {
  const sections: ExportSection[] = data.sections;
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
      <a class="gallery-enter" href="#collection">浏览馆藏 <span aria-hidden="true">↗</span></a>
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
  return `<section id="collection" class="collection-browser" data-segmented-gallery data-segment-size="${shareGallerySegmentSize}">
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
