"use client";

import Link from "next/link";
import { useLanguage } from "./language-provider";
import { recapChart, recapQuery, recapStats, type RecapSpec, type RecapSummary } from "@/lib/collection-recap";

export function CollectionRecapSummary({ spec, summary }: { spec: RecapSpec; summary: RecapSummary }) {
  const { t } = useLanguage();
  const chart = recapChart(spec, summary), maximum = Math.max(1, ...chart.map(row => row.count));
  const activityLabel = t(spec.month ? "每周活动" : "每月活动");
  const topics = [{ label: "卡片主体", rows: summary.subjects }, { label: "运动类型", rows: summary.sports }, { label: "产品线", rows: summary.series }];
  return <>
    <div className="recap-stats">
      {recapStats(spec, summary).map(stat => <div key={stat.label}><strong>{stat.value}</strong><span>{t(stat.label)}</span></div>)}
    </div>
    <div className="recap-activity">
      <h2>{activityLabel}</h2>
      <div className="recap-months" style={{ gridTemplateColumns: `repeat(${chart.length}, minmax(0, 1fr))` }} aria-label={activityLabel}>
        {chart.map((item, index) => {
          const content = <>
            <span className="recap-bar" style={{ height: `${Math.max(3, 64 * item.count / maximum)}px` }} />
            <strong>{item.count}</strong><small>{item.label}{spec.month ? t("日") : t("月")}</small>
          </>;
          return spec.month ? <div key={index} className="recap-chart-column">{content}</div>
            : <Link key={index} href={`/portfolio/recap?${recapQuery({ ...spec, month: index + 1 })}`} aria-label={`${index + 1} · ${item.count}`}>{content}</Link>;
        })}
      </div>
    </div>
    <div className="recap-topics">
      {topics.map(group => <div key={group.label}>
        <h2>{t(group.label)}</h2>
        {group.rows.length ? <ol>{group.rows.map(row => <li key={row.name}><span>{t(row.name)}</span><strong>{row.count}</strong></li>)}</ol> : <p>{t("暂无数据")}</p>}
      </div>)}
    </div>
  </>;
}
