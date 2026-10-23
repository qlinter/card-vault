import Link from "next/link";
import { UiText, UiElement } from "./ui-text";
import type { DataWorkspace } from "@/lib/portfolio-workspace";
import { dataHref, profitTone } from "@/lib/portfolio-workspace";
import type { PortfolioFilterInput } from "@/lib/portfolio-analysis-scope";
import { formatPortfolioMoney as money, formatSignedPortfolioMoney as signed, formatPortfolioDate as date } from "@/lib/portfolio-presentation";
import { collectionStatusText } from "@/lib/card-domain";
import { formatPercentage } from "@/lib/percentage-format";
import styles from "./portfolio-data.module.css";

export function PortfolioDataDetails({ workspace, query, state, returnTo }: { workspace: DataWorkspace; query: PortfolioFilterInput; state: Record<string, string | undefined>; returnTo: string }) {
  const quality = state.kind === "quality", sold = state.kind === "sold";
  const kinds = [["holdings", "持仓"], ["sold", "出售"], ["quality", "待完善"], ["all", "全部"]];
  const issueLabels = [["", "全部问题"], ["financial", "影响核算"], ["archive", "档案整理"], ["missing_cost", "缺成本记录"], ["missing_fx", "缺汇率"], ["missing_valuation", "未估值"], ["stale_valuation", "估值待更新"], ["missing_image", "无图片"], ["incomplete_data", "资料不完整"]];
  return <section className={styles.panel} data-testid="data-details">
    <nav className={styles.qualityFilters}>{kinds.map(([kind, label]) => <Link key={kind} href={dataHref(query, state, { kind, closed: undefined, issue: undefined, page: undefined })} aria-current={(state.kind || "holdings") === kind ? "page" : undefined}><UiText text={label} /></Link>)}</nav>
    {state.dimension || state.closed === "1" ? <p className={styles.note}>{state.dimension ? <>{state.item} · </> : null}{state.closed === "1" ? <><UiText text="已售归档" /> · </> : null}<Link href={dataHref(query, state, { dimension: undefined, item: undefined, closed: undefined, page: undefined })}><UiText text="清除明细筛选" /></Link></p> : null}
    {quality ? <div className={styles.qualityFilters}>{issueLabels.map(([issue, label]) => <Link key={issue} href={dataHref(query, state, { issue: issue || undefined, page: undefined })} aria-current={(state.issue || "") === issue ? "page" : undefined}><UiText text={label} /> · {issue ? workspace.issueCounts[issue] || 0 : workspace.qualityCount}</Link>)}</div> : null}
    <form method="get" className={styles.form}>
      {Object.entries({ ...query, ...state, page: undefined }).map(([key, value]) => value && !["search", "order"].includes(key) ? <input key={key} type="hidden" name={key} value={value} /> : null)}
      <UiElement as="input" uiAttributes={["placeholder", "aria-label"]} type="search" name="search" placeholder="搜索卡片" aria-label="搜索卡片" defaultValue={state.search} maxLength={160} />
      <UiElement as="select" uiAttributes={["aria-label"]} name="order" aria-label="明细排序" defaultValue={state.order || "valueDesc"}>{[["valueDesc", "估值从高到低"], ["costDesc", "成本从高到低"], ["profitDesc", "已实现盈亏从高到低"], ["dateDesc", "最近日期"], ["nameAsc", "主体名称"]].map(([value, label]) => <option key={value} value={value}><UiText text={label} /></option>)}</UiElement>
      <button className="btn btn-secondary"><UiText text="搜索" /></button><span className={styles.note}>{workspace.total} <UiText text="项" /> · {workspace.currency}</span>
    </form>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th><UiText text="卡片" /></th><th><UiText text="收藏状态" /></th><th className={styles.numeric}><UiText text={sold ? "出售数量" : "持有数量"} /></th>{quality ? <th><UiText text="待完善数据" /></th> : <><th className={styles.numeric}><UiText text={sold ? "已实现盈亏" : "持仓估值"} /></th><th className={styles.numeric}><UiText text="剩余成本" /></th></>}<th><UiText text={sold ? "出售日期" : "最新估值"} /></th></tr></thead><tbody>
      {workspace.rows.map(row => <tr key={row.id}><td><Link href={`/cards/${row.id}?returnTo=${encodeURIComponent(returnTo)}`}><b>{row.playerName}</b><small>{row.cardTitle}</small></Link></td><td><UiText text={collectionStatusText(row.collectionStatus)} /></td><td className={styles.numeric}>{sold ? row.soldQuantity : row.quantity}</td>{quality ? <td><div className={styles.issues}>{row.issues.map(issue => <span key={issue.key}><UiText text={issue.label} /></span>)}</div></td> : <><td className={`${styles.numeric} ${sold ? styles[profitTone(row.realized)] : ""}`}>{sold ? signed(row.realized, workspace.currency) : money(row.value, workspace.currency)}{sold ? <small><UiText text="回报率" /> {formatPercentage(row.returnRate, { fractionDigits: 2, signed: true })}</small> : null}</td><td className={styles.numeric}>{money(row.cost, workspace.currency)}{sold ? <small><UiText text="净出售金额" /> {money(row.netSales, workspace.currency)} · <UiText text="结转成本" /> {money(row.soldCost, workspace.currency)}</small> : null}</td></>}<td>{date(sold ? row.soldAt : row.valuedAt, "—")}</td></tr>)}
    </tbody></table></div>
    {!workspace.rows.length ? <p className={styles.note}><UiText text="当前条件下暂无记录。" /></p> : null}
    <nav className={styles.pagination}><span>{workspace.page} / {workspace.pages}</span>{workspace.page > 1 ? <Link href={dataHref(query, state, { page: String(workspace.page - 1) })}><UiText text="上一页" /></Link> : null}{workspace.page < workspace.pages ? <Link href={dataHref(query, state, { page: String(workspace.page + 1) })}><UiText text="下一页" /></Link> : null}</nav>
  </section>;
}
