export const initialHomeCardCount = 24;
export const homeCardCountStep = 24;

const homeGridHistoryStateKey = "cardVaultHomeGrid";

type HomeGridHistoryState = {
  key: string;
  visibleCount: number;
};

function historyRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function restoreHomeGridVisibleCount(
  browserState: unknown,
  historyKey: string,
  cardCount: number
): number | null {
  const savedState = historyRecord(historyRecord(browserState)?.[homeGridHistoryStateKey]);
  if (
    savedState?.key !== historyKey ||
    typeof savedState.visibleCount !== "number" ||
    !Number.isInteger(savedState.visibleCount)
  ) return null;
  return Math.min(Math.max(savedState.visibleCount, initialHomeCardCount), cardCount);
}

export function saveHomeGridVisibleCount(
  browserState: unknown,
  historyKey: string,
  visibleCount: number
): Record<string, unknown> {
  return {
    ...(historyRecord(browserState) ?? {}),
    [homeGridHistoryStateKey]: { key: historyKey, visibleCount } satisfies HomeGridHistoryState
  };
}
