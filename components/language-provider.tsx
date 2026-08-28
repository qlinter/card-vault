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
const textSources = new WeakMap<Text, { source: string; rendered: string }>();
const attributeSources = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();
const translatedAttributes = ["aria-label", "placeholder", "title"];

function shouldSkip(node: Node) {
  const parent = node instanceof Element ? node : node.parentElement;
  return Boolean(parent?.closest("script, style, code, pre, [data-i18n-skip]"));
}

function renderTextNode(node: Text, locale: UiLocale) {
  if (shouldSkip(node)) return;
  const current = node.nodeValue || "";
  const previous = textSources.get(node);
  const source = previous && current === previous.rendered ? previous.source : current;
  const rendered = locale === "en" ? translateUiText(source) : source;
  textSources.set(node, { source, rendered });
  if (current !== rendered) node.nodeValue = rendered;
}

function renderElementAttributes(element: Element, locale: UiLocale) {
  if (shouldSkip(element)) return;
  let records = attributeSources.get(element);
  if (!records) {
    records = new Map();
    attributeSources.set(element, records);
  }
  for (const name of translatedAttributes) {
    const current = element.getAttribute(name);
    if (current === null) continue;
    const previous = records.get(name);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = locale === "en" ? translateUiText(source) : source;
    records.set(name, { source, rendered });
    if (current !== rendered) element.setAttribute(name, rendered);
  }
}

function renderTree(root: Node, locale: UiLocale) {
  if (root instanceof Text) renderTextNode(root, locale);
  if (root instanceof Element) renderElementAttributes(root, locale);
  const documentRoot = root instanceof Document ? root.documentElement : root;
  if (!documentRoot) return;
  const walker = document.createTreeWalker(documentRoot, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) renderTextNode(current, locale);
    else if (current instanceof Element) renderElementAttributes(current, locale);
    current = walker.nextNode();
  }
}

export function LanguageProvider({ initialLocale, children }: { initialLocale: UiLocale; children: React.ReactNode }) {
  const [locale, updateLocale] = useState<UiLocale>(initialLocale);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.uiLocale = locale;
    renderTree(document, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") renderTextNode(mutation.target as Text, locale);
        for (const node of mutation.addedNodes) renderTree(node, locale);
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          renderElementAttributes(mutation.target, locale);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes
    });
    document.documentElement.dataset.uiReady = "true";
    return () => observer.disconnect();
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

