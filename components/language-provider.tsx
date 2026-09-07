"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { UI_LOCALE_COOKIE, type UiLocale } from "@/lib/ui-locale";
import { translateUiText } from "@/lib/ui-translations";

type LanguageContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
export function LanguageProvider({ initialLocale, children }: { initialLocale: UiLocale; children: React.ReactNode }) {
  const [locale, updateLocale] = useState<UiLocale>(initialLocale);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.uiLocale = locale;
    document.documentElement.dataset.uiReady = "true";

  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      document.cookie = `${UI_LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.dataset.uiReady = "false";
      updateLocale(nextLocale);
    },
    t: (text) => locale === "en" ? translateUiText(text) : text
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider.");
  return value;
}

