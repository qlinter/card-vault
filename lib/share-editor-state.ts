import type { ShareCardDraft } from "../components/share-card-picker.tsx";
import type { ShareThemeValues } from "../components/share-theme-generator.tsx";
import { parseSharePresentation, type SharePresentation } from "./share-presentation.ts";
import { normalizeShareSectionLayout, type ShareSectionDraft } from "./share-sections.ts";
import { normalizeShareTheme, type ShareThemeId } from "./share-themes.ts";

export const shareEditorDraftVersion = 1;

export type ShareEditorSnapshot = {
  selectedIds: string[];
  drafts: Record<string, ShareCardDraft>;
  themeValues: ShareThemeValues;
  theme: ShareThemeId;
  presentation: SharePresentation;
  sections: ShareSectionDraft[];
  coverMode: "auto" | "custom";
};

export type ShareEditorDraft = {
  version: typeof shareEditorDraftVersion;
  savedAt: string;
  snapshot: ShareEditorSnapshot;
};

export function reorderIds(ids: readonly string[], activeId: string, targetId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) {
    return [...ids];
  }
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) {
    return [...ids];
  }
  return reorderIds(ids, id, ids[target]);
}

export function normalizeCardOrder(
  selectedIds: readonly string[],
  drafts: Record<string, ShareCardDraft>
): Record<string, ShareCardDraft> {
  const next = { ...drafts };
  selectedIds.forEach((cardId, index) => {
    const current = next[cardId] ?? { sortOrder: "", displayTitle: "", displayDescription: "" };
    next[cardId] = { ...current, sortOrder: String(index + 1) };
  });
  return next;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseShareEditorDraft(value: string, allowedCardIds: readonly string[]): ShareEditorDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<ShareEditorDraft>;
    if (parsed.version !== shareEditorDraftVersion || !parsed.snapshot || typeof parsed.snapshot !== "object") {
      return null;
    }
    const allowed = new Set(allowedCardIds);
    const snapshot = parsed.snapshot as Partial<ShareEditorSnapshot>;
    const selectedIds = Array.isArray(snapshot.selectedIds)
      ? [...new Set(snapshot.selectedIds.filter((id): id is string => typeof id === "string" && allowed.has(id)))]
      : [];
    const rawDrafts = snapshot.drafts && typeof snapshot.drafts === "object" ? snapshot.drafts : {};
    const drafts = Object.fromEntries(allowedCardIds.map((cardId) => {
      const draft = rawDrafts[cardId];
      return [cardId, {
        sortOrder: text(draft?.sortOrder),
        displayTitle: text(draft?.displayTitle),
        displayDescription: text(draft?.displayDescription)
      }];
    }));
    const values: Partial<Record<keyof ShareThemeValues, unknown>> =
      snapshot.themeValues && typeof snapshot.themeValues === "object" ? snapshot.themeValues : {};
    const sections: ShareSectionDraft[] = Array.isArray(snapshot.sections)
      ? snapshot.sections.slice(0, 12).map((section, index) => ({
          id: text(section?.id) || `section-${index + 1}`,
          title: text(section?.title) || `章节 ${index + 1}`,
          description: text(section?.description),
          layout: normalizeShareSectionLayout(section?.layout),
          cardIds: Array.isArray(section?.cardIds)
            ? [...new Set(section.cardIds.filter((id): id is string => typeof id === "string" && selectedIds.includes(id)))]
            : []
        }))
      : [];
    return {
      version: shareEditorDraftVersion,
      savedAt: text(parsed.savedAt) || new Date(0).toISOString(),
      snapshot: {
        selectedIds,
        drafts: normalizeCardOrder(selectedIds, drafts),
        themeValues: {
          title: text(values.title),
          subtitle: text(values.subtitle),
          description: text(values.description),
          themeNarrative: text(values.themeNarrative),
          themeHighlights: text(values.themeHighlights),
          groupNotes: text(values.groupNotes)
        },
        theme: normalizeShareTheme(snapshot.theme),
        presentation: parseSharePresentation(snapshot.presentation),
        sections,
        coverMode: snapshot.coverMode === "custom" ? "custom" : "auto"
      }
    };
  } catch {
    return null;
  }
}

export function snapshotsEqual(left: ShareEditorSnapshot, right: ShareEditorSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
