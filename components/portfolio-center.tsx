"use client";

import Link from "next/link";
import type { DragEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  PortfolioAllocationBreakdown,
  PortfolioConcentrationDimension,
  PortfolioFilterField,
  PortfolioSnapshot,
  PortfolioTimeSeriesPoint
} from "@/lib/portfolio-analysis";
import { portfolioQualityMetrics, type PortfolioQualityCard } from "@/lib/portfolio-quality";
import type {
  PortfolioComparison,
  PortfolioCostPosition,
  PortfolioFinancialHistoryPoint,
  PortfolioSoldReview,
  PortfolioValuationChange
} from "@/lib/portfolio-insights";
import {
  defaultPortfolioLayout,
  movePortfolioSection,
  normalizePortfolioLayout,
  reorderPortfolioSections,
  type PortfolioFullSectionId,
  type PortfolioHalfSectionId,
  type PortfolioLayout
} from "@/lib/portfolio-layout";
import { portfolioTrendLabelIndexes, portfolioTrendMonths, type PortfolioTrendRange } from "@/lib/portfolio-trend";
import { formatPercentage } from "@/lib/percentage-format";
import {
  formatPortfolioCountPercent as countPercent,
  formatPortfolioDate as shortDate,
  formatPortfolioDateTime as compactDateTime,
  formatPortfolioMoney as money,
  formatSignedPortfolioMoney as signedMoney
} from "@/lib/portfolio-presentation";
import styles from "./portfolio-center.module.css";

type PortfolioCenterProps = {
  snapshot: PortfolioSnapshot;
  qualityCards: PortfolioQualityCard[];
  valuationChanges: PortfolioValuationChange[];
  financialHistory: PortfolioFinancialHistoryPoint[];
  highCostPositions: PortfolioCostPosition[];
  soldReviews: PortfolioSoldReview[];
  returnTo: string;
  asOfMonth: string;
};

type TrendKind = "purchases" | "grading" | "sales";
type StructureMode = "primary" | "extended" | "attributes";

const trendMeta: Record<TrendKind, { label: string; color: string }> = {
  purchases: { label: "买入", color: "#277f7f" },
  grading: { label: "评级", color: "#8a63d2" },
  sales: { label: "出售", color: "#d9531e" }
};

const financialTrendMeta = {
  portfolioValue: { label: "组合估值", color: "#2563a6" },
  remainingCost: { label: "剩余成本", color: "#c2872d" },
  realizedProfit: { label: "已实现盈亏", color: "#d9531e" },
  unrealizedProfit: { label: "未实现盈亏", color: "#8a63d2" }
} as const;

const portfolioLayoutStorageKey = "card-vault:portfolio-layout:v1";

type SortablePortfolioItemProps = {
  id: PortfolioFullSectionId | PortfolioHalfSectionId;
  activeId: string | null;
  axis: "vertical" | "grid";
  order: number;
  children: ReactNode;
  onDragStart: (id: PortfolioFullSectionId | PortfolioHalfSectionId) => void;
  onDragEnd: () => void;
  onDrop: (id: PortfolioFullSectionId | PortfolioHalfSectionId, after: boolean) => void;
  onMove: (id: PortfolioFullSectionId | PortfolioHalfSectionId, direction: -1 | 1) => void;
};

function SortablePortfolioItem({ id, activeId, axis, order, children, onDragStart, onDragEnd, onDrop, onMove }: SortablePortfolioItemProps) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const after = axis === "vertical"
      ? event.clientY > bounds.top + bounds.height / 2
      : event.clientY > bounds.top + bounds.height * 0.7
        || (event.clientY >= bounds.top + bounds.height * 0.3 && event.clientX > bounds.left + bounds.width / 2);
    onDrop(id, after);
  }

  return (
    <div
      className={`${styles.sortableItem}${activeId === id ? ` ${styles.sortableItemDragging}` : ""}`}
      style={{ order }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
    >
      <button
        type="button"
        className={styles.portfolioDragHandle}
        draggable
        aria-label="拖拽调整栏目顺序"
        title="拖拽调整栏目顺序"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/portfolio-section", id);
          onDragStart(id);
        }}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            onMove(id, -1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            onMove(id, 1);
          }
        }}
      >⠿</button>
      {children}
    </div>
  );
}

function trendValues(points: PortfolioTimeSeriesPoint[], months: string[], currency: string): number[] {
  const byMonth = new Map(points.map((point) => [point.month, point.values[currency] ?? 0]));
  return months.map((month) => byMonth.get(month) ?? 0);
}

