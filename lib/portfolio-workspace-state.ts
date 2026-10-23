import { portfolioTrendRangeKeys } from "./portfolio-trend.ts";

const workspaceStateKeys = [
  "tab", "kind", "issue", "search", "order", "page", "dimension", "item", "structure", "closed",
  ...portfolioTrendRangeKeys, "sort"
] as const;

/** Presentation state is shared by page reads and post-action return links. */
export function normalizePortfolioWorkspaceState(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(workspaceStateKeys.flatMap(key => {
    const entry = source[key];
    return typeof entry === "string" && entry.length > 0 && entry.length <= 200 ? [[key, entry]] : [];
  }));
}
