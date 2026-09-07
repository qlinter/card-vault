"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PortfolioSnapshot, PortfolioTimeSeriesPoint } from "@/lib/portfolio-analysis";
import type { PortfolioFinancialHistoryPoint } from "@/lib/portfolio-insights";
import { formatPortfolioMoney as money } from "@/lib/portfolio-presentation";
import { portfolioTrendChartWidth, portfolioTrendLabelIndexes, portfolioTrendMonths, type PortfolioTrendRange } from "@/lib/portfolio-trend";
import { useLanguage } from "./language-provider";
import styles from "./portfolio-center.module.css";

type TrendKind = "purchases" | "sales";
type ChartSeries = { key: string; label: string; color: string; values: Array<number | null>; counts?: number[]; countUnit?: "cards" | "records" };

const trendMeta: Record<TrendKind, { label: string; color: string }> = {
  purchases: { label: "买入", color: "#277f7f" },
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

function compactAmount(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function LineChart({ months, series, currency, ariaLabel, emptyLabel, coverage }: {
  months: string[];
  series: ChartSeries[];
  currency: string;
  ariaLabel: string;
  emptyLabel: string;
  coverage?: Array<{ active: number; valued: number; costKnown: number } | undefined>;
}) {
  const { locale, t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(720);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(Math.max(1, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [months.length]);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const upperBound = Math.max(0, ...series.flatMap((item) => item.values.filter((value): value is number => value !== null)));
  const minimum = Math.min(0, ...series.flatMap((item) => item.values.filter((value): value is number => value !== null)));
  const maximum = upperBound === minimum ? upperBound + 1 : upperBound;
  const valueRange = maximum - minimum;
  const chartWidth = portfolioTrendChartWidth(months.length, availableWidth);
  const horizontallyScrollable = chartWidth > availableWidth;
  const left = 72;
  const right = 48;
  const plotWidth = chartWidth - left - right;
  const plotHeight = 224;
  const xAt = (index: number) => left + (months.length > 1 ? index / (months.length - 1) * plotWidth : plotWidth / 2);
  const yAt = (value: number) => plotHeight - (value - minimum) / valueRange * (plotHeight - 22) - 11;
  const hoveredIndex = hoveredMonth ? months.indexOf(hoveredMonth) : months.length - 1;
  const counts = coverage?.[hoveredIndex];
  const hitWidth = months.length > 1 ? plotWidth / (months.length - 1) : plotWidth;
  const monthLabelIndexes = new Set(portfolioTrendLabelIndexes(months.length, plotWidth));

  if (months.length === 0 || !series.some((item) => item.values.some((value) => value !== null))) {
    return <div className={styles.chartEmpty}><UiText text={emptyLabel} /></div>;
  }

  return (
    <div className={styles.chartWrap} ref={container}>
      <div className={styles.legend}>
        {series.map((item) => <span key={item.key}><i style={{ background: item.color }} /><UiText text={item.label} /></span>)}
      </div>
      <div className={`${styles.chartTooltip}${hoveredIndex < 0 ? ` ${styles.chartTooltipIdle}` : ""}`} role="status">
        {hoveredIndex >= 0 ? <>
          <strong>{months[hoveredIndex]}</strong>
          {series.map((item) => <span key={item.key}><i style={{ background: item.color }} /><UiText text={item.label} /> {money(item.values[hoveredIndex], currency)}{item.counts ? <span data-i18n-skip>{` · ${item.counts[hoveredIndex]} ${locale === "en" ? item.countUnit : item.countUnit === "cards" ? "张" : "笔"}`}</span> : null}</span>)}
          {counts ? <span data-i18n-skip>{locale === "en" ? `Valuation coverage ${counts.valued}/${counts.active} · Complete costs ${counts.costKnown}/${counts.active}` : `估值覆盖 ${counts.valued}/${counts.active} · 成本完整 ${counts.costKnown}/${counts.active}`}</span> : null}
        </> : null}
      </div>
      <div className={styles.chartScroller} data-horizontal-scroll={horizontallyScrollable ? "enabled" : "disabled"} onMouseLeave={() => setHoveredMonth(null)}>
        <svg className={styles.chart} viewBox={`0 0 ${chartWidth} 270`} style={{ width: chartWidth, height: 270 }} role="img" aria-label={t(ariaLabel)}>
          {[0, 1, 2, 3, 4].map((line) => {
            const value = maximum - valueRange * line / 4;
            const y = 11 + line * ((plotHeight - 22) / 4);
            return <g key={line}><line x1={left} x2={chartWidth - right} y1={y} y2={y} /><text x={left - 10} y={y + 4} textAnchor="end">{compactAmount(value)}</text></g>;
          })}
          {series.map((item) => <path key={item.key} d={item.values.map((value, index) => value === null ? "" : `${index === 0 || item.values[index - 1] === null ? "M" : "L"}${xAt(index)},${yAt(value)}`).join(" ")} fill="none" strokeWidth="2" stroke={item.color} />)}
          {hoveredIndex >= 0 ? <line className={styles.hoverLine} x1={xAt(hoveredIndex)} x2={xAt(hoveredIndex)} y1="11" y2={plotHeight - 11} /> : null}
          {series.map((item) => item.values.map((value, index) => value === null ? null : (
            <circle key={`${item.key}-${months[index]}`} className={styles.dataPoint} cx={xAt(index)} cy={yAt(value)} r={hoveredIndex === index ? 4.5 : 3} fill={item.color} />
          )))}
          {months.map((month, index) => (
            <g key={month}>
              <UiElement as="rect" uiMessages={{"aria-label": {text:"{0} 月度数据",values:[month],translateValues:[]}}} className={styles.hoverTarget} x={xAt(index) - hitWidth / 2} y="0" width={hitWidth} height={plotHeight} tabIndex={0} role="button"  onClick={() => setHoveredMonth(month)} onMouseEnter={() => setHoveredMonth(month)} onFocus={() => setHoveredMonth(month)} />
              {monthLabelIndexes.has(index) ? <text x={xAt(index)} y="258" textAnchor="middle">{month}</text> : null}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function TrendChart({ snapshot, currency, range, asOfMonth }: { snapshot: PortfolioSnapshot; currency: string; range: PortfolioTrendRange; asOfMonth: string }) {
  const months = useMemo(() => portfolioTrendMonths({ purchases: snapshot.activitySeries.purchases, sales: snapshot.activitySeries.sales }, range, asOfMonth), [asOfMonth, range, snapshot.activitySeries]);
  const series = (Object.keys(trendMeta) as TrendKind[]).map((kind) => ({
    key: kind,
    label: trendMeta[kind].label,
    color: trendMeta[kind].color,
    counts: months.map((month) => snapshot.activitySeries[kind].find((point) => point.month === month)?.count ?? 0),
    countUnit: "cards" as const,
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
      return item ? item[key as keyof typeof financialTrendMeta] : null;
    })
  }));
  return <LineChart months={months} series={series} currency={currency} coverage={visiblePoints.map((point) => point.coverage?.find((item) => item.currency === currency))} ariaLabel={`${currency} 组合财务历史趋势`} emptyLabel={`暂无 ${currency} 可重建的财务历史。`} />;
}

export function PortfolioFinancialHistorySection({ points, currencies }: { points: PortfolioFinancialHistoryPoint[]; currencies: string[] }) {
  const [range, setRange] = useState<PortfolioTrendRange>(12);
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <div><h2><UiText text={"财务历史趋势"} /></h2></div>
      <UiElement as="select" uiAttributes={["aria-label"]} className={styles.rangeSelect} aria-label="财务历史趋势时间范围" value={range} onChange={(event) => setRange(event.target.value === "all" ? "all" : Number(event.target.value) as 12 | 24)}>
        <option value={12}><UiText text={"近12个月"} /></option><option value={24}><UiText text={"近24个月"} /></option><option value="all"><UiText text={"所有"} /></option>
      </UiElement>
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
      <div><h2><UiText text={"活动趋势"} /></h2></div>
      <UiElement as="select" uiAttributes={["aria-label"]} className={styles.rangeSelect} aria-label="活动趋势时间范围" value={range} onChange={(event) => setRange(event.target.value === "all" ? "all" : Number(event.target.value) as 12 | 24)}>
        <option value={12}><UiText text={"近12个月"} /></option><option value={24}><UiText text={"近24个月"} /></option><option value="all"><UiText text={"所有"} /></option>
      </UiElement>
    </header>
    <div className={styles.trendGrid}>
      {(currencies.length ? currencies : ["CNY"]).map((currency) => <article key={currency} className={styles.chartCard}><h3>{currency}</h3><TrendChart snapshot={snapshot} currency={currency} range={range} asOfMonth={asOfMonth} /></article>)}
    </div>
  </section>;
}