function polyline(values: number[], minimum: number, maximum: number, left: number, width: number): string {
  const height = 190;
  const valueRange = maximum - minimum || 1;
  return values.map((value, index) => {
    const x = left + (values.length > 1 ? index / (values.length - 1) * width : width / 2);
    const y = height - (value - minimum) / valueRange * (height - 22) - 11;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function compactAmount(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

type ChartSeries = { key: string; label: string; color: string; values: number[] };

function LineChart({ months, series, currency, ariaLabel, emptyLabel }: {
  months: string[];
  series: ChartSeries[];
  currency: string;
  ariaLabel: string;
  emptyLabel: string;
}) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const maximum = Math.max(0, ...series.flatMap((item) => item.values));
  const minimum = Math.min(0, ...series.flatMap((item) => item.values));
  const valueRange = maximum - minimum || 1;
  const chartWidth = months.length <= 12 ? 720 : months.length * 62;
  const horizontallyScrollable = months.length > 12;
  const left = 72;
  const right = 48;
  const plotWidth = chartWidth - left - right;
  const plotHeight = 190;
  const xAt = (index: number) => left + (months.length > 1 ? index / (months.length - 1) * plotWidth : plotWidth / 2);
  const yAt = (value: number) => plotHeight - (value - minimum) / valueRange * (plotHeight - 22) - 11;
  const hoveredIndex = hoveredMonth ? months.indexOf(hoveredMonth) : -1;
  const monthLabelIndexes = new Set(portfolioTrendLabelIndexes(months.length, plotWidth));

  if (months.length === 0 || (maximum === 0 && minimum === 0)) {
    return <div className={styles.chartEmpty}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.chartWrap}>
      <div className={styles.legend}>
        {series.map((item) => (
          <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
        ))}
      </div>
      <div className={`${styles.chartTooltip}${hoveredIndex < 0 ? ` ${styles.chartTooltipIdle}` : ""}`} role="status">
        {hoveredIndex >= 0 ? <>
          <strong>{hoveredMonth}</strong>
          {series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label} {money(item.values[hoveredIndex], currency)}</span>)}
        </> : null}
      </div>
      <div className={styles.chartScroller} data-horizontal-scroll={horizontallyScrollable ? "enabled" : "disabled"} onMouseLeave={() => setHoveredMonth(null)}>
        <svg className={styles.chart} viewBox={`0 0 ${chartWidth} 246`} style={{ minWidth: horizontallyScrollable ? chartWidth : "100%" }} role="img" aria-label={ariaLabel}>
          {[0, 1, 2, 3, 4].map((line) => {
            const value = maximum - valueRange * line / 4;
            const y = 11 + line * ((plotHeight - 22) / 4);
            return <g key={line}><line x1={left} x2={chartWidth - right} y1={y} y2={y} /><text x={left - 10} y={y + 4} textAnchor="end">{compactAmount(value)}</text></g>;
          })}
          {series.map((item) => (
            <polyline key={item.key} points={polyline(item.values, minimum, maximum, left, plotWidth)} stroke={item.color} />
          ))}
          {hoveredIndex >= 0 ? <line className={styles.hoverLine} x1={xAt(hoveredIndex)} x2={xAt(hoveredIndex)} y1="11" y2={plotHeight - 11} /> : null}
          {series.map((item) => item.values.map((value, index) => (
            <circle key={`${item.key}-${months[index]}`} className={styles.dataPoint} cx={xAt(index)} cy={yAt(value)} r={hoveredIndex === index ? 4.5 : 3} fill={item.color} />
          )))}
          {months.map((month, index) => (
            <g key={month}>
              <rect className={styles.hoverTarget} x={xAt(index) - 24} y="0" width="48" height={plotHeight} tabIndex={0} role="button" aria-label={`${month} 月度数据`} onMouseEnter={() => setHoveredMonth(month)} onFocus={() => setHoveredMonth(month)} />
              {monthLabelIndexes.has(index) ? <text x={xAt(index)} y="225" textAnchor="middle">{month}</text> : null}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function TrendChart({ snapshot, currency, range, asOfMonth }: { snapshot: PortfolioSnapshot; currency: string; range: PortfolioTrendRange; asOfMonth: string }) {
  const months = useMemo(() => portfolioTrendMonths(snapshot.activitySeries, range, asOfMonth), [asOfMonth, range, snapshot.activitySeries]);
  const series = (Object.keys(trendMeta) as TrendKind[]).map((kind) => ({
    key: kind,
    label: trendMeta[kind].label,
    color: trendMeta[kind].color,
    values: trendValues(snapshot.activitySeries[kind], months, currency)
  }));
  return <LineChart months={months} series={series} currency={currency} ariaLabel={`${currency} 月度活动趋势`} emptyLabel={`暂无 ${currency} 月度财务记录。`} />;
}

function FinancialHistoryChart({ points, currency, range }: {
  points: PortfolioFinancialHistoryPoint[];
  currency: string;
  range: PortfolioTrendRange;
}) {
  const visiblePoints = range === "all" ? points : points.slice(-range);
  const months = visiblePoints.map((point) => point.month);
  const series = Object.entries(financialTrendMeta).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    values: visiblePoints.map((point) => {
      const item = point.currencies.find((entry) => entry.currency === currency);
      return item?.[key as keyof typeof financialTrendMeta] ?? 0;
    })
  }));
  return <LineChart months={months} series={series} currency={currency} ariaLabel={`${currency} 组合财务历史趋势`} emptyLabel={`暂无 ${currency} 可重建的财务历史。`} />;
}

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
    hhiByCurrency: Object.fromEntries([...currencies].map((currency) => [
      currency,
      items.reduce((sum, item) => sum + Math.pow(item.valueShare[currency] ?? 0, 2), 0)
    ]))
  };
}

