import { mkdir, readFile, writeFile } from "fs/promises";
import fs from "fs";
import path from "path";
import { Card, CardImage, ShareCollection, ShareCollectionItem } from "@prisma/client";
import { getShareBackgroundsDir, getShareCoversDir, getUploadsDir, resolveDataDir } from "@/lib/storage-paths";

export type ShareExportMode = "static" | "cloud";

type ShareCollectionWithItems = ShareCollection & {
  items: Array<
    ShareCollectionItem & {
      card: Card & { images: CardImage[] };
    }
  >;
};

type ExportCard = {
  playerName: string;
  cardTitle: string;
  displayTitle: string;
  description: string;
  sport: string;
  team: string | null;
  year: string | null;
  brand: string | null;
  productLine: string | null;
  subsetName: string | null;
  parallel: string | null;
  cardNumber: string | null;
  serialNumber: string | null;
  serialRange: string | null;
  isRookie: boolean;
  isAutograph: boolean;
  autoType: string | null;
  isPatch: boolean;
  patchType: string | null;
  gradingCompany: string | null;
  grade: string | null;
  certNumber: string | null;
  href: string;
  images: string[];
};

type ExportCardInput = {
  item: ShareCollectionItem & {
    card: Card & { images: CardImage[] };
  };
  href: string;
  images: string[];
};

type ExportData = {
  title: string;
  subtitle: string | null;
  description: string | null;
  themeNarrative: string | null;
  themeHighlights: string | null;
  groupNotes: string | null;
  coverImage: string | null;
  backgroundImage: string | null;
  generatedAt: string;
  mode: ShareExportMode;
  cards: ExportCard[];
};

export type ShareExportResult = {
  folderPath: string;
  zipPath: string;
  cardCount: number;
  imageCount: number;
};

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

function imageSourcePath(imagePath: string): string {
  return path.join(getUploadsDir(), path.basename(imagePath));
}

function coverSourcePath(imagePath: string): string {
  return path.join(getShareCoversDir(), path.basename(imagePath));
}

function backgroundSourcePath(imagePath: string): string {
  return path.join(getShareBackgroundsDir(), path.basename(imagePath));
}

