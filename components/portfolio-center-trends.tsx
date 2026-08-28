"use client";

import { useMemo, useState } from "react";
import type { PortfolioSnapshot, PortfolioTimeSeriesPoint } from "@/lib/portfolio-analysis";
import type { PortfolioFinancialHistoryPoint } from "@/lib/portfolio-insights";
import { formatPortfolioMoney as money } from "@/lib/portfolio-presentation";
import { portfolioTrendLabelIndexes, portfolioTrendMonths, type PortfolioTrendRange } from "@/lib/portfolio-trend";
import styles from "./portfolio-center.module.css";

type TrendKind = "purchases" | "grading" | "sales";
type ChartSeries = { key: string; label: string; color: string; values: number[] };

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
        {series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
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
          {series.map((item) => <polyline key={item.key} points={polyline(item.values, minimum, maximum, left, plotWidth)} stroke={item.color} />)}
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

function FinancialHistoryChart({ points, currency, range }: { points: PortfolioFinancialHistoryPoint[]; currency: string; range: PortfolioTrendRange }) {
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

export function PortfolioFinancialHistorySection({ points, currencies }: { points: PortfolioFinancialHistoryPoint[]; currencies: string[] }) {
  const [range, setRange] = useState<PortfolioTrendRange>(12);
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <div><h2>财务历史趋势</h2></div>
      <select className={styles.rangeSelect} aria-label="财务历史趋势时间范围" value={range} onChange={(event) => setRange(event.target.value === "all" ? "all" : Number(event.target.value) as 12 | 24)}>
        <option value={12}>近12个月</option><option value={24}>近24个月</option><option value="all">所有</option>
      </select>
    </header>
    <div className={styles.trendGrid}>
      {(currencies.length ? currencies : ["CNY"]).map((currency) => <article key={currency} className={styles.chartCard}><h3>{currency}</h3><FinancialHistoryChart points={points} currency={currency} range={range} /></article>)}
    </div>
  </section>;
}

export function PortfolioActivityTrendSection({ snapshot, currencies, asOfMonth }: { snapshot: PortfolioSnapshot; currencies: string[]; asOfMonth: string }) {
  const [range, setRange] = useState<PortfolioTrendRange>(12);
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <div><h2>活动趋势</h2></div>
      <select className={styles.rangeSelect} aria-label="活动趋势时间范围" value={range} onChange={(event) => setRange(event.target.value === "all" ? "all" : Number(event.target.value) as 12 | 24)}>
        <option value={12}>近12个月</option><option value={24}>近24个月</option><option value="all">所有</option>
      </select>
    </header>
    <div className={styles.trendGrid}>
      {(currencies.length ? currencies : ["CNY"]).map((currency) => <article key={currency} className={styles.chartCard}><h3>{currency}</h3><TrendChart snapshot={snapshot} currency={currency} range={range} asOfMonth={asOfMonth} /></article>)}
    </div>
  </section>;
}
