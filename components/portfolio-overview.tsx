import Link from "next/link";
import { UiText } from "./ui-text";
import { FinancialReportNote } from "./financial-report-note";
import type { PortfolioSnapshotResult } from "@/lib/portfolio-snapshot-service";
import type { DataWorkspace } from "@/lib/portfolio-workspace";
import { profitTone } from "@/lib/portfolio-workspace";
import { formatPortfolioMoney as money, formatSignedPortfolioMoney as signed, formatPortfolioCountPercent as percent, formatPortfolioDate as date } from "@/lib/portfolio-presentation";
import { valuationSourceLabel } from "@/lib/financial-history-presentation";
import styles from "./portfolio-data.module.css";

export function PortfolioOverview({ result, workspace, returnTo, detailsHref, qualityHref }: { result: PortfolioSnapshotResult; workspace: DataWorkspace; returnTo: string; detailsHref: string; qualityHref: string }) {
  const { snapshot } = result;
  const basis = snapshot.accounting ? { ...snapshot.accounting, incompleteCardCount: 0, missing: [] } : undefined;
  const summary = snapshot.financials.currencies.find(row => row.currency === workspace.currency);
  const metrics = [["持仓估值", summary && snapshot.financials.valuationCoverageCount ? summary.activeLatestValue : null], ["剩余成本", summary?.activeCostBasis ?? null], ["未实现盈亏", summary?.unrealizedDifference ?? null], ["已实现盈亏", summary?.realizedProfit ?? null]] as const;
  return <div className={styles.stack}>
    <section className={styles.metrics} aria-label="financial summary">{metrics.map(([label, value], index) => <article key={label}>
      <span><UiText text={label} /></span><strong className={index > 1 ? styles[profitTone(value)] : undefined}>{index > 1 ? signed(value, workspace.currency) : money(value, workspace.currency)}</strong>
      {value === null ? <Link href={qualityHref}><UiText text="查看原因" /></Link> : index === 0 && snapshot.financials.valuationCoverageCount < snapshot.activeCount ? <small><UiText text="已估值部分" /></small> : <small>{workspace.currency}</small>}
    </article>)}</section>
    <div className={styles.meta} data-testid="data-counts">
      <span><UiText text="全部卡片" /> <b>{snapshot.cardCount}</b> <UiText text="项" /></span>
      <span><UiText text="当前持有" /> <b>{snapshot.activeCount}</b> <UiText text="项" /> · <b>{workspace.quantity}</b> <UiText text="张" /></span>
      <span><UiText text="估值覆盖" /> <b>{percent(snapshot.financials.valuationCoverageCount, snapshot.activeCount)}</b> ({snapshot.financials.valuationCoverageCount}/{snapshot.activeCount})</span>
      <span><UiText text="已售" /> <b>{snapshot.soldCount}</b> <UiText text="项" /></span>
      <span><UiText text="最新估值" /> · <UiText text={date(snapshot.financials.latestValuationAt)} /></span>
    </div>
    {!summary ? <p className={styles.note}><UiText text="暂无财务记录。" /></p> : null}
    <details className={styles.panel}><summary><UiText text="财务明细与核算依据" /></summary><dl className={styles.financialList}>
      {[["总盈亏", summary?.totalProfit], ["累计买入金额", summary?.purchaseAmount], ["累计出售金额", summary?.salesAmount], ["累计费用", summary?.expenseAmount], ["净现金投入", summary?.netCashInvested], ["未实现回报率", summary?.unrealizedReturnRate]].map(([label, value]) => <div key={String(label)}><dt><UiText text={String(label)} /></dt><dd className={label === "总盈亏" ? styles[profitTone(typeof value === "number" ? value : null)] : undefined}>{label === "未实现回报率" ? value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%` : ["总盈亏", "净现金投入"].includes(String(label)) ? signed(typeof value === "number" ? value : null, workspace.currency) : money(typeof value === "number" ? value : null, workspace.currency)}</dd></div>)}
    </dl><p className={styles.note}><UiText text="估值来源" />: {snapshot.financials.valuationSources.map(source => <span key={source.name}><UiText text={valuationSourceLabel(source.name)} /> · {source.count} <UiText text="项" />　</span>)}</p>{snapshot.accounting?.incompleteCardCount ? <p className={`${styles.note} ${styles.financialAttention}`}><Link href={qualityHref}><UiText text="财务待完善" /> · {snapshot.accounting.incompleteCardCount} <UiText text="项" /></Link></p> : null}<FinancialReportNote accounting={basis} /></details>
    <section className={styles.panel}><header className={styles.heading}><h2><UiText text="高价值持仓" /></h2><Link href={detailsHref}><UiText text="查看全部" /></Link></header>
      {workspace.top.length ? <div className={styles.miniList}>{workspace.top.map(row => <Link key={row.id} href={`/cards/${row.id}?returnTo=${encodeURIComponent(returnTo)}`}><span><b>{row.playerName}</b><small>{row.cardTitle}</small></span><span>{row.quantity} <UiText text="张" /><strong>{money(row.value, workspace.currency)}</strong></span></Link>)}</div> : <p className={styles.note}><UiText text="暂无已估值持仓。" /></p>}
    </section>
    <Link className={styles.attention} href={qualityHref}><span><UiText text="待完善数据" /> · {workspace.qualityCount} <UiText text="项" /></span><span><UiText text="查看与处理" /> →</span></Link>
  </div>;
}
