"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { useState } from "react";
import type { PortfolioComparison } from "@/lib/portfolio-insights";
import { formatPercentage } from "@/lib/percentage-format";
import {
  formatPortfolioDateTime as compactDateTime,
  formatPortfolioMoney as money,
  formatSignedPortfolioMoney as signedMoney
} from "@/lib/portfolio-presentation";
import styles from "./portfolio-center.module.css";
import { FinancialReportNote } from "./financial-report-note";

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
    ["待送评", comparison.left.pendingGradingCount, comparison.right.pendingGradingCount],
    ["卡片主体", comparison.left.playerCount, comparison.right.playerCount]
  ] as const;
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><h2><UiText text={"组合比较"} /></h2></div>
      </header>
      <div className={styles.comparisonSources}>
        <div><span><UiText text={"基准"} /></span><strong>{comparison.left.label}</strong><small>{compactDateTime(comparison.left.capturedAt)}</small></div>
        <div><span><UiText text={"对象"} /></span><strong>{comparison.right.label}</strong><small>{compactDateTime(comparison.right.capturedAt)}</small></div>
      </div>
      <div className={styles.comparisonCounts}>
        {countRows.map(([label, left, right]) => <div key={label}><span><UiText text={label} /></span><strong>{left} → {right}</strong><small>{right - left >= 0 ? "+" : ""}{right - left}</small></div>)}
      </div>
      <details><summary><UiText text={"核算依据"} /></summary>{[comparison.left, comparison.right].map((point, index) => <div key={index}><strong>{point.label}</strong><FinancialReportNote accounting={point.accounting} /></div>)}</details>
      <div className={styles.comparisonCurrencyGrid}>
        {currencies.map((currency) => {
          const left = comparison.left.currencies.find((item) => item.currency === currency);
          const right = comparison.right.currencies.find((item) => item.currency === currency);
          const rows = [
            ["组合估值", left?.latestValue ?? null, right?.latestValue ?? null],
            ["剩余成本", left?.activeCostBasis ?? null, right?.activeCostBasis ?? null],
            ["已实现盈亏", left?.realizedProfit ?? null, right?.realizedProfit ?? null],
            ["总盈亏", left?.totalProfit ?? null, right?.totalProfit ?? null]
          ] as const;
          return <article key={currency}><h3>{currency}</h3>{rows.map(([label, leftValue, rightValue]) => {
            const difference = rightValue === null || leftValue === null ? null : rightValue - leftValue;
            return <div key={label}><span><UiText text={label} /></span><strong>{money(leftValue, currency)} → {money(rightValue, currency)}</strong><small className={(difference ?? 0) >= 0 ? styles.positive : styles.negative}>{signedMoney(difference, currency)}</small></div>;
          })}</article>;
        })}
      </div>
      {structures.length > 0 ? <div className={styles.structureComparison}>
        <header>
          <div><h3><UiText text={"结构变化"} /></h3></div>
          {currencies.length > 0 ? <UiElement as="div" uiAttributes={["aria-label"]} className={styles.currencySwitch} role="group" aria-label="结构比较币种">
            {currencies.map((currency) => <button key={currency} type="button" className={structureCurrency === currency ? styles.active : undefined} onClick={() => setStructureCurrency(currency)}>{currency}</button>)}
          </UiElement> : null}
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
