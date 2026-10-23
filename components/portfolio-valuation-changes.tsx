import { UiText } from "./ui-text";
import type { PortfolioValuationChange } from "@/lib/portfolio-insights";
import { profitTone, valuationChangeAvailable } from "@/lib/portfolio-workspace";
import { formatPortfolioMoney as money, formatSignedPortfolioMoney as signed, formatPortfolioDate as date } from "@/lib/portfolio-presentation";
import { formatPercentage } from "@/lib/percentage-format";
import styles from "./portfolio-data.module.css";
export function PortfolioValuationChanges({ changes }: { changes: PortfolioValuationChange[] }) {
  return <section className={styles.panel}><header className={styles.heading}><h2><UiText text="持仓估值变化" /></h2></header><div className={`${styles.financialList} ${styles.valuationChanges}`}>{changes.map(change => <div key={change.days}><span>{change.days} <UiText text="天" /><small className={styles.note}> · {date(change.baselineAt)}</small></span><div>{change.currencies.map(row => <div key={row.currency}>
    {valuationChangeAvailable(row) ? <><strong className={styles[profitTone(row.changeAmount)]}>{signed(row.changeAmount, row.currency)}</strong><p className={styles.note}>{money(row.baselineValue, row.currency)} → {money(row.currentValue, row.currency)} · {formatPercentage(row.changeRate, { signed: true })}</p><small className={styles.note}>{row.baselineValuedCardCount} → {row.currentValuedCardCount} <UiText text="项有估值" /></small></> : <span className={styles.note}><UiText text="缺少可比较估值基准" /></span>}
  </div>)}</div></div>)}</div></section>;
}
