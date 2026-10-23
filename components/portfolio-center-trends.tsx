"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PortfolioSnapshot, PortfolioTimeSeriesPoint } from "@/lib/portfolio-analysis";
import type { PortfolioFinancialHistoryPoint } from "@/lib/portfolio-insights";
import { formatPortfolioMoney as money } from "@/lib/portfolio-presentation";
import { portfolioTrendChartWidth, portfolioTrendLabelIndexes, portfolioTrendMonths, type PortfolioTrendRange } from "@/lib/portfolio-trend";
import { useLanguage } from "./language-provider";
import { useSearchParams } from "next/navigation";
import styles from "./portfolio-center.module.css";
import dataStyles from "./portfolio-data.module.css";

type TrendKind = "purchases" | "sales" | "expenses";
type ChartSeries = { key: string; label: string; color: string; values: Array<number | null>; counts?: number[]; countUnit?: "cards" | "records" };

const trendMeta: Record<TrendKind, { label: string; color: string }> = {
  purchases: { label: "买入", color: "var(--theme-link, #277f7f)" },
  sales: { label: "出售", color: "var(--theme-orange, #d9531e)" },
  expenses: { label: "费用", color: "var(--theme-warning, #c2872d)" }
};

const financialTrendMeta = {
  portfolioValue: { label: "组合估值", color: "var(--theme-blue, #2563a6)" },
  remainingCost: { label: "剩余成本", color: "var(--theme-warning, #c2872d)" },
  realizedProfit: { label: "已实现盈亏", color: "var(--theme-orange, #d9531e)" },
  unrealizedProfit: { label: "未实现盈亏", color: "var(--theme-purple, #8a63d2)" }
} as const;

function trendValues(points: PortfolioTimeSeriesPoint[], months: string[], currency: string): Array<number | null> {
  const byMonth = new Map(points.map(point => [point.month, point.missingCurrencies?.includes(currency) ? null : point.values[currency] ?? 0]));
  return months.map(month => byMonth.has(month) ? byMonth.get(month)! : 0);
}

function compactAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function LineChart({ months, series: allSeries, currency, ariaLabel, emptyLabel, coverage }: {
  months: string[];
  series: ChartSeries[];
  currency: string;
  ariaLabel: string;
  emptyLabel: string;
  coverage?: Array<{ active: number; valued: number; costKnown: number } | undefined>;
}) {
  const { locale, t } = useLanguage();
  const formatValue = (value: number | null) => currency ? money(value, currency) : value === null ? "—" : value.toLocaleString(locale === "en" ? "en-US" : "zh-CN");
  const [hidden, setHidden] = useState<string[]>([]);
  const series = allSeries.filter(item => !hidden.includes(item.key));
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

  if (months.length === 0 || !series.some(item => item.values.some(value => value !== null) || item.counts?.some(count => count > 0))) {
    return <div className={styles.chartEmpty}><UiText text={emptyLabel} /></div>;
  }

  return (
    <div className={styles.chartWrap} ref={container}>
      <div className={styles.legend}>
        {allSeries.map(item => <button type="button" key={item.key} aria-pressed={!hidden.includes(item.key)} onClick={() => setHidden(current => current.includes(item.key) ? current.filter(key => key !== item.key) : series.length > 1 ? [...current, item.key] : current)}><i style={{ background: item.color }} /><UiText text={item.label} /></button>)}
      </div>
      <div className={`${styles.chartTooltip}${hoveredIndex < 0 ? ` ${styles.chartTooltipIdle}` : ""}`} role="status">
        {hoveredIndex >= 0 ? <>
          <strong>{months[hoveredIndex]}</strong>
          {series.map((item) => <span key={item.key}><i style={{ background: item.color }} /><UiText text={item.label} /> {formatValue(item.values[hoveredIndex])}{item.counts ? <span data-i18n-skip>{` · ${item.counts[hoveredIndex]} ${locale === "en" ? item.countUnit : item.countUnit === "cards" ? "张" : "笔"}`}</span> : null}</span>)}
          {counts ? <span data-i18n-skip>{locale === "en" ? `Valuation coverage ${counts.valued}/${counts.active} · Complete costs ${counts.costKnown}/${counts.active}` : `估值覆盖 ${counts.valued}/${counts.active} · 成本完整 ${counts.costKnown}/${counts.active}`}</span> : null}
        </> : null}
      </div>
      <div className={styles.chartScroller} data-horizontal-scroll={horizontallyScrollable ? "enabled" : "disabled"} onMouseLeave={() => setHoveredMonth(null)}>
        <svg className={styles.chart} viewBox={`0 0 ${chartWidth} 270`} style={{ width: chartWidth, height: 270 }} role="img" aria-label={t(ariaLabel)}>
          {[0, 1, 2, 3, 4].map((line) => {
            const value = maximum - valueRange * line / 4;
            const y = 11 + line * ((plotHeight - 22) / 4);
            return <g key={line}><line x1={left} x2={chartWidth - right} y1={y} y2={y} /><text x={left - 10} y={y + 4} textAnchor="end">{compactAmount(value, locale)}</text></g>;
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
      <details className={styles.chartData}><summary><UiText text="查看数据表" /></summary><table><thead><tr><th><UiText text="月份" /></th>{series.map(item => <th key={item.key}><UiText text={item.label} /></th>)}</tr></thead><tbody>{months.map((month, index) => <tr key={month}><td>{month}</td>{series.map(item => <td key={item.key}>{formatValue(item.values[index])}{item.counts ? ` · ${item.counts[index]}` : ""}</td>)}</tr>)}</tbody></table></details>
    </div>
  );
}

function TrendChart({ snapshot, currency, range, asOfMonth, units }: { snapshot: PortfolioSnapshot; currency: string; range: PortfolioTrendRange; asOfMonth: string; units: boolean }) {
  const months = useMemo(() => portfolioTrendMonths({ purchases: snapshot.timeSeries.purchases, sales: snapshot.timeSeries.sales, ...(!units ? { expenses: snapshot.timeSeries.expenses } : {}) }, range, asOfMonth), [asOfMonth, range, snapshot.timeSeries, units]);
  const kinds: TrendKind[] = units ? ["purchases", "sales"] : ["purchases", "sales", "expenses"];
  const series = kinds.map((kind) => ({
    key: kind,
    label: trendMeta[kind].label,
    color: trendMeta[kind].color,
    counts: units ? undefined : months.map((month) => kind === "expenses" ? snapshot.timeSeries.expenses.find(point => point.month === month)?.count || 0 : snapshot.activitySeries[kind].find((point) => point.month === month)?.count || 0),
    countUnit: kind === "expenses" ? "records" as const : "cards" as const,
    values: units ? months.map(month => kind === "expenses" ? snapshot.timeSeries.expenses.find(point => point.month === month)?.count || 0 : snapshot.activitySeries[kind].find(point => point.month === month)?.count || 0) : trendValues(snapshot.timeSeries[kind], months, currency)
  }));
  return <LineChart key={units ? "quantity" : "amount"} months={months} series={series} currency={units ? "" : currency} ariaLabel={`${currency} 月度活动趋势`} emptyLabel={`暂无 ${currency} 月度财务记录。`} />;
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
  return <LineChart months={months} series={series} currency={currency} coverage={visiblePoints.map((point) => point.coverage?.find((item) => item.currency === currency))} ariaLabel={`${currency} 组合财务趋势`} emptyLabel={`暂无 ${currency} 可重建的财务历史。`} />;
}

function useTrendRange(key: "financialRange" | "activityRange", fallback?: string) {
  const search = useSearchParams();
  const value = search.get(key) || fallback || search.get("range");
  const range: PortfolioTrendRange = value === "all" ? "all" : [6, 12, 24].includes(Number(value)) ? Number(value) as 6 | 12 | 24 : 12;
  function setRange(value: string) { const url = new URL(window.location.href); url.searchParams.set(key, value); window.history.replaceState(null, "", url); }
  return { range, setRange };
}
export function PortfolioFinancialHistorySection({ points, currencies, rangeValue }: { points: PortfolioFinancialHistoryPoint[]; currencies: string[]; rangeValue?: string }) {
  const { range, setRange } = useTrendRange("financialRange", rangeValue);
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <div><h2><UiText text={"财务趋势"} /></h2></div>
      <UiElement as="select" uiAttributes={["aria-label"]} className={styles.rangeSelect} aria-label="财务趋势时间范围" value={range} onChange={(event) => setRange(event.target.value)}>
        <option value={6}><UiText text="近6个月" /></option><option value={12}><UiText text={"近12个月"} /></option><option value={24}><UiText text={"近24个月"} /></option><option value="all"><UiText text={"所有"} /></option>
      </UiElement>
    </header>
    <div className={styles.trendGrid}>
      {(currencies.length ? currencies : ["CNY"]).map((currency) => <article key={currency} className={styles.chartCard}><h3>{currency}</h3><FinancialHistoryChart points={points} currency={currency} range={range} /></article>)}
    </div>
  </section>;
}

export function PortfolioActivityTrendSection({ snapshot, currencies, asOfMonth, rangeValue }: { snapshot: PortfolioSnapshot; currencies: string[]; asOfMonth: string; rangeValue?: string }) {
  const { range, setRange } = useTrendRange("activityRange", rangeValue);
  const [units, setUnits] = useState(false);
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <div><h2><UiText text={"活动趋势"} /></h2></div>
      <div className={styles.trendControls}>
      <UiElement as="div" uiAttributes={["aria-label"]} className={dataStyles.modeSwitch} role="group" aria-label="活动趋势显示方式">
        <button type="button" aria-pressed={!units} onClick={() => setUnits(false)}><UiText text="金额" /></button>
        <button type="button" aria-pressed={units} onClick={() => setUnits(true)}><UiText text="数量" /></button>
      </UiElement>
      <UiElement as="select" uiAttributes={["aria-label"]} className={styles.rangeSelect} aria-label="活动趋势时间范围" value={range} onChange={(event) => setRange(event.target.value)}>
        <option value={6}><UiText text="近6个月" /></option><option value={12}><UiText text={"近12个月"} /></option><option value={24}><UiText text={"近24个月"} /></option><option value="all"><UiText text={"所有"} /></option>
      </UiElement>
      </div>
    </header>
    <div className={styles.trendGrid}>
      {(currencies.length ? currencies : ["CNY"]).map((currency) => <article key={currency} className={styles.chartCard}><h3>{units ? <UiText text="数量（张）" /> : currency}</h3><TrendChart snapshot={snapshot} currency={currency} range={range} asOfMonth={asOfMonth} units={units} /></article>)}
    </div>
  </section>;
}
