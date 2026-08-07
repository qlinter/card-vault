export const shareSectionLayouts = [
  { id: "editorial", label: "叙事文章" },
  { id: "rail", label: "横向精选" },
  { id: "grid", label: "卡片矩阵" }
] as const;

export type ShareSectionLayout = (typeof shareSectionLayouts)[number]["id"];

export type ShareSectionDraft = {
  id: string;
  title: string;
  description: string;
  layout: ShareSectionLayout;
  cardIds: string[];
};

const sectionLayoutIds = new Set<string>(shareSectionLayouts.map((layout) => layout.id));

export function normalizeShareSectionLayout(value: unknown): ShareSectionLayout {
  return typeof value === "string" && sectionLayoutIds.has(value) ? (value as ShareSectionLayout) : "editorial";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseShareSectionDrafts(value: unknown, allowedCardIds: readonly string[] = []): ShareSectionDraft[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const allowed = new Set(allowedCardIds);
  return parsed
    .slice(0, 12)
    .map((entry, index) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const cardIds = Array.isArray(record.cardIds)
        ? [...new Set(record.cardIds.map(text).filter((cardId) => cardId && (allowed.size === 0 || allowed.has(cardId))))]
        : [];
      return {
        id: text(record.id) || `section-${index + 1}`,
        title: text(record.title) || `章节 ${index + 1}`,
        description: text(record.description),
        layout: normalizeShareSectionLayout(record.layout),
        cardIds
      };
    })
    .filter((section) => section.title || section.description || section.cardIds.length > 0);
}

export function fallbackShareSections(input: {
  themeNarrative?: string | null;
  themeHighlights?: string | null;
  groupNotes?: string | null;
  cardIds?: string[];
}): ShareSectionDraft[] {
  const cardIds = input.cardIds ?? [];
  const sections: ShareSectionDraft[] = [];
  if (input.themeNarrative) {
    sections.push({ id: "narrative", title: "展馆叙事", description: input.themeNarrative, layout: "editorial", cardIds: [] });
  }
  if (input.themeHighlights) {
    sections.push({ id: "highlights", title: "收藏亮点", description: input.themeHighlights, layout: "rail", cardIds });
  }
  if (input.groupNotes) {
    sections.push({ id: "groups", title: "主题分组", description: input.groupNotes, layout: "grid", cardIds });
  }
  return sections;
}
