"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UiText } from "./ui-text";
import { NavigationStatus } from "./navigation-status";
import { dataHref, dataTab } from "@/lib/portfolio-workspace";
import type { PortfolioFilterInput } from "@/lib/portfolio-analysis-scope";
import styles from "./portfolio-data.module.css";
import { portfolioTrendState } from "@/lib/portfolio-trend";
export function PortfolioDataTabs({ query, state }: { query: PortfolioFilterInput; state: Record<string, string | undefined> }) {
  const current = useSearchParams();
  const active = dataTab(current.get("tab") || undefined);
  const shared = { ...state, ...portfolioTrendState(current, state) };
  return <nav className={styles.tabs} aria-label="data sections">{[["overview", "总览"], ["trends", "趋势"], ["structure", "结构"], ["details", "明细"]].map(([tab, label]) => <Link href={dataHref(query, shared, { tab, page: undefined })} prefetch={false} key={tab} aria-current={active === tab ? "page" : undefined}><UiText text={label} /><NavigationStatus /></Link>)}</nav>;
}
