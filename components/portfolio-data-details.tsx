import Link from "next/link";
import type { ReactNode } from "react";
import { UiText, UiElement } from "./ui-text";
import type { DataWorkspace } from "@/lib/portfolio-workspace-types";
import { dataHref, profitTone } from "@/lib/portfolio-navigation";
import type { PortfolioFilterInput } from "@/lib/portfolio-analysis-scope";
import { formatPortfolioMoney as money, formatSignedPortfolioMoney as signed, formatPortfolioDate as date } from "@/lib/portfolio-presentation";
import { cardCollectionStatuses, collectionStatusText } from "@/lib/card-domain";
import { portfolioDetailStatus } from "@/lib/portfolio-data-rows";
import { formatPercentage } from "@/lib/percentage-format";
import { buildQueryHref } from "@/lib/query-params";
import { CollectionFollowUp } from "./collection-follow-up";
import styles from "./portfolio-data.module.css";

function RowMetric({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return <div><dt><UiText text={label} /></dt><dd className={tone}>{children}</dd></div>;
}

export function PortfolioDataDetails({ workspace, query, state, returnTo }: { workspace: DataWorkspace; query: PortfolioFilterInput; state: Record<string, string | undefined>; returnTo: string }) {
  const quality = state.kind === "quality";
  const clearList = { detailStatus: undefined, issue: undefined, search: undefined, order: undefined, page: undefined, dimension: undefined, item: undefined, closed: undefined };
  return <section className={styles.panel} data-testid="data-details">
    <nav className={styles.qualityFilters}>
      <Link href={dataHref(query, state, { ...clearList, kind: "all" })} aria-current={!quality ? "page" : undefined}><UiText text="列表" /></Link>
      <Link href={dataHref(query, state, { ...clearList, kind: "quality" })} aria-current={quality ? "page" : undefined}><UiText text="整理" /></Link>
    </nav>
    {!quality && (state.dimension || state.closed === "1") ? <p className={styles.note}>{state.dimension ? <>{state.item} · </> : null}{state.closed === "1" ? <><UiText text="已售归档" /> · </> : null}<Link href={dataHref(query, state, { dimension: undefined, item: undefined, closed: undefined, page: undefined })}><UiText text="清除明细筛选" /></Link></p> : null}
    {quality ? <p className={styles.reviewCount}>{workspace.total} <UiText text="项" /></p> : <form method="get" className={styles.form}>
      {Object.entries({ ...query, ...state, kind: "all", page: undefined, issue: undefined }).map(([key, value]) => value && !["detailStatus", "search", "order"].includes(key) ? <input key={key} type="hidden" name={key} value={value} /> : null)}
      <UiElement as="select" uiAttributes={["aria-label"]} name="detailStatus" aria-label="明细状态" defaultValue={portfolioDetailStatus(state)}>
        <UiElement as="optgroup" uiAttributes={["label"]} label="查看范围"><option value="all"><UiText text="全部" /></option><option value="holdings"><UiText text="持仓" /></option><option value="sales"><UiText text="出售记录" /></option></UiElement>
        <UiElement as="optgroup" uiAttributes={["label"]} label="收藏状态">{cardCollectionStatuses.map(status => <option key={status} value={status}><UiText text={collectionStatusText(status)} /></option>)}</UiElement>
      </UiElement>
      <UiElement as="input" uiAttributes={["placeholder", "aria-label"]} type="search" name="search" placeholder="搜索卡片" aria-label="搜索卡片" defaultValue={state.search} maxLength={160} />
      <UiElement as="select" uiAttributes={["aria-label"]} name="order" aria-label="明细排序" defaultValue={state.order || "valueDesc"}>{[["valueDesc", "估值从高到低"], ["costDesc", "成本从高到低"], ["profitDesc", "已实现盈亏从高到低"], ["dateDesc", "最近日期"], ["nameAsc", "主体名称"]].map(([value, label]) => <option key={value} value={value}><UiText text={label} /></option>)}</UiElement>
      <button className="btn btn-secondary"><UiText text="筛选" /></button><span className={styles.note}>{workspace.total} <UiText text="项" /> · {workspace.currency}</span>
    </form>}
    <div className={styles.tableWrap}><table className={`${styles.table} ${quality ? "" : styles.detailsTable}`}>
      {!quality ? <colgroup><col /><col /><col /><col /><col /><col /></colgroup> : null}
      <thead><tr><th><UiText text="卡片" /></th><th><UiText text="收藏状态" /></th>{quality ? <><th className={styles.numeric}><UiText text="持有数量" /></th><th><UiText text="待完善数据" /></th><th><UiText text="最新估值" /></th></> : <><th><UiText text="数量" /></th><th><UiText text="持仓" /></th><th><UiText text="出售" /></th><th><UiText text="最近记录" /></th></>}</tr></thead>
      <tbody>{workspace.rows.map(row => <tr key={row.id}>
        <td><Link href={`/cards/${encodeURIComponent(row.id)}?returnTo=${encodeURIComponent(returnTo)}`}><b>{row.playerName}</b><small>{row.cardTitle}</small></Link></td>
        <td><UiText text={collectionStatusText(row.collectionStatus)} /></td>
        {quality ? <><td className={styles.numeric}>{row.quantity}</td><td><div className={styles.issues}>{row.issues.map(issue => <span key={issue.key}><UiText text={issue.label} /></span>)}</div></td><td>{date(row.valuedAt, "–")}</td></> : <>
          <td><dl className={styles.rowMetrics}><RowMetric label="持有数量">{row.quantity}</RowMetric><RowMetric label="出售数量">{row.soldQuantity}</RowMetric></dl></td>
          <td><dl className={styles.rowMetrics}><RowMetric label="估值">{money(row.value, workspace.currency)}</RowMetric><RowMetric label="剩余成本">{money(row.cost, workspace.currency)}</RowMetric></dl></td>
          <td>{row.soldQuantity > 0 ? <dl className={styles.rowMetrics}><RowMetric label="已实现盈亏" tone={styles[profitTone(row.realized)]}>{signed(row.realized, workspace.currency)}</RowMetric><RowMetric label="净出售金额">{money(row.netSales, workspace.currency)}</RowMetric><RowMetric label="结转成本">{money(row.soldCost, workspace.currency)}</RowMetric><RowMetric label="回报率">{formatPercentage(row.returnRate, { fractionDigits: 2, signed: true })}</RowMetric></dl> : <span className={styles.note}>–</span>}</td>
          <td><dl className={`${styles.rowMetrics} ${styles.rowDates}`}><RowMetric label="最新估值">{date(row.valuedAt, "–")}</RowMetric><RowMetric label="出售日期">{date(row.soldAt, "–")}</RowMetric></dl></td>
        </>}
      </tr>)}</tbody>
    </table></div>
    {!workspace.rows.length ? <p className={styles.note}><UiText text="当前条件下暂无记录。" /></p> : null}
    {!quality ? <nav className={styles.pagination}><span>{workspace.page} / {workspace.pages}</span>{workspace.page > 1 ? <Link href={dataHref(query, state, { page: String(workspace.page - 1) })}><UiText text="上一页" /></Link> : null}{workspace.page < workspace.pages ? <Link href={dataHref(query, state, { page: String(workspace.page + 1) })}><UiText text="下一页" /></Link> : null}</nav> : null}
    {quality ? <CollectionFollowUp scope={buildQueryHref("/", query).slice(1)} returnTo={returnTo} /> : null}
  </section>;
}
