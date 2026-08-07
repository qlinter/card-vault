import fs from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { toPublicExportCard } from "@/lib/share-export-data";
import {
  cloudReadme,
  nginxConf,
  readmeDeploy,
  renderCardPage,
  renderIndex,
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
  let imageCount = 0;
  let coverImage: string | null = null;
  let backgroundImage: string | null = null;
  const theme = normalizeShareTheme(collection.theme);
  const sortedItems = [...collection.items].sort((a, b) => a.sortOrder - b.sortOrder);

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
    }
  }

  if (collection.backgroundImagePath?.startsWith("/share-backgrounds/")) {
    const source = backgroundSourcePath(collection.backgroundImagePath);
    if (fs.existsSync(source)) {
      const fileName = `background-${safeFileName(path.basename(collection.backgroundImagePath))}`;
      backgroundImage = `assets/images/${fileName}`;
      await fs.promises.copyFile(source, path.join(imageDir, fileName));
      imageCount += 1;
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
