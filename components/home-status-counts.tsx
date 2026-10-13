"use client";
import { cardCollectionStatuses, collectionStatusText, type CardCollectionStatus } from "@/lib/card-domain";
import { useLanguage } from "./language-provider";
import Link from "next/link";

const shortEnglish: Record<CardCollectionStatus, string> = { holding: "Held", pending_grading: "To grade", grading: "Grading", listed: "For sale", sold: "Sold" };
export function HomeStatusCounts({ counts, scope, activeStatus }: { counts: Partial<Record<CardCollectionStatus, number>>; scope: string; activeStatus?: string }) {
  const { locale, t } = useLanguage();
  return <dl className="home-status-counts">
    {cardCollectionStatuses.map(status => {
      const params = new URLSearchParams(scope);
      if (activeStatus === status) params.delete("collectionStatus"); else params.set("collectionStatus", status);
      params.delete("page");
      const label = locale === "en" ? shortEnglish[status] : collectionStatusText(status);
      const href = params.size ? "/?" + params : "/";
      return <div key={status} data-status={status}><dt><Link href={href} aria-current={activeStatus === status ? "true" : undefined} title={t(collectionStatusText(status))} aria-label={(locale === "en" ? (activeStatus === status ? "Clear status filter: " : "Filter status: ") : (activeStatus === status ? "取消状态筛选：" : "筛选状态：")) + label}>{label}</Link></dt><dd><Link href={href} aria-hidden="true" tabIndex={-1}>{counts[status] ?? 0}</Link></dd></div>;
    })}
  </dl>;
}
