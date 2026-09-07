"use client";

import { createElement, Fragment, type JSX, type ReactNode } from "react";
import { useLanguage } from "./language-provider";

/** User-supplied values are inserted after the application message is translated. */
export function UiText({ text, values = [] }: { text: string; values?: ReactNode[] }) {
  const { t } = useLanguage();
  return <>{t(text).split(/(\{\d+\})/g).map((part, index) => <Fragment key={index}>{/^\{\d+\}$/.test(part) ? values[Number(part.slice(1, -1))] : part}</Fragment>)}</>;
}

export function UiElement<Tag extends keyof JSX.IntrinsicElements>({ as, uiAttributes = [], uiMessages = {}, ...props }: { as: Tag; uiAttributes?: string[]; uiMessages?: Record<string, { text: string; values: unknown[]; translateValues?: number[] }> } & JSX.IntrinsicElements[Tag]) {
  const { t } = useLanguage();
  const localized = { ...props } as Record<string, unknown>;
  for (const key of uiAttributes) if (typeof localized[key] === "string") localized[key] = t(localized[key]);
  for (const [key, message] of Object.entries(uiMessages)) localized[key] = t(message.text).replace(/\{(\d+)\}/g, (_match, index) => {
    const value = String(message.values[Number(index)] ?? "");
    return message.translateValues?.includes(Number(index)) ? t(value) : value;
  });
  return createElement(as, localized);
}
