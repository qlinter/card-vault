"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageSwitch() {
  const { locale, setLocale } = useLanguage();
  const nextLocale = locale === "en" ? "zh-CN" : "en";
  const label = locale === "en" ? "切换到中文" : "切换到英文";
  return (
    <button
      type="button"
      className="language-switch"
      aria-label={label}
      title={label}
      onClick={() => setLocale(nextLocale)}
    >
      <span className={locale === "zh-CN" ? "active" : undefined}>ZH</span>
      <span aria-hidden="true">/</span>
      <span className={locale === "en" ? "active" : undefined}>EN</span>
    </button>
  );
}
