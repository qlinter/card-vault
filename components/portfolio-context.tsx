"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { portfolioTrendRangeKeys, portfolioTrendState } from "@/lib/portfolio-trend";
export function PortfolioScopeLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const search = useSearchParams();
  const target = new URL(href, "http://localhost");
  for (const key of portfolioTrendRangeKeys) if (search.get(key)) target.searchParams.set(key, search.get(key)!);
  return <Link href={target.pathname + target.search} className={className} prefetch={false}>{children}</Link>;
}
export function PortfolioContextFields({ state, queryJson }: { state: Record<string, string | undefined>; queryJson: string }) {
  const search = useSearchParams();
  return <><input type="hidden" name="stateJson" value={JSON.stringify({ ...state, ...portfolioTrendState(search, state) })} /><input type="hidden" name="queryJson" value={queryJson} /></>;
}
export function PortfolioRangeField() {
  const search = useSearchParams();
  return <>{portfolioTrendRangeKeys.map(key => search.get(key) ? <input type="hidden" key={key} name={key} value={search.get(key)!} /> : null)}</>;
}