function AllocationCard({
  title,
  items,
  concentration,
  currency,
  filterField
}: {
  title: string;
  items: PortfolioAllocationBreakdown[];
  concentration: PortfolioConcentrationDimension;
  currency: string;
  filterField: PortfolioFilterField;
}) {
  const hasValues = items.some((item) => (item.valueShare[currency] ?? 0) > 0);
  const topItems = [...items]
    .sort((left, right) => hasValues
      ? (right.valueShare[currency] ?? 0) - (left.valueShare[currency] ?? 0)
      : right.countShare - left.countShare)
    .slice(0, 5);
  const hhi = concentration.hhiByCurrency[currency] ?? 0;

  return (
    <article className={styles.allocationCard}>
      <header>
        <div><span>结构分布</span><h3>{title}</h3></div>
      </header>
      <div className={styles.allocationBars}>
        {topItems.map((item) => {
          const share = hasValues ? item.valueShare[currency] ?? 0 : item.countShare;
          return (
            <div key={item.name} className={styles.allocationRow}>
              <div>
                {item.name === "未填写" ? <span>{item.name}</span> : <Link href={`/?${filterField}=${encodeURIComponent(item.name)}`}>{item.name}</Link>}
                <strong>{formatPercentage(share, { fractionDigits: 1 })}</strong>
              </div>
              <i><b style={{ width: `${Math.min(100, share)}%` }} /></i>
            </div>
          );
        })}
        {topItems.length === 0 ? <p className={styles.emptyText}>暂无分布数据。</p> : null}
      </div>
      <footer>
        <span>Top 1 <strong>{formatPercentage(hasValues ? concentration.top1ValueShare[currency] ?? 0 : concentration.top1CountShare)}</strong></span>
        <span>Top 3 <strong>{formatPercentage(hasValues ? concentration.top3ValueShare[currency] ?? 0 : concentration.top3CountShare)}</strong></span>
        <span>集中度 <strong>{hhi > 0 ? concentrationLevel(hhi) : "—"}</strong></span>
      </footer>
    </article>
  );
}


