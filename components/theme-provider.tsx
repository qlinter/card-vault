"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { APP_THEME_COOKIE, appThemes, appThemeStyle, normalizeAppTheme, type AppThemeId } from "@/lib/app-themes";

const ThemeContext = createContext<{ theme: AppThemeId; setTheme: (theme: AppThemeId) => void } | null>(null);
const themeProperties = new Set(appThemes.flatMap(theme => Object.keys(appThemeStyle(theme.id))));

export function ThemeProvider({ initialTheme, children }: { initialTheme: AppThemeId; children: React.ReactNode }) {
  const [theme, updateTheme] = useState(initialTheme);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appTheme = theme;
    for (const property of themeProperties) root.style.removeProperty(property);
    for (const [property, value] of Object.entries(appThemeStyle(theme))) root.style.setProperty(property, String(value));
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme(next: AppThemeId) {
    const normalized = normalizeAppTheme(next);
    document.cookie = `${APP_THEME_COOKIE}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
    updateTheme(normalized);
  } }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
