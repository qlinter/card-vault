"use client";

import { appThemes } from "@/lib/app-themes";
import { useLanguage } from "./language-provider";
import { useTheme } from "./theme-provider";
import { SettingsDisclosure } from "./settings-disclosure";

export function ThemeSettings() {
  const { locale } = useLanguage();
  const { theme, setTheme } = useTheme();
  const language = locale === "en" ? "en" : "zh";
  const l = (zh: string, en: string) => language === "en" ? en : zh;
  return <SettingsDisclosure id="theme-settings" zh="主题" en="Theme">
    <fieldset className="theme-options">
      <legend className="sr-only">{l("应用主题", "Application theme")}</legend>
      {appThemes.map(item => <label className="theme-option" key={item.id}>
        <input type="radio" name="app-theme" value={item.id} checked={theme === item.id} onChange={() => setTheme(item.id)} />
        <span className="theme-preview" aria-hidden="true" style={{ backgroundImage: `url("${item.background}")` }}>
          <span className={`theme-preview-window theme-preview-${item.id}`}><i /><span><b /><b /><b /></span></span>
        </span>
        <span className="theme-option-copy"><strong>{item.name[language]}</strong></span>
      </label>)}
    </fieldset>
  </SettingsDisclosure>;
}
