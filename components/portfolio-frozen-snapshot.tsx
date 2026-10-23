import { getStoredPortfolioSnapshot } from "@/lib/portfolio-persistence";
import { formatPortfolioMoney as money, formatPortfolioDateTime as date } from "@/lib/portfolio-presentation";
import { FinancialReportNote } from "./financial-report-note";
import { UiText } from "./ui-text";
import { errorMessage } from "@/lib/feedback-messages";
import styles from "./portfolio-data.module.css";
import { PortfolioCriterion } from "./portfolio-criterion";
export async function PortfolioFrozenSnapshot({ id }: { id: string }) {
  let stored, failure = "";
  try { stored = await getStoredPortfolioSnapshot(id); } catch (error) { failure = errorMessage(error, "快照读取失败。"); }
  if (!stored) return <p role="alert" className="note-error"><UiText text={failure || "时间点快照不存在或已删除。"} /></p>;
  const { record, snapshot } = stored;
  return <section className={styles.panel} data-testid="frozen-snapshot"><header className={styles.heading}><h2>{record.name}</h2><span className={styles.note}>{date(record.capturedAt)}</span></header>
    <p className={styles.note}><UiText text="此处为保存时的冻结数据，后续编辑不会改写。" /> · {snapshot.cardCount} <UiText text="项档案" /> · {snapshot.activeCount} <UiText text="项持仓" /></p>
    <p className={styles.note}>{snapshot.scope.criteria.length ? snapshot.scope.criteria.map(item => <span key={item.field}><PortfolioCriterion item={item} /> · </span>) : <UiText text="全部收藏" />}</p>
    <dl className={styles.financialList}>{snapshot.financials.currencies.flatMap(row => [["持仓估值", snapshot.financials.valuationCoverageCount ? row.activeLatestValue : null], ["剩余成本", row.activeCostBasis], ["未实现盈亏", row.unrealizedDifference], ["已实现盈亏", row.realizedProfit]].map(([label, value]) => <div key={String(label) + row.currency}><dt><UiText text={String(label)} /> · {row.currency}</dt><dd>{money(typeof value === "number" ? value : null, row.currency)}</dd></div>))}</dl>
    <FinancialReportNote accounting={snapshot.accounting} />
  </section>;
}