function safeFileName(value: string): string {
  const parsed = path.parse(value);
  const name = slugify(parsed.name);
  const ext = parsed.ext.toLowerCase() || ".jpg";
  return `${name}${ext}`;
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

function toPublicExportCard({ item, href, images }: ExportCardInput): ExportCard {
  const card = item.card;

  return {
    playerName: card.playerName,
    cardTitle: card.cardTitle,
    displayTitle: item.displayTitle || card.cardTitle,
    description: item.displayDescription || card.publicDescription || "",
    sport: card.sport,
    team: card.team,
    year: card.year,
    brand: card.brand,
    productLine: card.productLine,
    subsetName: card.subsetName,
    parallel: card.parallel,
    cardNumber: card.cardNumber,
    serialNumber: card.serialNumber,
    serialRange: card.serialRange,
    isRookie: card.isRookie,
    isAutograph: card.isAutograph,
    autoType: card.autoType,
    isPatch: card.isPatch,
    patchType: card.patchType,
    gradingCompany: card.gradingCompany,
    grade: card.grade,
    certNumber: card.certNumber,
    href,
    images
  };
}

function renderLayout(title: string, body: string, depth: "root" | "card" = "root", backgroundImage?: string | null): string {
  const prefix = depth === "root" ? "" : "../";
  const backgroundStyle = backgroundImage ? ` style="--share-bg-image: url('${prefix}${escapeHtml(backgroundImage)}')"` : "";
  const bodyClass = backgroundImage ? ` class="has-custom-bg"` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${prefix}assets/site.css" />
  <script src="${prefix}assets/site.js" defer></script>
</head>
<body${bodyClass}${backgroundStyle}>
${body}
</body>
</html>
`;
}

function renderIndex(data: ExportData): string {
  const cover = data.cards.find((card) => card.images.length > 0);
  const coverImage = data.coverImage ?? cover?.images[0];
  const groups = new Map<string, number>();
  for (const card of data.cards) {
    groups.set(card.playerName, (groups.get(card.playerName) ?? 0) + 1);
  }

  const groupHtml = [...groups.entries()]
    .map(([name, count]) => `<span class="chip">${escapeHtml(name)} <strong>${count}</strong></span>`)
    .join("");

  const cardsHtml = data.cards
    .map((card) => {
      const image = card.images[0]
        ? `<img src="${escapeHtml(card.images[0])}" alt="${escapeHtml(card.displayTitle)}" />`
        : `<div class="placeholder"></div>`;
      const badges = [
        card.year,
        card.brand,
        card.productLine,
        card.isRookie ? "Rookie" : null,
        card.isAutograph ? "Auto" : null,
        card.serialRange ? `/${escapeHtml(card.serialRange.replace(/^\//, ""))}` : null,
        card.grade ? `${card.gradingCompany ?? ""} ${card.grade}`.trim() : null
      ]
        .filter(Boolean)
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join("");

      const index = data.cards.indexOf(card);
      return `<article class="card carousel-card" data-index="${escapeHtml(String(index))}" style="--offset:${index};--abs-offset:${Math.abs(index)}">
        <div class="card-image">${image}</div>
        <div class="card-body">
          <h2>${escapeHtml(card.playerName)}</h2>
          <p>${escapeHtml(card.displayTitle)}</p>
          <div class="badges">${badges}</div>
          <a class="detail-link" href="${escapeHtml(card.href)}">查看单卡</a>
        </div>
      </article>`;
    })
    .join("");

  const body = `<main class="shell">
    <section class="hero">
      <div class="hero-copy">
        <p class="kicker">Card Vault 展馆</p>
        <h1>${escapeHtml(data.title)}</h1>
        ${data.subtitle ? `<p class="subtitle">${escapeHtml(data.subtitle)}</p>` : ""}
        ${paragraphHtml(data.description)}
        <div class="stats">
          <span>${data.cards.length} 张卡片</span>
          <span>${groups.size} 位球员或组合</span>
        </div>
      </div>
      ${
        coverImage
          ? `<div class="hero-cover"><img src="${escapeHtml(coverImage)}" alt="${escapeHtml(cover?.displayTitle ?? data.title)}" /></div>`
          : ""
      }
    </section>

    ${
      data.themeNarrative || data.themeHighlights || data.groupNotes
        ? `<section class="story">
            ${data.themeNarrative ? `<div><h2>展馆叙事</h2>${paragraphHtml(data.themeNarrative)}</div>` : ""}
            ${data.themeHighlights ? `<div><h2>收藏亮点</h2>${paragraphHtml(data.themeHighlights)}</div>` : ""}
            ${data.groupNotes ? `<div><h2>主题分组</h2>${paragraphHtml(data.groupNotes)}</div>` : ""}
          </section>`
        : ""
    }

    <section class="groups">${groupHtml}</section>
    <section class="carousel" aria-label="卡片立体切换">
      <div class="carousel-toolbar">
        <button type="button" data-carousel-prev>上一张</button>
        <span><strong data-carousel-current>1</strong> / ${data.cards.length}</span>
        <button type="button" data-carousel-next>下一张</button>
      </div>
      <div class="card-stage">${cardsHtml}</div>
    </section>
  </main>`;

  return renderLayout(data.title, body, "root", data.backgroundImage);
}

function renderCardPage(data: ExportData, card: ExportCard): string {
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

  return renderLayout(`${card.playerName} - ${data.title}`, body, "card", data.backgroundImage);
}

function siteCss(): string {
  return `:root {
  color-scheme: dark;
  --bg: #08090b;
  --panel: rgba(255, 255, 255, 0.07);
  --panel-strong: rgba(255, 255, 255, 0.12);
  --line: rgba(255, 255, 255, 0.14);
  --text: #f5f7fb;
  --muted: #a8b0bd;
  --accent: #d7bb7a;
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
  background:
    linear-gradient(120deg, rgba(4, 7, 12, 0.88), rgba(7, 12, 20, 0.64)),
    var(--share-bg-image) center / cover no-repeat;
}
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
.shell { position: relative; z-index: 1; width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
.hero {
  min-height: 72vh;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.7fr);
  gap: 28px;
  align-items: center;
}
.hero-copy h1, .detail-copy h1 { margin: 0; font-size: clamp(40px, 8vw, 92px); line-height: 0.96; letter-spacing: 0; }
.kicker { color: var(--accent); text-transform: uppercase; font-size: 12px; letter-spacing: 0.14em; font-weight: 700; }
.subtitle { color: var(--muted); font-size: clamp(18px, 2.2vw, 26px); line-height: 1.45; }
.hero-copy p:not(.kicker):not(.subtitle), .story p, .detail-copy p { color: var(--muted); line-height: 1.85; }
.hero-cover, .card, .story, .detail-images, .detail-copy {
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(18px);
}
.hero-cover { padding: 14px; }
.hero-cover img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.stats, .badges, .groups { display: flex; flex-wrap: wrap; gap: 10px; }
.stats span, .badges span, .chip {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  padding: 8px 12px;
  font-size: 13px;
}
.story { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; padding: 24px; margin: 0 0 28px; }
.story h2 { margin: 0 0 10px; font-size: 20px; }
.groups { margin-bottom: 24px; }
.carousel { margin-top: 20px; }
.carousel-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
}
.carousel-toolbar button, .detail-link {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  padding: 9px 13px;
  font: inherit;
  cursor: pointer;
}
.card-stage {
  position: relative;
  min-height: 560px;
  perspective: 1500px;
  overflow: hidden;
  touch-action: pan-y;
}
.carousel-card {
  position: absolute;
  top: 0;
  left: 50%;
  width: min(330px, 76vw);
  transform:
    translateX(calc(-50% + (var(--offset) * 250px)))
    rotateY(calc(var(--offset) * -14deg))
    scale(calc(1 - (var(--abs-offset) * 0.08)));
  opacity: calc(1 - (var(--abs-offset) * 0.24));
  z-index: calc(10 - var(--abs-offset));
  transition: transform 220ms ease, opacity 220ms ease, border-color 180ms ease;
}
.carousel-card[aria-hidden="true"] { pointer-events: none; opacity: 0; }
.carousel-card.active { border-color: rgba(215, 187, 122, 0.55); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
.card { overflow: hidden; transition: transform 160ms ease, border-color 160ms ease; }
.card:not(.carousel-card):hover { transform: translateY(-3px); border-color: rgba(215, 187, 122, 0.45); }
.card-image img, .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; background: rgba(255,255,255,0.06); }
.card-body { padding: 14px; }
.card-body h2 { margin: 0 0 6px; font-size: 20px; }
.card-body p { margin: 0 0 12px; color: var(--muted); line-height: 1.45; }
.detail-link { display: inline-flex; margin-top: 12px; color: var(--accent); font-weight: 700; }
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
@media (max-width: 820px) {
  .shell { width: min(100% - 22px, 680px); padding-top: 20px; }
  .hero, .story, .detail { grid-template-columns: 1fr; min-height: auto; }
  .hero-copy h1, .detail-copy h1 { font-size: clamp(34px, 14vw, 58px); }
  .detail-copy { position: static; }
  .meta { grid-template-columns: 1fr; }
  .card-stage { min-height: 500px; }
  .carousel-card {
    width: min(300px, 78vw);
    transform:
      translateX(calc(-50% + (var(--offset) * 170px)))
      rotateY(calc(var(--offset) * -10deg))
      scale(calc(1 - (var(--abs-offset) * 0.09)));
  }
}`;
}

function siteJs(): string {
  return `(() => {
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
})();`;
}

function readmeDeploy(data: ExportData): string {
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

function cloudReadme(data: ExportData): string {
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

function nginxConf(data: ExportData): string {
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

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.promises.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, fullPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

async function createZipArchive(sourceDir: string, zipPath: string): Promise<void> {
  const files = await listFiles(sourceDir);
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const relativePath of files) {
    const content = await readFile(path.join(sourceDir, relativePath));
    const name = Buffer.from(relativePath, "utf8");
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);

    offset += local.length + name.length + content.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  await writeFile(zipPath, Buffer.concat([...chunks, ...central, end]));
}

export async function exportShareCollection(
  collection: ShareCollectionWithItems,
  mode: ShareExportMode
): Promise<ShareExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportRoot = path.join(resolveDataDir(), "exports");
  const folderName = `${collection.slug}-${mode}-${timestamp}`;
  const folderPath = path.join(exportRoot, folderName);
  const assetsDir = path.join(folderPath, "assets");
  const imageDir = path.join(assetsDir, "images");
  const cardsDir = path.join(folderPath, "cards");

  await mkdir(imageDir, { recursive: true });
  await mkdir(cardsDir, { recursive: true });

  const cards: ExportCard[] = [];
  let imageCount = 0;
  let coverImage: string | null = null;
  let backgroundImage: string | null = null;
  const sortedItems = [...collection.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const customCoverPath = collection.coverImagePath;
  const customBackgroundPath = collection.backgroundImagePath;

  for (const [cardIndex, item] of sortedItems.entries()) {
    const card = item.card;
    const cardSlug = slugify(`${card.playerName}-${card.cardTitle}`) || `card-${cardIndex + 1}`;
    const images: string[] = [];

    for (const [imageIndex, image] of card.images.entries()) {
      const source = imageSourcePath(image.path);
      if (!fs.existsSync(source)) {
        continue;
      }
      const fileName = `${cardIndex + 1}-${imageIndex + 1}-${safeFileName(path.basename(image.path))}`;
      const relative = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      images.push(relative);
      imageCount += 1;
    }

    cards.push(
      toPublicExportCard({
        item,
        href: `cards/${cardSlug}.html`,
        images
      })
    );
  }

  if (!coverImage && customCoverPath?.startsWith("/share-covers/")) {
    const source = coverSourcePath(customCoverPath);
    if (fs.existsSync(source)) {
      const fileName = `cover-${safeFileName(path.basename(customCoverPath))}`;
      coverImage = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      imageCount += 1;
    }
  }

  if (customBackgroundPath?.startsWith("/share-backgrounds/")) {
    const source = backgroundSourcePath(customBackgroundPath);
    if (fs.existsSync(source)) {
      const fileName = `background-${safeFileName(path.basename(customBackgroundPath))}`;
      backgroundImage = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      imageCount += 1;
    }
  }

  const data: ExportData = {
    title: collection.title,
    subtitle: collection.subtitle,
    description: collection.description,
    themeNarrative: collection.themeNarrative,
    themeHighlights: collection.themeHighlights,
    groupNotes: collection.groupNotes,
    coverImage,
    backgroundImage,
    generatedAt: new Date().toISOString(),
    mode,
    cards
  };

  await writeFile(path.join(assetsDir, "site.css"), siteCss(), "utf8");
  await writeFile(path.join(assetsDir, "site.js"), siteJs(), "utf8");
  await writeFile(path.join(assetsDir, "data.json"), JSON.stringify(data, null, 2), "utf8");
  await writeFile(path.join(folderPath, "index.html"), renderIndex(data), "utf8");
  await writeFile(path.join(folderPath, "README-deploy.md"), readmeDeploy(data), "utf8");

  if (mode === "cloud") {
    await writeFile(path.join(folderPath, "README-deploy-cloud.md"), cloudReadme(data), "utf8");
    await writeFile(path.join(folderPath, "nginx-card-vault-share.conf"), nginxConf(data), "utf8");
  }

  for (const card of cards) {
    await writeFile(path.join(folderPath, card.href), renderCardPage(data, card), "utf8");
  }

  const zipPath = `${folderPath}.zip`;
  await createZipArchive(folderPath, zipPath);

  return {
    folderPath,
    zipPath,
    cardCount: cards.length,
    imageCount
  };
}
