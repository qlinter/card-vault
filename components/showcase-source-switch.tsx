"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { rememberShowcaseSource } from "@/lib/showcase-source";
import { useLanguage } from "./language-provider";

export function ShowcaseSourceSwitch({ studio, guest }: { studio: boolean; guest: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function choose(next: boolean) {
    if (next === studio || pending) return;
    rememberShowcaseSource(guest, next);
    startTransition(() => router.refresh());
  }
  return <div className="showcase-source-switch" role="group" aria-label={t("图片来源")} aria-busy={pending}>
    <button type="button" aria-pressed={studio} onClick={() => choose(true)}>{t("AI 展馆图")}</button>
    <button type="button" aria-pressed={!studio} onClick={() => choose(false)}>{t("录入原图")}</button>
  </div>;
}
