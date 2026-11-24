"use client";

import { UiText, UiElement } from "@/components/ui-text";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useMemo } from "react";
import { useLanguage } from "./language-provider";
import { reportingHistory, type FinancialConfig } from "@/lib/financial-reporting";
import { formatMinorMoney } from "@/lib/financial-history";
import { HoldingComparison } from "./holding-comparison";
import {
  calculateHoldingSnapshots,
  calculatePositions,
  type CurrencyPosition,
  type HoldingSnapshot
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

function PositionPanel({ position, days }: { position: CurrencyPosition; days: HoldingSnapshot[] }) {
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

      {days.length ? <details className="financial-chart-details"><summary><UiText text="财务图表" /></summary><div className="financial-charts-grid">
        <HoldingComparison days={days} currency={currency} />
        <div className="financial-side-charts">
          <CostComposition position={position} />
          <ProfitBars position={position} />
        </div>
      </div></details> : null}
    </div>
  );
}

export function FinancialPositionOverview(props: PositionOverviewProps) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const report = useMemo(() => reportingHistory(props, props.config), [props]);
  const positions = calculatePositions(report);
  const activePosition = positions[0];
  const days = calculateHoldingSnapshots(report, props.config.reportingCurrency);
  return (
    <div className="financial-overview">
      <section data-i18n-skip>
        {!activePosition || report.costMissing.length > 0 ? <p>{text("持仓估值", "Holding value")}: {activePosition?.currentValueMinor != null ? formatMinorMoney(activePosition.currentValueMinor, props.config.reportingCurrency) : "–"}</p> : null}
      </section>
      {activePosition && report.costMissing.length === 0 ? <PositionPanel position={activePosition} days={days} /> : null}
    </div>
  );
}
