"use client";

import { UiText, UiElement } from "@/components/ui-text";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useMemo } from "react";
import { useLanguage } from "./language-provider";
import { reportingHistory, type FinancialConfig } from "@/lib/financial-reporting";
import { formatMinorMoney } from "@/lib/financial-history";
import { positionEventLabels } from "@/lib/financial-history-presentation";
import {
  calculateCurrencyPositionSeries,
  calculatePositions,
  type CurrencyPosition,
  type PositionSeriesPoint
} from "@/lib/position-accounting";

type PositionOverviewProps = {
  config: FinancialConfig;
  holdingQuantity: number;
  collectionStatus: string;
  transactions: CardTransaction[];
  expenses: CardExpense[];
  valuations: CardValuation[];
};

function profitClass(value: bigint | null): string {
  if (value === null || value === BigInt(0)) return "";
  return value > BigInt(0) ? "is-positive" : "is-negative";
}

function signedMoney(value: bigint | null, currency: string): string {
  if (value === null) return "暂无估值";
  const prefix = value > BigInt(0) ? "+" : "";
  return `${prefix}${formatMinorMoney(value, currency)}`;
}

function ratioPercent(value: bigint, total: bigint): number {
  if (total <= BigInt(0) || value <= BigInt(0)) return 0;
  return Number((value * BigInt(10000)) / total) / 100;
}

function valueRatio(value: bigint, maximum: bigint): number {
  if (maximum <= BigInt(0)) return 0;
  return Number((value * BigInt(10000)) / maximum) / 10000;
}

function dateLabel(date: Date): string {
  return date.toLocaleDateString("zh-CN", { timeZone: "UTC", month: "2-digit", day: "2-digit" });
}

