"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  PortfolioAllocationBreakdown,
  PortfolioConcentrationDimension,
  PortfolioFilterField,
  PortfolioSnapshot
} from "@/lib/portfolio-analysis";
import { formatPercentage } from "@/lib/percentage-format";
import styles from "./portfolio-center.module.css";

type StructureMode = "primary" | "extended" | "attributes";

function concentrationLevel(hhi: number): string {
  if (hhi >= 2500) return "较集中";
  if (hhi >= 1500) return "中等";
  return "分散";
}

function deriveConcentration(items: PortfolioAllocationBreakdown[]): PortfolioConcentrationDimension {
  const currencies = new Set(items.flatMap((item) => Object.keys(item.valueShare)));
  const topValueShare = (limit: number) => Object.fromEntries([...currencies].map((currency) => [
    currency,
    items.map((item) => item.valueShare[currency] ?? 0).sort((left, right) => right - left).slice(0, limit).reduce((sum, value) => sum + value, 0)
  ]));
  return {
    top1CountShare: items[0]?.countShare ?? 0,
    top3CountShare: items.slice(0, 3).reduce((sum, item) => sum + item.countShare, 0),
    top1ValueShare: topValueShare(1),
    top3ValueShare: topValueShare(3),
    hhiByCurrency: Object.fromEntries([...currencies].map((currency) => [currency, items.reduce((sum, item) => sum + Math.pow(item.valueShare[currency] ?? 0, 2), 0)]))
  };
}

function AllocationCard({ title, items, concentration, currency, filterField }: {
  title: string;
  items: PortfolioAllocationBreakdown[];
  concentration: PortfolioConcentrationDimension;
  currency: string;
  filterField: PortfolioFilterField;
}) {
  const hasValues = items.some((item) => (item.valueShare[currency] ?? 0) > 0);
  const topItems = [...items].sort((left, right) => hasValues
    ? (right.valueShare[currency] ?? 0) - (left.valueShare[currency] ?? 0)
    : right.countShare - left.countShare).slice(0, 5);
  const hhi = concentration.hhiByCurrency[currency] ?? 0;
  return <article className={styles.allocationCard}>
    <header><div><span>结构分布</span><h3>{title}</h3></div></header>
    <div className={styles.allocationBars}>
      {topItems.map((item) => {
        const share = hasValues ? item.valueShare[currency] ?? 0 : item.countShare;
        return <div key={item.name} className={styles.allocationRow}>
          <div>{item.name === "未填写" ? <span>{item.name}</span> : <Link href={`/?${filterField}=${encodeURIComponent(item.name)}`}>{item.name}</Link>}<strong>{formatPercentage(share, { fractionDigits: 1 })}</strong></div>
          <i><b style={{ width: `${Math.min(100, share)}%` }} /></i>
        </div>;
      })}
      {topItems.length === 0 ? <p className={styles.emptyText}>暂无分布数据。</p> : null}
    </div>
    <footer>
      <span>Top 1 <strong>{formatPercentage(hasValues ? concentration.top1ValueShare[currency] ?? 0 : concentration.top1CountShare)}</strong></span>
      <span>Top 3 <strong>{formatPercentage(hasValues ? concentration.top3ValueShare[currency] ?? 0 : concentration.top3CountShare)}</strong></span>
      <span>集中度 <strong>{hhi > 0 ? concentrationLevel(hhi) : "—"}</strong></span>
    </footer>
  </article>;
}

function AttributeCard({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const items = [
    { label: "新秀卡", count: snapshot.quality.rookieCount, field: "isRookie" },
    { label: "签名卡", count: snapshot.quality.autographCount, field: "isAutograph" },
    { label: "Patch", count: snapshot.quality.patchCount, field: "isPatch" },
    { label: "限量卡", count: snapshot.quality.serialNumberedCount, field: "isSerialNumbered" }
  ] as const;
  return <article className={styles.allocationCard}>
    <header><div><span>结构分布</span><h3>卡片属性</h3></div></header>
    <div className={styles.attributeList}>{items.map((item) => {
      const share = snapshot.activeCount > 0 ? item.count / snapshot.activeCount * 100 : 0;
      return <Link href={`/?${item.field}=true`} key={item.field}><span>{item.label}</span><strong>{item.count} 张</strong><small>{formatPercentage(share, { fractionDigits: 1 })}</small></Link>;
    })}</div>
  </article>;
}

export function PortfolioValuationSources({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const total = snapshot.financials.valuationSources.reduce((sum, item) => sum + item.count, 0);
  return <section className={styles.section}>
    <header className={styles.sectionHeader}><div><span>VALUATION SOURCES</span><h2>估值来源</h2></div></header>
    <div className={styles.sourceList}>
      {snapshot.financials.valuationSources.map((item) => {
        const share = total > 0 ? item.count / total * 100 : 0;
        return <div key={item.name}><div><span>{item.name}</span><strong>{item.count} 张 · {formatPercentage(share, { fractionDigits: 1 })}</strong></div><i><b style={{ width: `${share}%` }} /></i></div>;
      })}
      {total === 0 ? <p className={styles.emptyText}>暂无估值来源数据。</p> : null}
    </div>
  </section>;
}

export function PortfolioStructureSection({ snapshot, currencies }: { snapshot: PortfolioSnapshot; currencies: string[] }) {
  const [mode, setMode] = useState<StructureMode>("primary");
  const [currency, setCurrency] = useState(currencies.includes("CNY") ? "CNY" : currencies[0] ?? "CNY");
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <div><span>CONCENTRATION</span><h2>收藏结构</h2></div>
      <div className={styles.structureControls}>
        <select className={styles.rangeSelect} aria-label="收藏结构维度" value={mode} onChange={(event) => setMode(event.target.value as StructureMode)}>
          <option value="primary">主要维度</option><option value="extended">扩展维度</option><option value="attributes">卡片属性</option>
        </select>
        <div className={styles.currencySwitch} role="group" aria-label="收藏结构币种">
          {(currencies.length ? currencies : ["CNY"]).map((item) => <button key={item} type="button" className={currency === item ? styles.active : undefined} onClick={() => setCurrency(item)}>{item}</button>)}
        </div>
      </div>
    </header>
    <div className={styles.allocationGrid}>
      {mode === "primary" ? <>
        <AllocationCard title="卡片主体" items={snapshot.allocation.byPlayer} concentration={snapshot.concentration.player} currency={currency} filterField="q" />
        <AllocationCard title="运动" items={snapshot.allocation.bySport} concentration={snapshot.concentration.sport} currency={currency} filterField="sport" />
        <AllocationCard title="品牌" items={snapshot.allocation.byBrand} concentration={snapshot.concentration.brand} currency={currency} filterField="brand" />
      </> : null}
      {mode === "extended" ? <>
        <AllocationCard title="Team" items={snapshot.allocation.byTeam} concentration={snapshot.concentration.team} currency={currency} filterField="team" />
        <AllocationCard title="年份" items={snapshot.allocation.byYear} concentration={deriveConcentration(snapshot.allocation.byYear)} currency={currency} filterField="year" />
        <AllocationCard title="产品线" items={snapshot.allocation.byProductLine} concentration={snapshot.concentration.productLine} currency={currency} filterField="productLine" />
        <AllocationCard title="评级机构" items={snapshot.allocation.byGradingCompany} concentration={deriveConcentration(snapshot.allocation.byGradingCompany)} currency={currency} filterField="gradingCompany" />
      </> : null}
      {mode === "attributes" ? <AttributeCard snapshot={snapshot} /> : null}
    </div>
  </section>;
}
