"use client";
import Link from "next/link";
import { useLanguage } from "./language-provider";
import type { loadHomeOverview } from "@/lib/home-overview";
import { useWorkspaceData } from "./use-workspace-data";
import { WorkspaceFeedback } from "./workspace-feedback";
import styles from "./portfolio-data.module.css";

type Data = Awaited<ReturnType<typeof loadHomeOverview>>;

export function HomeOverview({ scope, reviewHref, qualityCount }: { scope: string; reviewHref: string; qualityCount: number }) {
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  const { data, issue, busy, mutate, refresh } = useWorkspaceData<Data>("/api/home-overview?" + scope, "/api/collection-management");
  return <div className="home-overview-grid" aria-busy={!data}>
    <div className="summary-grid home-summary-grid">
      <section className="panel overview-digest">
        <div className="title-row home-summary-head"><h2 className="overview-title">{l("收藏概览", "Collection overview")}</h2><label><span className="sr-only">{l("统计周期", "Period")}</span><select aria-label={l("统计周期", "Period")} disabled={busy || !data} value={data?.cadence ?? "weekly"} onChange={event => void mutate({ action: "settings", digestCadence: event.target.value })}><option value="weekly">{l("最近 7 天", "Last 7 days")}</option><option value="monthly">{l("最近 30 天", "Last 30 days")}</option></select></label></div>
        <div className="overview-metrics">{[[l("新增", "New cards"), data?.digest.newCards, l("统计周期内新增的卡片档案数", "Card archives created in this period")], [l("出售", "Sales"), data?.digest.sales, l("统计周期内的出售记录数", "Sale records in this period")], [l("估值", "Valuations"), data?.digest.valuations, l("统计周期内的估值记录数", "Valuation records in this period")]].map(([label, value, title]) => <div key={label} title={String(title)}><span>{label}</span><strong>{value ?? "–"}</strong></div>)}</div>
      </section>
    </div>
    <WorkspaceFeedback issue={issue} submitting={false} notice={false} refresh={() => void refresh()} />
    <Link className={styles.attention} href={reviewHref}><span>{l("待完善数据", "Data to complete")} · {qualityCount} {l("项", "items")}{data?.followupOpenCount ? <small> · {l("待跟进", "Follow-ups")} {data.followupOpenCount}</small> : null}</span><span>{l("整理", "Review")} →</span></Link>
  </div>;
}