function PositionTrendChart({ series, currency }: { series: PositionSeriesPoint[]; currency: string }) {
  if (series.length === 0) {
    return <div className="financial-chart-empty"><UiText text={"新增交易或估值后，这里会显示持仓成本变化。"} /></div>;
  }

  const width = 720;
  const height = 240;
  const left = 64;
  const right = 18;
  const top = 24;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const firstTime = series[0].occurredAt.getTime();
  const lastTime = series.at(-1)?.occurredAt.getTime() ?? firstTime;
  const timeRange = Math.max(1, lastTime - firstTime);
  const values = series.flatMap((point) => point.currentValueMinor === null
    ? [point.remainingCostMinor]
    : [point.remainingCostMinor, point.currentValueMinor]);
  const maximum = values.reduce((current, value) => value > current ? value : current, BigInt(1));
  const x = (point: PositionSeriesPoint) => firstTime === lastTime
    ? left + plotWidth / 2
    : left + ((point.occurredAt.getTime() - firstTime) / timeRange) * plotWidth;
  const y = (value: bigint) => top + plotHeight * (1 - valueRatio(value, maximum));
  const costPath = series.reduce((path, point, index) => {
    const pointX = x(point);
    const pointY = y(point.remainingCostMinor);
    if (index === 0) return `M ${pointX} ${pointY}`;
    return `${path} H ${pointX} V ${pointY}`;
  }, "");
  const valuationPoints = series.filter((point) => point.type === "valuation" && point.currentValueMinor !== null);
  const valuationPath = valuationPoints.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${x(point)} ${y(point.currentValueMinor ?? BigInt(0))}`).join(" ");

  return (
    <div className="position-trend-chart" data-testid="position-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`position-chart-title-${currency} position-chart-desc-${currency}`}>
        <title id={`position-chart-title-${currency}`}>{currency}<UiText text={" 持仓成本与估值变化"} /></title>
        <desc id={`position-chart-desc-${currency}`}><UiText text={"实线表示剩余持仓成本，圆点表示录入的持仓估值快照。"} /></desc>
        <line className="chart-grid-line" x1={left} x2={width - right} y1={top} y2={top} />
        <line className="chart-grid-line" x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} />
        <text className="chart-axis-label" x={left - 8} y={top + 4} textAnchor="end">{formatMinorMoney(maximum, currency)}</text>
        <text className="chart-axis-label" x={left - 8} y={top + plotHeight + 4} textAnchor="end">0</text>
        <path className="chart-cost-line" d={costPath} />
        {valuationPath ? <path className="chart-value-line" d={valuationPath} /> : null}
        {valuationPoints.map((point, index) => (
          <circle className="chart-value-point" key={`valuation-${point.occurredAt.getTime()}-${index}`} cx={x(point)} cy={y(point.currentValueMinor ?? BigInt(0))} r="5">
            <title>{dateLabel(point.occurredAt)}<UiText text={" · 持仓估值 "} />{formatMinorMoney(point.currentValueMinor ?? BigInt(0), currency)} · {point.remainingQuantity}<UiText text={" 张"} /></title>
          </circle>
        ))}
        {series.map((point, index) => (
          <g key={`${point.type}-${point.occurredAt.getTime()}-${index}`}>
            <line className={`chart-event chart-event-${point.type}`} x1={x(point)} x2={x(point)} y1={top + plotHeight + 7} y2={top + plotHeight + 17}>
              <title>{dateLabel(point.occurredAt)} · <UiText text={positionEventLabels[point.type]} /><UiText text={" · 持有 "} />{point.remainingQuantity}<UiText text={" 张"} /></title>
            </line>
          </g>
        ))}
        <text className="chart-axis-label" x={left} y={height - 7}>{dateLabel(series[0].occurredAt)}</text>
        <text className="chart-axis-label" x={width - right} y={height - 7} textAnchor="end">{dateLabel(series.at(-1)?.occurredAt ?? series[0].occurredAt)}</text>
      </svg>
      <div className="financial-chart-legend">
        <span><i className="legend-cost" /><UiText text={"剩余成本"} /></span>
        <span><i className="legend-value" /><UiText text={"估值快照"} /></span>
      </div>
    </div>
  );
}

function CostComposition({ position }: { position: CurrencyPosition }) {
  const currency = position.currency;
  const items = [
    { label: "买入金额", value: position.purchaseAmountMinor, className: "is-purchase" },
    { label: "买入成本费用", value: position.purchaseExpenseMinor, className: "is-purchase-expense" },
    { label: "评级成本费用", value: position.gradingExpenseMinor, className: "is-grading-expense" }
  ];
  const total = items.reduce((sum, item) => sum + item.value, BigInt(0));
  return (
    <section className="financial-chart-card cost-composition-card">
      <div className="financial-chart-heading">
        <h3><UiText text={"累计成本构成"} /></h3>
        <strong>{formatMinorMoney(total, currency)}</strong>
      </div>
      {total > BigInt(0) ? (
        <UiElement as="div" uiMessages={{"aria-label": {text:"累计成本 {0}",values:[formatMinorMoney(total, currency)],translateValues:[]}}} className="cost-composition-bar" role="img" >
          {items.filter((item) => item.value > BigInt(0)).map((item) => (
            <UiElement as="span" key={item.label} className={item.className} style={{ width: `${ratioPercent(item.value, total)}%` }} uiMessages={{title:{text:"{0} {1}",values:[item.label,formatMinorMoney(item.value,currency)],translateValues:[0]}}} />
          ))}
        </UiElement>
      ) : <p className="muted"><UiText text={"暂无买入或成本费用。"} /></p>}
      <div className="cost-composition-list">
        {items.map((item) => <div key={item.label}><span><i className={item.className} /><UiText text={item.label} /></span><strong>{formatMinorMoney(item.value, currency)}</strong></div>)}
      </div>
    </section>
  );
}

function ProfitBars({ position }: { position: CurrencyPosition }) {
  const currency = position.currency;
  const items = [
    { label: "已实现盈亏", value: position.realizedProfitMinor },
    { label: "未实现盈亏", value: position.unrealizedProfitMinor },
    { label: "总盈亏", value: position.totalProfitMinor }
  ];
  const maximum = items.reduce((current, item) => {
    const absolute = item.value === null ? BigInt(0) : item.value < BigInt(0) ? -item.value : item.value;
    return absolute > current ? absolute : current;
  }, BigInt(1));
  return (
    <section className="financial-chart-card profit-chart-card">
      <h3><UiText text={"盈亏构成"} /></h3>
      <div className="profit-bar-list">
        {items.map((item) => {
          const value = item.value;
          const absolute = value === null ? BigInt(0) : value < BigInt(0) ? -value : value;
          const width = value === null ? 0 : valueRatio(absolute, maximum) * 50;
          return (
            <div className="profit-bar-row" key={item.label}>
              <span><UiText text={item.label} /></span>
              <div className="profit-bar-track">
                {value !== null && value !== BigInt(0) ? <i className={value > BigInt(0) ? "is-positive" : "is-negative"} style={{ width: `${width}%` }} /> : null}
              </div>
              <strong className={profitClass(value)}>{signedMoney(value, currency)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PositionPanel({ position, series }: { position: CurrencyPosition; series: PositionSeriesPoint[] }) {
  const currency = position.currency;
  return (
    <div className="financial-position-panel">
      <div className="financial-key-metrics">
        <div><span><UiText text={"当前持有"} /></span><strong>{position.remainingQuantity}<UiText text={" 张"} /></strong></div>
        <div><span><UiText text={"持仓成本"} /></span><strong>{formatMinorMoney(position.remainingCostMinor, currency)}</strong></div>
        <div><span><UiText text={"当前估值"} /></span><strong>{position.currentValueMinor === null ? <UiText text={"暂无估值"} /> : formatMinorMoney(position.currentValueMinor, currency)}</strong></div>
        <div><span><UiText text={"总盈亏"} /></span><strong className={profitClass(position.totalProfitMinor)}>{signedMoney(position.totalProfitMinor, currency)}</strong></div>
      </div>

      <div className="financial-breakdown-grid">
        <details className="financial-breakdown">
          <summary><span><UiText text={"成本明细"} /></span><strong>{formatMinorMoney(position.remainingCostMinor, currency)}</strong></summary>
          <div>
            <span><UiText text={"累计买入金额 "} /><strong>{formatMinorMoney(position.purchaseAmountMinor, currency)}</strong></span>
            <span><UiText text={"买入成本费用 "} /><strong>{formatMinorMoney(position.purchaseExpenseMinor, currency)}</strong></span>
            <span><UiText text={"评级成本费用 "} /><strong>{formatMinorMoney(position.gradingExpenseMinor, currency)}</strong></span>
            <span><UiText text={"当前剩余成本 "} /><strong>{formatMinorMoney(position.remainingCostMinor, currency)}</strong></span>
            <span><UiText text={"平均单张成本 "} /><strong>{position.averageCostMinor === null ? "-" : formatMinorMoney(position.averageCostMinor, currency)}</strong></span>
          </div>
        </details>
        <details className="financial-breakdown">
          <summary><span><UiText text={"出售与收益"} /></span><strong>{formatMinorMoney(position.netSaleAmountMinor, currency)}</strong></summary>
          <div>
            <span><UiText text={"累计出售金额 "} /><strong>{formatMinorMoney(position.grossSaleAmountMinor, currency)}</strong></span>
            <span><UiText text={"出售费用 "} /><strong>{formatMinorMoney(position.saleExpenseMinor, currency)}</strong></span>
            <span><UiText text={"出售净收入 "} /><strong>{formatMinorMoney(position.netSaleAmountMinor, currency)}</strong></span>
            <span><UiText text={"已结转成本 "} /><strong>{formatMinorMoney(position.realizedCostMinor, currency)}</strong></span>
            <span><UiText text={"已实现盈亏 "} /><strong className={profitClass(position.realizedProfitMinor)}>{signedMoney(position.realizedProfitMinor, currency)}</strong></span>
          </div>
        </details>
      </div>

      <div className="financial-charts-grid">
        <section className="financial-chart-card trend-chart-card">
          <div className="financial-chart-heading"><h3><UiText text={"持仓成本与估值变化"} /></h3><span>{series.length}<UiText text={" 个事件"} /></span></div>
          <PositionTrendChart series={series} currency={currency} />
        </section>
        <div className="financial-side-charts">
          <CostComposition position={position} />
          <ProfitBars position={position} />
        </div>
      </div>
    </div>
  );
}

export function FinancialPositionOverview(props: PositionOverviewProps) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const report = useMemo(() => reportingHistory(props, props.config), [props]);
  const positions = calculatePositions(report);
  const activePosition = positions[0];
  const series = calculateCurrencyPositionSeries(report, props.config.reportingCurrency);
  return (
    <div className="financial-overview">
      <section data-i18n-skip>
        {!activePosition || report.costMissing.length > 0 ? <p>{text("持仓估值", "Holding value")}: {activePosition?.currentValueMinor != null ? formatMinorMoney(activePosition.currentValueMinor, props.config.reportingCurrency) : "—"}</p> : null}
      </section>
      {activePosition && report.costMissing.length === 0 ? <PositionPanel position={activePosition} series={series} /> : null}
    </div>
  );
}