function AttributeCard({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const items = [
    { label: "新秀卡", count: snapshot.quality.rookieCount, field: "isRookie" },
    { label: "签名卡", count: snapshot.quality.autographCount, field: "isAutograph" },
    { label: "Patch", count: snapshot.quality.patchCount, field: "isPatch" },
    { label: "限量卡", count: snapshot.quality.serialNumberedCount, field: "isSerialNumbered" }
  ] as const;
  return (
    <article className={styles.allocationCard}>
      <header><div><span>结构分布</span><h3>卡片属性</h3></div></header>
      <div className={styles.attributeList}>
        {items.map((item) => {
          const share = snapshot.activeCount > 0 ? item.count / snapshot.activeCount * 100 : 0;
          return <Link href={`/?${item.field}=true`} key={item.field}><span>{item.label}</span><strong>{item.count} 张</strong><small>{formatPercentage(share, { fractionDigits: 1 })}</small></Link>;
        })}
      </div>
    </article>
  );
}

function ValuationSources({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const total = snapshot.financials.valuationSources.reduce((sum, item) => sum + item.count, 0);
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span>VALUATION SOURCES</span><h2>估值来源</h2></div>
      </header>
      <div className={styles.sourceList}>
        {snapshot.financials.valuationSources.map((item) => {
          const share = total > 0 ? item.count / total * 100 : 0;
          return <div key={item.name}><div><span>{item.name}</span><strong>{item.count} 张 · {formatPercentage(share, { fractionDigits: 1 })}</strong></div><i><b style={{ width: `${share}%` }} /></i></div>;
        })}
        {total === 0 ? <p className={styles.emptyText}>暂无估值来源数据。</p> : null}
      </div>
    </section>
  );
}

function EmptyPortfolio({ returnTo }: { returnTo: string }) {
  return (
    <section className={`${styles.emptyPortfolio} panel`}>
      <span>PORTFOLIO</span>
      <h2>还没有可汇总的收藏</h2>
      <p>录入第一张卡片后，这里会自动生成财务摘要、结构分布和数据质量清单。</p>
      <Link className="btn btn-primary" href={`/cards/new?returnTo=${encodeURIComponent(returnTo)}`}>新增卡片</Link>
    </section>
  );
}

function ValuationChanges({ changes }: { changes: PortfolioValuationChange[] }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span>VALUATION CHANGE</span><h2>估值变化</h2></div>
      </header>
      <div className={styles.valuationChangeGrid}>
        {changes.map((change) => (
          <article key={change.days}>
            <header><strong>{change.days} 天</strong><span>基准 {shortDate(change.baselineAt)}</span></header>
            {change.currencies.length > 0 ? change.currencies.map((item) => (
              <div key={item.currency}>
                <span>{item.currency}</span>
                <strong className={item.changeAmount >= 0 ? styles.positive : styles.negative}>{signedMoney(item.changeAmount, item.currency)}</strong>
                <small>
                  {item.baselineValue > 0 ? `${money(item.baselineValue, item.currency)} → ` : "基准暂无 → "}
                  {money(item.currentValue, item.currency)}
                  {item.changeRate === null ? "" : ` · ${formatPercentage(item.changeRate, { fractionDigits: 2, signed: true })}`}
                </small>
              </div>
            )) : <p className={styles.emptyText}>暂无可比较估值。</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function PortfolioComparisonPanel({ comparison }: { comparison: PortfolioComparison }) {
  const currencies = [...new Set([
    ...comparison.left.currencies.map((item) => item.currency),
    ...comparison.right.currencies.map((item) => item.currency)
  ])].sort();
  const [structureCurrency, setStructureCurrency] = useState(currencies.includes("CNY") ? "CNY" : currencies[0] ?? "CNY");
  const structures = [...new Set([
    ...comparison.left.structures.map((item) => item.key),
    ...comparison.right.structures.map((item) => item.key)
  ])].map((key) => {
    const left = comparison.left.structures.find((item) => item.key === key);
    const right = comparison.right.structures.find((item) => item.key === key);
    const names = new Set([...(left?.items ?? []), ...(right?.items ?? [])].map((item) => item.name));
    const rows = [...names].map((name) => {
      const leftItem = left?.items.find((item) => item.name === name);
      const rightItem = right?.items.find((item) => item.name === name);
      const leftCount = leftItem?.countShare ?? 0;
      const rightCount = rightItem?.countShare ?? 0;
      const leftValue = leftItem?.valueShare[structureCurrency] ?? 0;
      const rightValue = rightItem?.valueShare[structureCurrency] ?? 0;
      return { name, leftCount, rightCount, countChange: rightCount - leftCount, leftValue, rightValue, valueChange: rightValue - leftValue };
    }).sort((leftRow, rightRow) =>
      Math.max(Math.abs(rightRow.valueChange), Math.abs(rightRow.countChange))
      - Math.max(Math.abs(leftRow.valueChange), Math.abs(leftRow.countChange))
    ).slice(0, 5);
    return { key, label: left?.label ?? right?.label ?? key, rows };
  }).filter((item) => item.rows.length > 0);
  const countRows = [
    ["全部卡片", comparison.left.cardCount, comparison.right.cardCount],
    ["当前持有", comparison.left.activeCount, comparison.right.activeCount],
    ["已售", comparison.left.soldCount, comparison.right.soldCount],
    ["目标卡", comparison.left.targetCount, comparison.right.targetCount],
    ["卡片主体", comparison.left.playerCount, comparison.right.playerCount]
  ] as const;
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span>COMPARISON</span><h2>组合比较</h2></div>
      </header>
      <div className={styles.comparisonSources}>
        <div><span>基准</span><strong>{comparison.left.label}</strong><small>{compactDateTime(comparison.left.capturedAt)}</small></div>
        <div><span>对象</span><strong>{comparison.right.label}</strong><small>{compactDateTime(comparison.right.capturedAt)}</small></div>
      </div>
      <div className={styles.comparisonCounts}>
        {countRows.map(([label, left, right]) => <div key={label}><span>{label}</span><strong>{left} → {right}</strong><small>{right - left >= 0 ? "+" : ""}{right - left}</small></div>)}
      </div>
      <div className={styles.comparisonCurrencyGrid}>
        {currencies.map((currency) => {
          const left = comparison.left.currencies.find((item) => item.currency === currency);
          const right = comparison.right.currencies.find((item) => item.currency === currency);
          const rows = [
            ["组合估值", left?.latestValue ?? 0, right?.latestValue ?? 0],
            ["剩余成本", left?.activeCostBasis ?? 0, right?.activeCostBasis ?? 0],
            ["已实现盈亏", left?.realizedProfit ?? 0, right?.realizedProfit ?? 0],
            ["总盈亏", left?.totalProfit ?? 0, right?.totalProfit ?? 0]
          ] as const;
          return <article key={currency}><h3>{currency}</h3>{rows.map(([label, leftValue, rightValue]) => {
            const difference = rightValue - leftValue;
            return <div key={label}><span>{label}</span><strong>{money(leftValue, currency)} → {money(rightValue, currency)}</strong><small className={difference >= 0 ? styles.positive : styles.negative}>{signedMoney(difference, currency)}</small></div>;
          })}</article>;
        })}
      </div>
      {structures.length > 0 ? <div className={styles.structureComparison}>
        <header>
          <div><span>STRUCTURE CHANGE</span><h3>结构变化</h3></div>
          {currencies.length > 0 ? <div className={styles.currencySwitch} role="group" aria-label="结构比较币种">
            {currencies.map((currency) => <button key={currency} type="button" className={structureCurrency === currency ? styles.active : undefined} onClick={() => setStructureCurrency(currency)}>{currency}</button>)}
          </div> : null}
        </header>
        <div className={styles.structureComparisonGrid}>
          {structures.map((structure) => <article key={structure.key}>
            <h4>{structure.label}</h4>
            {structure.rows.map((row) => {
              const hasValue = row.leftValue !== 0 || row.rightValue !== 0;
              const change = hasValue ? row.valueChange : row.countChange;
              return <div key={row.name}>
                <span>{row.name}</span>
                <strong>{formatPercentage(hasValue ? row.leftValue : row.leftCount, { fractionDigits: 1 })} → {formatPercentage(hasValue ? row.rightValue : row.rightCount, { fractionDigits: 1 })}</strong>
                <small className={change >= 0 ? styles.positive : styles.negative}>{formatPercentage(change, { fractionDigits: 1, signed: true })}</small>
              </div>;
            })}
          </article>)}
        </div>
      </div> : null}
    </section>
  );
}

export function PortfolioCenter({ snapshot, qualityCards, valuationChanges, financialHistory, highCostPositions, soldReviews, returnTo, asOfMonth }: PortfolioCenterProps) {
  const [trendRange, setTrendRange] = useState<PortfolioTrendRange>(12);
  const [financialRange, setFinancialRange] = useState<PortfolioTrendRange>(12);
  const [structureMode, setStructureMode] = useState<StructureMode>("primary");
  const availableCurrencies = snapshot.financials.currencies.map((item) => item.currency);
  const [allocationCurrency, setAllocationCurrency] = useState(availableCurrencies.includes("CNY") ? "CNY" : availableCurrencies[0] ?? "CNY");
  const [layout, setLayout] = useState<PortfolioLayout>(defaultPortfolioLayout);
  const [draggedFullSection, setDraggedFullSection] = useState<PortfolioFullSectionId | null>(null);
  const [draggedHalfSection, setDraggedHalfSection] = useState<PortfolioHalfSectionId | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(portfolioLayoutStorageKey);
      if (stored) setLayout(normalizePortfolioLayout(JSON.parse(stored)));
    } catch {
      // 无效或不可用的本地布局不应影响组合页面使用。
    }
  }, []);

  function updateLayout(updater: (current: PortfolioLayout) => PortfolioLayout) {
    setLayout((current) => {
      const next = updater(current);
      try {
        window.localStorage.setItem(portfolioLayoutStorageKey, JSON.stringify(next));
      } catch {
        // 浏览器禁用本地存储时，排序仍在当前会话内生效。
      }
      return next;
    });
  }

  function dropFullSection(targetId: PortfolioFullSectionId | PortfolioHalfSectionId, after: boolean) {
    if (!draggedFullSection) return;
    updateLayout((current) => {
      const target = targetId as PortfolioFullSectionId;
      return current.full.includes(target) ? {
        ...current,
        full: reorderPortfolioSections(current.full, draggedFullSection, target, after ? "after" : "before")
      } : current;
    });
    setDraggedFullSection(null);
  }

  function dropHalfSection(targetId: PortfolioFullSectionId | PortfolioHalfSectionId, after: boolean) {
    if (!draggedHalfSection) return;
    updateLayout((current) => {
      const target = targetId as PortfolioHalfSectionId;
      return current.half.includes(target) ? {
        ...current,
        half: reorderPortfolioSections(current.half, draggedHalfSection, target, after ? "after" : "before")
      } : current;
    });
    setDraggedHalfSection(null);
  }

  function moveFullSection(id: PortfolioFullSectionId | PortfolioHalfSectionId, direction: -1 | 1) {
    updateLayout((current) => ({
      ...current,
      full: movePortfolioSection(current.full, id as PortfolioFullSectionId, direction)
    }));
  }

  function moveHalfSection(id: PortfolioFullSectionId | PortfolioHalfSectionId, direction: -1 | 1) {
    updateLayout((current) => ({
      ...current,
      half: movePortfolioSection(current.half, id as PortfolioHalfSectionId, direction)
    }));
  }

  if (snapshot.cardCount === 0) {
    return <EmptyPortfolio returnTo={returnTo} />;
  }

  const currencies = snapshot.financials.currencies;
  const issueCounts = new Map(snapshot.attentionItems.map((item) => [item.type, item.count]));

  return (
    <>
      <section className={styles.overviewGrid} aria-label="组合概览">
        <article><span>全部卡片</span><strong>{snapshot.cardCount}</strong><small>{snapshot.playerCount} 个卡片主体</small></article>
        <article><span>当前持有</span><strong>{snapshot.activeCount}</strong><small>已售 {snapshot.soldCount} · 目标 {snapshot.targetCount}</small></article>
        <article><span>估值覆盖</span><strong>{countPercent(snapshot.financials.valuationCoverageCount, snapshot.cardCount)}</strong><small>{snapshot.financials.valuationCoverageCount}/{snapshot.cardCount} 张</small></article>
        <article><span>最新估值</span><strong className={styles.dateValue}>{shortDate(snapshot.financials.latestValuationAt)}</strong><small>90 天内 {snapshot.financials.freshValuationCount} 张</small></article>
      </section>

      <div className={styles.sortableFullLayout}>
      <SortablePortfolioItem
        id="financial-position"
        order={layout.full.indexOf("financial-position")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div><span>FINANCIAL POSITION</span><h2>持仓财务</h2></div>
        </header>
        <div className={styles.currencyGrid}>
          {currencies.map((item) => (
            <article key={item.currency} className={styles.currencyCard}>
              <header><strong>{item.currency}</strong><span>{item.activeValuedCardCount} 张持仓有估值</span></header>
              <div className={styles.primaryValue}><span>持仓估值</span><strong>{money(item.activeLatestValue, item.currency)}</strong></div>
              <dl>
                <div><dt>剩余成本</dt><dd>{money(item.activeCostBasis, item.currency)}</dd></div>
                <div><dt>已实现盈亏</dt><dd className={item.realizedProfit >= 0 ? styles.positive : styles.negative}>{signedMoney(item.realizedProfit, item.currency)}</dd></div>
                <div><dt>未实现盈亏</dt><dd className={item.unrealizedDifference >= 0 ? styles.positive : styles.negative}>{signedMoney(item.unrealizedDifference, item.currency)}</dd></div>
                <div><dt>总盈亏</dt><dd className={item.totalProfit >= 0 ? styles.positive : styles.negative}>{signedMoney(item.totalProfit, item.currency)}</dd></div>
                <div><dt>未实现回报率</dt><dd className={(item.unrealizedReturnRate ?? 0) >= 0 ? styles.positive : styles.negative}>{formatPercentage(item.unrealizedReturnRate, { fractionDigits: 2, signed: true })}</dd></div>
              </dl>
            </article>
          ))}
          {currencies.length === 0 ? <div className={styles.chartEmpty}>暂无财务记录。</div> : null}
        </div>
      </section>
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="financial-history"
        order={layout.full.indexOf("financial-history")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div><span>FINANCIAL HISTORY</span><h2>财务历史趋势</h2></div>
          <select className={styles.rangeSelect} aria-label="财务历史趋势时间范围" value={financialRange} onChange={(event) => setFinancialRange(event.target.value === "all" ? "all" : Number(event.target.value) as 12 | 24)}>
            <option value={12}>近12个月</option>
            <option value={24}>近24个月</option>
            <option value="all">所有</option>
          </select>
        </header>
        <div className={styles.trendGrid}>
          {(currencies.length ? currencies : [{ currency: "CNY" }]).map((item) => (
            <article key={item.currency} className={styles.chartCard}>
              <h3>{item.currency}</h3>
              <FinancialHistoryChart points={financialHistory} currency={item.currency} range={financialRange} />
            </article>
          ))}
        </div>
      </section>
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="valuation-change"
        order={layout.full.indexOf("valuation-change")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
        <ValuationChanges changes={valuationChanges} />
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="valuation-sources"
        order={layout.full.indexOf("valuation-sources")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
        <ValuationSources snapshot={snapshot} />
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="activity-trend"
        order={layout.full.indexOf("activity-trend")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div><span>ACTIVITY TREND</span><h2>活动趋势</h2></div>
          <select className={styles.rangeSelect} aria-label="活动趋势时间范围" value={trendRange} onChange={(event) => setTrendRange(event.target.value === "all" ? "all" : Number(event.target.value) as 12 | 24)}>
            <option value={12}>近12个月</option>
            <option value={24}>近24个月</option>
            <option value="all">所有</option>
          </select>
        </header>
        <div className={styles.trendGrid}>
          {(currencies.length ? currencies : [{ currency: "CNY" }]).map((item) => (
            <article key={item.currency} className={styles.chartCard}>
              <h3>{item.currency}</h3>
              <TrendChart snapshot={snapshot} currency={item.currency} range={trendRange} asOfMonth={asOfMonth} />
            </article>
          ))}
        </div>
      </section>
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="collection-structure"
        order={layout.full.indexOf("collection-structure")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div><span>CONCENTRATION</span><h2>收藏结构</h2></div>
          <div className={styles.structureControls}>
            <select className={styles.rangeSelect} aria-label="收藏结构维度" value={structureMode} onChange={(event) => setStructureMode(event.target.value as StructureMode)}>
              <option value="primary">主要维度</option>
              <option value="extended">扩展维度</option>
              <option value="attributes">卡片属性</option>
            </select>
            <div className={styles.currencySwitch} role="group" aria-label="收藏结构币种">
              {(availableCurrencies.length ? availableCurrencies : ["CNY"]).map((currency) => (
                <button key={currency} type="button" className={allocationCurrency === currency ? styles.active : undefined} onClick={() => setAllocationCurrency(currency)}>{currency}</button>
              ))}
            </div>
          </div>
        </header>
        <div className={styles.allocationGrid}>
          {structureMode === "primary" ? <>
            <AllocationCard title="卡片主体" items={snapshot.allocation.byPlayer} concentration={snapshot.concentration.player} currency={allocationCurrency} filterField="q" />
            <AllocationCard title="运动" items={snapshot.allocation.bySport} concentration={snapshot.concentration.sport} currency={allocationCurrency} filterField="sport" />
            <AllocationCard title="品牌" items={snapshot.allocation.byBrand} concentration={snapshot.concentration.brand} currency={allocationCurrency} filterField="brand" />
          </> : null}
          {structureMode === "extended" ? <>
            <AllocationCard title="Team" items={snapshot.allocation.byTeam} concentration={snapshot.concentration.team} currency={allocationCurrency} filterField="team" />
            <AllocationCard title="年份" items={snapshot.allocation.byYear} concentration={deriveConcentration(snapshot.allocation.byYear)} currency={allocationCurrency} filterField="year" />
            <AllocationCard title="产品线" items={snapshot.allocation.byProductLine} concentration={snapshot.concentration.productLine} currency={allocationCurrency} filterField="productLine" />
            <AllocationCard title="评级机构" items={snapshot.allocation.byGradingCompany} concentration={deriveConcentration(snapshot.allocation.byGradingCompany)} currency={allocationCurrency} filterField="gradingCompany" />
          </> : null}
          {structureMode === "attributes" ? <AttributeCard snapshot={snapshot} /> : null}
        </div>
      </section>
      </SortablePortfolioItem>
      </div>

      <div className={styles.sortableHalfGrid}>
        <SortablePortfolioItem
          id="high-value"
          order={layout.half.indexOf("high-value")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><span>TOP POSITIONS</span><h2>高价值持仓</h2></div>
          </header>
          <div className={styles.positionList}>
            {snapshot.topPositions.filter((item) => item.latestValue > 0).slice(0, 8).map((item, index) => (
              <Link href={`/?q=${encodeURIComponent(item.cardTitle || item.playerName)}&sort=valueCnyDesc`} key={`${item.playerName}-${item.cardTitle}-${item.currency}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.playerName}</strong><small>{item.cardTitle || [item.year, item.brand, item.productLine].filter(Boolean).join(" · ")}</small></div>
                <div><strong>{money(item.latestValue, item.currency)}</strong><small>{item.valuationAgeDays > 180 ? "估值待更新" : `${item.valuationAgeDays} 天前估值`}</small></div>
              </Link>
            ))}
            {snapshot.topPositions.every((item) => item.latestValue <= 0) ? <p className={styles.emptyText}>暂无已估值持仓。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>

        <SortablePortfolioItem
          id="data-quality"
          order={layout.half.indexOf("data-quality")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><span>DATA QUALITY</span><h2>数据待完善</h2></div>
          </header>
          <div className={styles.qualitySummary}>
            {portfolioQualityMetrics.map((metric) => (
              <button
                type="button"
                className={styles.qualityMetric}
                key={metric.type}
                aria-label={`${metric.label}：${metric.definition}`}
              >
                <strong>{issueCounts.get(metric.type) ?? 0}</strong>
                {metric.label}
                <small className={styles.qualityDefinition} role="tooltip">{metric.definition}</small>
              </button>
            ))}
          </div>
          <div className={styles.qualityList}>
            {qualityCards.slice(0, 8).map((card) => (
              <Link key={card.id} href={`/cards/${card.id}?returnTo=${encodeURIComponent(returnTo)}`}>
                <div><strong>{card.playerName}</strong><small>{card.cardTitle}</small></div>
                <span>{card.issues.join(" · ")}</span>
              </Link>
            ))}
            {qualityCards.length === 0 ? <p className={styles.qualityComplete}>当前卡片没有待处理的数据质量问题。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>

        <SortablePortfolioItem
          id="high-cost"
          order={layout.half.indexOf("high-cost")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><span>HIGH COST</span><h2>高成本持仓</h2></div>
          </header>
          <div className={styles.positionList}>
            {[...new Set(highCostPositions.map((item) => item.currency))].map((currency) => (
              <div className={styles.positionCurrencyGroup} key={currency}>
                <h3>{currency}</h3>
                {highCostPositions.filter((item) => item.currency === currency).slice(0, 8).map((item, index) => (
                  <Link href={`/cards/${item.cardId}?returnTo=${encodeURIComponent(returnTo)}`} key={`${item.cardId}-${item.currency}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{item.playerName}</strong><small>{item.cardTitle} · {item.quantity} 张</small></div>
                    <div><strong>{money(item.remainingCost, item.currency)}</strong><small>单张均价 {money(item.averageCost, item.currency)}</small></div>
                  </Link>
                ))}
              </div>
            ))}
            {highCostPositions.length === 0 ? <p className={styles.emptyText}>暂无可核算的持仓成本。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>

        <SortablePortfolioItem
          id="sold-review"
          order={layout.half.indexOf("sold-review")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><span>SOLD REVIEW</span><h2>已售卡片复盘</h2></div>
          </header>
          <div className={styles.positionList}>
            {[...new Set(soldReviews.map((item) => item.currency))].map((currency) => (
              <div className={styles.positionCurrencyGroup} key={currency}>
                <h3>{currency}</h3>
                {soldReviews.filter((item) => item.currency === currency).slice(0, 8).map((item) => (
                  <Link href={`/cards/${item.cardId}?returnTo=${encodeURIComponent(returnTo)}`} key={`${item.cardId}-${item.currency}`}>
                    <span>{item.soldAt ? shortDate(item.soldAt) : "待补"}</span>
                    <div><strong>{item.playerName}</strong><small>{item.cardTitle} · {item.soldQuantity} 张</small></div>
                    <div>
                      <strong className={item.realizedProfit >= 0 ? styles.positive : styles.negative}>{item.needsSaleRecord ? "缺少出售记录" : signedMoney(item.realizedProfit, item.currency)}</strong>
                      <small>回报率 {formatPercentage(item.realizedReturnRate, { fractionDigits: 2, signed: true })}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
            {soldReviews.length === 0 ? <p className={styles.emptyText}>暂无已售卡片。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>
      </div>
    </>
  );
}
