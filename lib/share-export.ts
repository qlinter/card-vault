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
  renderSectionPage,
  renderSubjectPage,
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
import { parseSharePresentation, sanitizeSharePresentationCards } from "@/lib/share-presentation";
import { normalizeShareSectionLayout } from "@/lib/share-sections";
import {
  createShareExportImageVariants,
  shareExportBackgroundMaxWidth,
  shareExportImageMaxEdge,
  shareExportThumbnailMaxEdge
} from "@/lib/share-export-images";
import { slugify } from "@/lib/slugify";
import { createZipArchive } from "@/lib/zip-archive";
import {
  renderExportValidationReport,
  ShareExportIssue,
  validateExportDirectory,
  validatePublicExportData
} from "@/lib/share-export-validation";
import { auditShareAccessibility } from "@/lib/share-accessibility";
import {
  compareShareExportData,
  findPreviousShareExportData,
  renderShareExportDiffReport
} from "@/lib/share-export-diff";

export type { ShareExportMode } from "@/lib/share-export-types";

function safeFileName(value: string): string {
  const parsed = path.parse(value);
  const name = slugify(parsed.name);
  const extension = parsed.ext.toLowerCase() || ".jpg";
  return `${name}${extension}`;
}

function uniquePageHref(directory: string, value: string, index: number, used: Set<string>): string {
  const base = slugify(value, "") || `page-${index + 1}`;
  let slug = base;
  let duplicateIndex = 2;
  while (used.has(slug)) {
    slug = `${base}-${duplicateIndex}`;
    duplicateIndex += 1;
  }
  used.add(slug);
  return `${directory}/${slug}.html`;
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
  const sectionsDir = path.join(folderPath, "sections");
  const subjectsDir = path.join(folderPath, "subjects");

  await mkdir(imageDir, { recursive: true });
  await mkdir(cardsDir, { recursive: true });
  await mkdir(sectionsDir, { recursive: true });
  await mkdir(subjectsDir, { recursive: true });

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
    const images: ExportCard["images"] = [];

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

      const sourceStem = slugify(path.parse(path.basename(image.path)).name) || "card-image";
      const baseName = `${cardIndex + 1}-${imageIndex + 1}-${sourceStem}`;
      try {
        const optimized = await createShareExportImageVariants({
          sourcePath: source,
          targetDirectory: imageDir,
          baseName,
          rotation: image.rotation
        });
        images.push(optimized.image);
        imageCount += optimized.fileCount;
      } catch {
        const fileName = `${baseName}-${safeFileName(path.basename(image.path))}`;
        const relativePath = `assets/images/${fileName}`;
        await fs.promises.copyFile(source, path.join(imageDir, fileName));
        images.push({
          src: relativePath,
          thumbnailSrc: relativePath,
          width: 0,
          height: 0,
          rotation: image.rotation,
          sourceRotation: image.rotation
        });
        imageCount += 1;
        issues.push({
          level: "warning",
          code: "image-optimization-fallback",
          message: `${card.playerName} / ${card.cardTitle} 的图片无法优化，已保留原文件。`
        });
      }
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
      const optimized = await createShareExportImageVariants({
        sourcePath: source,
        targetDirectory: imageDir,
        baseName: "cover",
        thumbnail: false
      });
      coverImage = optimized.image.src;
      imageCount += optimized.fileCount;
    } else {
      issues.push({ level: "warning", code: "missing-cover", message: "自定义封面文件不存在，已改用卡片图片或占位内容。" });
    }
  }

  if (collection.backgroundImagePath?.startsWith("/share-backgrounds/")) {
    const source = backgroundSourcePath(collection.backgroundImagePath);
    if (fs.existsSync(source)) {
      const optimized = await createShareExportImageVariants({
        sourcePath: source,
        targetDirectory: imageDir,
        baseName: "background",
        thumbnail: false,
        maxWidth: shareExportBackgroundMaxWidth,
        maxHeight: 1600,
        quality: 80
      });
      backgroundImage = optimized.image.src;
      imageCount += optimized.fileCount;
    } else {
      issues.push({ level: "warning", code: "missing-background", message: "自定义背景文件不存在，导出包将使用主题底色。" });
    }
  } else {
    const themeBackground = shareThemeBackgroundPath(theme);
    const source = path.join(process.cwd(), "public", themeBackground.replace(/^\/+/, ""));
    if (fs.existsSync(source)) {
      const optimized = await createShareExportImageVariants({
        sourcePath: source,
        targetDirectory: imageDir,
        baseName: "theme-background",
        thumbnail: false,
        maxWidth: shareExportBackgroundMaxWidth,
        maxHeight: 1600,
        quality: 80
      });
      backgroundImage = optimized.image.src;
      imageCount += optimized.fileCount;
    }
  }

  const sectionPageNames = new Set<string>();
  const subjectPageNames = new Set<string>();
  const subjectsByName = new Map<string, string[]>();
  for (const card of cards) {
    const ids = subjectsByName.get(card.playerName);
    if (ids) ids.push(card.id);
    else subjectsByName.set(card.playerName, [card.id]);
  }

  const data: ExportData = {
    title: collection.title,
    theme,
    presentation: sanitizeSharePresentationCards(
      parseSharePresentation(collection.presentationConfig),
      cards.map((card) => card.id)
    ),
    subtitle: collection.subtitle,
    description: collection.description,
    themeNarrative: collection.themeNarrative,
    themeHighlights: collection.themeHighlights,
    groupNotes: collection.groupNotes,
    coverImage,
    coverRotation: 0,
    backgroundImage,
    generatedAt: new Date().toISOString(),
    mode,
    sections: collection.sections.map((section, index) => ({
      id: section.id,
      title: section.title,
      description: section.description ?? "",
      layout: normalizeShareSectionLayout(section.layout),
      cardIds: sortedItems.filter((item) => item.sectionId === section.id).map((item) => item.cardId),
      href: uniquePageHref("sections", section.title, index, sectionPageNames)
    })),
    subjects: [...subjectsByName.entries()].map(([name, cardIds], index) => ({
      name,
      cardIds,
      href: uniquePageHref("subjects", name, index, subjectPageNames)
    })),
    cards
  };

  issues.push(...validatePublicExportData(data));
  const accessibilityIssues = auditShareAccessibility(data);
  issues.push(...accessibilityIssues);
  const collectionKey = createHash("sha256").update(collection.id).digest("hex").slice(0, 20);
  const previousData = await findPreviousShareExportData(exportRoot, {
    slug: collection.slug,
    mode,
    collectionKey
  });
  const diff = compareShareExportData(data, previousData);
  const publicData = JSON.stringify(data, null, 2);
  const manifest = {
    format: "card-vault-share",
    formatVersion: 3,
    appVersion: packageJson.version,
    title: data.title,
    slug: collection.slug,
    collectionKey,
    mode,
    generatedAt: data.generatedAt,
    cardCount: cards.length,
    imageCount,
    sectionPageCount: data.sections.length,
    subjectPageCount: data.subjects?.length ?? 0,
    imagePolicy: {
      format: "webp",
      cardMaxEdge: shareExportImageMaxEdge,
      thumbnailMaxEdge: shareExportThumbnailMaxEdge,
      backgroundMaxWidth: shareExportBackgroundMaxWidth
    },
    accessibility: {
      passed: !accessibilityIssues.some((issue) => issue.level === "error"),
      errors: accessibilityIssues.filter((issue) => issue.level === "error").length,
      warnings: accessibilityIssues.filter((issue) => issue.level === "warning").length
    },
    diffSummary: {
      firstExport: diff.isFirstExport,
      previousGeneratedAt: diff.previousGeneratedAt,
      addedCards: diff.addedCardIds.length,
      removedCards: diff.removedCardIds.length,
      changedCards: diff.changedCardIds.length,
      contentChanged: diff.contentChanged,
      presentationChanged: diff.presentationChanged,
      sectionsChanged: diff.sectionsChanged
    },
    publicDataSha256: createHash("sha256").update(publicData).digest("hex"),
    temporaryPublishing: mode === "drop" ? { provider: "cloudflare-drop", expiresAfterMinutes: 60 } : null
  };

  await writeFile(path.join(assetsDir, "site.css"), siteCss(), "utf8");
  await writeFile(path.join(assetsDir, "site.js"), siteJs(), "utf8");
  await writeFile(path.join(assetsDir, "data.json"), publicData, "utf8");
  await writeFile(path.join(folderPath, "index.html"), renderIndex(data), "utf8");
  await writeFile(path.join(folderPath, "404.html"), renderNotFound(data), "utf8");
  await writeFile(path.join(folderPath, "publish-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  const diffPath = path.join(folderPath, "EXPORT-DIFF.md");
  await writeFile(diffPath, renderShareExportDiffReport(diff, data), "utf8");

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
  for (const section of data.sections) {
    if (section.href) await writeFile(path.join(folderPath, section.href), renderSectionPage(data, section), "utf8");
  }
  for (const subject of data.subjects ?? []) {
    await writeFile(path.join(folderPath, subject.href), renderSubjectPage(data, subject), "utf8");
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
    diffPath,
    cardCount: cards.length,
    imageCount,
    fileCount: validation.fileCount,
    totalBytes: validation.totalBytes,
    warningCount: validation.issues.filter((issue) => issue.level === "warning").length,
    diff: {
      isFirstExport: diff.isFirstExport,
      added: diff.addedCardIds.length,
      removed: diff.removedCardIds.length,
      changed: diff.changedCardIds.length
    }
  };
}
