import { readFile, readdir } from "fs/promises";
import path from "path";
import type { ExportCard, ExportData, ShareExportMode } from "./share-export-types.ts";

export type ShareExportDiff = {
  isFirstExport: boolean;
  previousGeneratedAt: string | null;
  addedCardIds: string[];
  removedCardIds: string[];
  changedCardIds: string[];
  contentChanged: boolean;
  presentationChanged: boolean;
  sectionsChanged: boolean;
  cardLabels: Record<string, string>;
};

function comparableCard(card: ExportCard) {
  return {
    ...card,
    href: undefined,
    images: card.images.map(({ src, width, height, sourceRotation }) => ({
      sourceName: path.basename(src).replace(/^\d+-\d+-/, "").replace(/-thumb(?=\.[^.]+$)/, ""),
      width,
      height,
      sourceRotation: sourceRotation ?? 0
    }))
  };
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareShareExportData(current: ExportData, previous: ExportData | null): ShareExportDiff {
  const cardLabels = Object.fromEntries(
    [...(previous?.cards ?? []), ...current.cards].map((card) => [card.id, `${card.playerName} / ${card.displayTitle}`])
  );
  if (!previous) {
    return {
      isFirstExport: true,
      previousGeneratedAt: null,
      addedCardIds: current.cards.map((card) => card.id),
      removedCardIds: [],
      changedCardIds: [],
      contentChanged: true,
      presentationChanged: true,
      sectionsChanged: true,
      cardLabels
    };
  }

  const currentCards = new Map(current.cards.map((card) => [card.id, card]));
  const previousCards = new Map(previous.cards.map((card) => [card.id, card]));
  const addedCardIds = current.cards.filter((card) => !previousCards.has(card.id)).map((card) => card.id);
  const removedCardIds = previous.cards.filter((card) => !currentCards.has(card.id)).map((card) => card.id);
  const changedCardIds = current.cards
    .filter((card) => previousCards.has(card.id) && !equal(comparableCard(card), comparableCard(previousCards.get(card.id)!)))
    .map((card) => card.id);

  return {
    isFirstExport: false,
    previousGeneratedAt: previous.generatedAt,
    addedCardIds,
    removedCardIds,
    changedCardIds,
    contentChanged: !equal(
      [current.title, current.subtitle, current.description, current.themeNarrative, current.themeHighlights, current.groupNotes],
      [previous.title, previous.subtitle, previous.description, previous.themeNarrative, previous.themeHighlights, previous.groupNotes]
    ),
    presentationChanged: !equal([current.theme, current.presentation], [previous.theme, previous.presentation]),
    sectionsChanged: !equal(
      current.sections.map((section) => ({ ...section, href: undefined })),
      previous.sections.map((section) => ({ ...section, href: undefined }))
    ),
    cardLabels
  };
}

export async function findPreviousShareExportData(
  exportRoot: string,
  options: { slug: string; mode: ShareExportMode; collectionKey: string }
): Promise<ExportData | null> {
  let entries;
  try {
    entries = await readdir(exportRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  const prefix = `${options.slug}-${options.mode}-`;
  const candidates = entries.filter((entry) => entry.isDirectory()).sort((left, right) => right.name.localeCompare(left.name));
  for (const entry of candidates) {
    try {
      const manifest = JSON.parse(await readFile(path.join(exportRoot, entry.name, "publish-manifest.json"), "utf8")) as Record<string, unknown>;
      const completedReport = await readFile(path.join(exportRoot, entry.name, "CHECK-REPORT.md"), "utf8");
      if (!completedReport.includes("- 结果：通过")) continue;
      const sameCollection = manifest.collectionKey
        ? manifest.collectionKey === options.collectionKey
        : entry.name.startsWith(prefix) && manifest.slug === options.slug;
      if (!sameCollection || manifest.mode !== options.mode) continue;
      return JSON.parse(await readFile(path.join(exportRoot, entry.name, "assets", "data.json"), "utf8")) as ExportData;
    } catch {
      // Ignore incomplete or legacy export folders and continue to the next candidate.
    }
  }
  return null;
}

export function renderShareExportDiffReport(diff: ShareExportDiff, data: ExportData): string {
  const labels = (ids: string[]) => ids.length ? ids.map((id) => `  - ${diff.cardLabels[id] ?? id}`).join("\n") : "  - 无";
  const changedAreas = [
    diff.contentChanged ? "展馆文案" : null,
    diff.presentationChanged ? "视觉配置或重点卡" : null,
    diff.sectionsChanged ? "章节结构" : null
  ].filter(Boolean).join("、") || "无";
  return `# 分享包版本差异\n\n- 当前导出：${data.generatedAt}\n- 对比基准：${diff.previousGeneratedAt ?? "首次导出，无历史版本"}\n- 新增卡片：${diff.addedCardIds.length}\n- 移除卡片：${diff.removedCardIds.length}\n- 修改卡片：${diff.changedCardIds.length}\n- 其他变化：${changedAreas}\n\n## 新增卡片\n\n${labels(diff.addedCardIds)}\n\n## 移除卡片\n\n${labels(diff.removedCardIds)}\n\n## 修改卡片\n\n${labels(diff.changedCardIds)}\n`;
}
