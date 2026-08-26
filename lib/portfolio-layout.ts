export const portfolioFullSectionIds = [
  "financial-position",
  "financial-history",
  "valuation-change",
  "valuation-sources",
  "activity-trend",
  "collection-structure"
] as const;

export const portfolioHalfSectionIds = [
  "high-value",
  "data-quality",
  "high-cost",
  "sold-review"
] as const;

export type PortfolioFullSectionId = (typeof portfolioFullSectionIds)[number];
export type PortfolioHalfSectionId = (typeof portfolioHalfSectionIds)[number];

export type PortfolioLayout = {
  full: PortfolioFullSectionId[];
  half: PortfolioHalfSectionId[];
};

function normalizeOrder<T extends string>(value: unknown, defaults: readonly T[]): T[] {
  const allowed = new Set<string>(defaults);
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized = source.filter((item): item is T => {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
  return [...normalized, ...defaults.filter((item) => !seen.has(item))];
}

export function defaultPortfolioLayout(): PortfolioLayout {
  return { full: [...portfolioFullSectionIds], half: [...portfolioHalfSectionIds] };
}

export function normalizePortfolioLayout(value: unknown): PortfolioLayout {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    full: normalizeOrder(record.full, portfolioFullSectionIds),
    half: normalizeOrder(record.half, portfolioHalfSectionIds)
  };
}

export function reorderPortfolioSections<T extends string>(
  order: readonly T[],
  activeId: T,
  targetId: T,
  position: "before" | "after" = "before"
): T[] {
  if (activeId === targetId || !order.includes(activeId) || !order.includes(targetId)) return [...order];
  const next = order.filter((id) => id !== activeId);
  const targetIndex = next.indexOf(targetId);
  next.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, activeId);
  return next;
}

export function movePortfolioSection<T extends string>(order: readonly T[], id: T, direction: -1 | 1): T[] {
  const currentIndex = order.indexOf(id);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= order.length) return [...order];
  const next = [...order];
  [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
  return next;
}
