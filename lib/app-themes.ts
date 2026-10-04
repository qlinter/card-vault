import type { CSSProperties } from "react";

export const APP_THEME_COOKIE = "card_vault_app_theme";
// Used only when there is no valid stored selection; never overrides a user choice.
const FALLBACK_APP_THEME = "classic";

type Palette = {
  ink: string; slate: string; muted: string; surface: string; soft: string;
  canvas: string; accent: string; accentHover: string; onAccent: string;
  teal: string; cyan: string; positive: string; negative: string; warning: string;
  blue: string; purple: string; neutralRgb: string; surfaceRgb: string;
  shade: string; scheme: "light" | "dark";
};

function paletteTokens(p: Palette): Record<`--${string}`, string> {
  return {
    "--ink": p.ink, "--slate": p.slate, "--muted": p.muted, "--muted-ink": p.muted,
    "--paper": p.surface, "--surface": p.surface, "--surface-soft": p.soft, "--sand": p.soft,
    "--accent": p.accent, "--teal": p.teal, "--cyan": p.cyan,
    "--line": `rgba(${p.neutralRgb}, 0.14)`, "--line-strong": `rgba(${p.neutralRgb}, 0.24)`,
    "--theme-neutral-rgb": p.neutralRgb, "--theme-surface-rgb": p.surfaceRgb,
    "--theme-canvas": p.canvas, "--theme-shade": p.shade,
    "--theme-text": p.slate, "--theme-muted": p.muted,
    "--theme-soft": p.soft, "--theme-surface": p.surface,
    "--theme-positive": p.positive, "--theme-negative": p.negative,
    "--theme-warning": p.warning, "--theme-blue": p.blue, "--theme-purple": p.purple,
    "--theme-orange": p.scheme === "dark" ? "#efad81" : "#b65b31",
    "--theme-link": p.teal, "--theme-on-strong": p.surface,
    "--theme-on-accent": p.onAccent, "--theme-accent-hover": p.accentHover,
    "--theme-shadow": p.scheme === "dark" ? "0 10px 32px rgb(0 0 0 / .22)" : "0 10px 32px rgb(28 34 45 / .07)",
    "--theme-color-scheme": p.scheme,
    "--theme-select-arrow": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='m3 6 5 5 5-5' fill='none' stroke='%23${p.muted.slice(1)}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`
  };
}

// Add a registry entry and local background to extend the application themes.
// Classic intentionally supplies no color overrides: existing page styles remain authoritative.
export const appThemes = [
  { id: "classic", name: { zh: "经典", en: "Classic" }, background: "/home-bg.webp", tokens: {} },
  { id: "gallery", name: { zh: "极简展厅", en: "Minimal Gallery" }, background: "/app-themes/gallery.webp", tokens: paletteTokens({
    ink: "#192e34", slate: "#354c53", muted: "#586f76", surface: "#fbfdfd", soft: "#edf3f3", canvas: "#e9eff0",
    accent: "#24676a", accentHover: "#195356", onAccent: "#ffffff", teal: "#256a6c", cyan: "#449394",
    positive: "#24704e", negative: "#b03c35", warning: "#85611f", blue: "#486f9e", purple: "#8260a7",
    neutralRgb: "25, 46, 52", surfaceRgb: "251, 253, 253", shade: "rgba(234, 242, 242, .18)", scheme: "light"
  }) },
  { id: "midnight", name: { zh: "午夜典藏", en: "Midnight Collection" }, background: "/app-themes/midnight.webp", tokens: paletteTokens({
    ink: "#edf1f5", slate: "#d1dbe5", muted: "#a6b5c6", surface: "#152332", soft: "#1d3042", canvas: "#0b1420",
    accent: "#d7b77a", accentHover: "#e8cb96", onAccent: "#15202c", teal: "#87c9c5", cyan: "#a4d9d4",
    positive: "#87d7aa", negative: "#ffaaa0", warning: "#e7c784", blue: "#96baf3", purple: "#c3a4f3",
    neutralRgb: "202, 220, 237", surfaceRgb: "21, 35, 50", shade: "rgba(8, 16, 27, .20)", scheme: "dark"
  }) },
  { id: "archive", name: { zh: "暖纸档案", en: "Warm Archive" }, background: "/app-themes/archive.webp", tokens: paletteTokens({
    ink: "#392f27", slate: "#55483c", muted: "#776553", surface: "#fffcf5", soft: "#f2ebdf", canvas: "#eee5d6",
    accent: "#886034", accentHover: "#704b26", onAccent: "#ffffff", teal: "#596b50", cyan: "#839879",
    positive: "#486b3e", negative: "#b04136", warning: "#86601d", blue: "#516e96", purple: "#896192",
    neutralRgb: "57, 47, 39", surfaceRgb: "255, 252, 245", shade: "rgba(250, 242, 227, .15)", scheme: "light"
  }) }
] as const;

export type AppThemeId = typeof appThemes[number]["id"];

export function normalizeAppTheme(value: unknown): AppThemeId {
  return appThemes.find(theme => theme.id === value)?.id ?? FALLBACK_APP_THEME;
}

export function appThemeStyle(id: AppThemeId): CSSProperties {
  const theme = appThemes.find(item => item.id === id) ?? appThemes[0];
  return theme.id === FALLBACK_APP_THEME ? {} : {
    ...theme.tokens,
    "--theme-background": `url("${theme.background}")`
  } as CSSProperties;
}
