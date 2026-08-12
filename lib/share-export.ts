import fs from "fs";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import packageJson from "@/package.json";
import { toPublicExportCard } from "@/lib/share-export-data";
import {
  cloudflareHeaders,
  cloudflareRobots,
  dropReadme,
  readmeDeploy,
  renderCardPage,
  renderIndex,
  renderNotFound,
  siteCss,
  siteJs
} from "@/lib/share-export-render";
import {
  ExportCard,
  ExportData,
  ShareCollectionWithItems,
  ShareExportMode,
  ShareExportResult
} from "@/lib/share-export-types";
import { getShareBackgroundsDir, getShareCoversDir, getUploadsDir, resolveDataDir } from "@/lib/storage-paths";
import { normalizeShareTheme, shareThemeBackgroundPath } from "@/lib/share-themes";
import { parseSharePresentation } from "@/lib/share-presentation";
import { normalizeShareSectionLayout } from "@/lib/share-sections";
import { createZipArchive } from "@/lib/zip-archive";
import {
  renderExportValidationReport,
  ShareExportIssue,
  validateExportDirectory,
  validatePublicExportData
} from "@/lib/share-export-validation";

export type { ShareExportMode } from "@/lib/share-export-types";

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "share";
}

function safeFileName(value: string): string {
  const parsed = path.parse(value);
  const name = slugify(parsed.name);
  const extension = parsed.ext.toLowerCase() || ".jpg";
  return `${name}${extension}`;
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
  const issues: ShareExportIssue[] = [];
  const cardFileNames = new Set<string>();
  let imageCount = 0;
  let coverImage: string | null = null;
  let backgroundImage: string | null = null;
  const theme = normalizeShareTheme(collection.theme);
  const sortedItems = [...collection.items].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const [cardIndex, item] of sortedItems.entries()) {
    const card = item.card;
    const cardSlugBase = slugify(`${card.playerName}-${card.cardTitle}`) || `card-${cardIndex + 1}`;
    let cardSlug = cardSlugBase;
    let duplicateIndex = 2;
    while (cardFileNames.has(cardSlug)) {
      cardSlug = `${cardSlugBase}-${duplicateIndex}`;
      duplicateIndex += 1;
    }
    cardFileNames.add(cardSlug);
    const images: string[] = [];

    for (const [imageIndex, image] of card.images.entries()) {
      const source = imageSourcePath(image.path);
      if (!fs.existsSync(source)) {
        issues.push({
          level: "warning",
          code: "missing-card-image",
          message: `${card.playerName} / ${card.cardTitle} 的图片文件不存在，导出包将显示占位图。`
        });
        continue;
      }

      const fileName = `${cardIndex + 1}-${imageIndex + 1}-${safeFileName(path.basename(image.path))}`;
      const relativePath = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      images.push(relativePath);
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

  if (collection.coverImagePath?.startsWith("/share-covers/")) {
    const source = coverSourcePath(collection.coverImagePath);
    if (fs.existsSync(source)) {
      const fileName = `cover-${safeFileName(path.basename(collection.coverImagePath))}`;
      coverImage = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      imageCount += 1;
    } else {
      issues.push({ level: "warning", code: "missing-cover", message: "自定义封面文件不存在，已改用卡片图片或占位内容。" });
    }
  }

  if (collection.backgroundImagePath?.startsWith("/share-backgrounds/")) {
    const source = backgroundSourcePath(collection.backgroundImagePath);
    if (fs.existsSync(source)) {
      const fileName = `background-${safeFileName(path.basename(collection.backgroundImagePath))}`;
      backgroundImage = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      imageCount += 1;
    } else {
      issues.push({ level: "warning", code: "missing-background", message: "自定义背景文件不存在，导出包将使用主题底色。" });
    }
  } else {
    const themeBackground = shareThemeBackgroundPath(theme);
    const source = path.join(process.cwd(), "public", themeBackground.replace(/^\/+/, ""));
    if (fs.existsSync(source)) {
      const fileName = `theme-background-${safeFileName(path.basename(themeBackground))}`;
      backgroundImage = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      imageCount += 1;
    }
  }

  const data: ExportData = {
    title: collection.title,
    theme,
    presentation: parseSharePresentation(collection.presentationConfig),
    subtitle: collection.subtitle,
    description: collection.description,
    themeNarrative: collection.themeNarrative,
    themeHighlights: collection.themeHighlights,
    groupNotes: collection.groupNotes,
    coverImage,
    backgroundImage,
    generatedAt: new Date().toISOString(),
    mode,
    sections: collection.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description ?? "",
      layout: normalizeShareSectionLayout(section.layout),
      cardIds: sortedItems.filter((item) => item.sectionId === section.id).map((item) => item.cardId)
    })),
    cards
  };

  issues.push(...validatePublicExportData(data));
  const publicData = JSON.stringify(data, null, 2);
  const manifest = {
    format: "card-vault-share",
    formatVersion: 1,
    appVersion: packageJson.version,
    title: data.title,
    slug: collection.slug,
    mode,
    generatedAt: data.generatedAt,
    cardCount: cards.length,
    imageCount,
    publicDataSha256: createHash("sha256").update(publicData).digest("hex"),
    temporaryPublishing: mode === "drop" ? { provider: "cloudflare-drop", expiresAfterMinutes: 60 } : null
  };

  await writeFile(path.join(assetsDir, "site.css"), siteCss(), "utf8");
  await writeFile(path.join(assetsDir, "site.js"), siteJs(), "utf8");
  await writeFile(path.join(assetsDir, "data.json"), publicData, "utf8");
  await writeFile(path.join(folderPath, "index.html"), renderIndex(data), "utf8");
  await writeFile(path.join(folderPath, "404.html"), renderNotFound(data), "utf8");
  await writeFile(path.join(folderPath, "publish-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  if (mode === "drop") {
    await writeFile(path.join(folderPath, "README-Cloudflare-Drop.md"), dropReadme(data), "utf8");
    await writeFile(path.join(folderPath, "_headers"), cloudflareHeaders(), "utf8");
    await writeFile(path.join(folderPath, "robots.txt"), cloudflareRobots(), "utf8");
  } else {
    await writeFile(path.join(folderPath, "README-deploy.md"), readmeDeploy(data), "utf8");
  }

  for (const card of cards) {
    await writeFile(path.join(folderPath, card.href), renderCardPage(data, card), "utf8");
  }

  const reportPath = path.join(folderPath, "CHECK-REPORT.md");
  await writeFile(reportPath, "正在生成检查报告。\n", "utf8");
  let validation = await validateExportDirectory(folderPath, issues);
  for (let pass = 0; pass < 5; pass += 1) {
    await writeFile(reportPath, renderExportValidationReport(validation), "utf8");
    const nextValidation = await validateExportDirectory(folderPath, issues);
    const stable =
      nextValidation.fileCount === validation.fileCount &&
      nextValidation.totalBytes === validation.totalBytes &&
      nextValidation.maxFileBytes === validation.maxFileBytes;
    validation = nextValidation;
    if (stable) break;
  }
  if (!validation.valid) {
    const errorSummary = validation.issues
      .filter((issue) => issue.level === "error")
      .slice(0, 3)
      .map((issue) => issue.message)
      .join("；");
    throw new Error(`分享包发布前检查未通过：${errorSummary}`);
  }

  const zipPath = `${folderPath}.zip`;
  await createZipArchive(folderPath, zipPath);

  return {
    folderPath,
    zipPath,
    reportPath,
    cardCount: cards.length,
    imageCount,
    fileCount: validation.fileCount,
    totalBytes: validation.totalBytes,
    warningCount: validation.issues.filter((issue) => issue.level === "warning").length
  };
}
