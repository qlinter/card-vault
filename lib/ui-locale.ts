export const UI_LOCALE_COOKIE = "card_vault_ui_locale";

export type UiLocale = "zh-CN" | "en";

export function normalizeUiLocale(value: unknown): UiLocale {
  return value === "en" ? "en" : "zh-CN";
}

export function formatHomeLoadMoreLabel(locale: UiLocale, remainingCount: number): string {
  return locale === "en"
    ? `Show More (${remainingCount} remaining)`
    : `显示更多（剩余 ${remainingCount}）`;
}
