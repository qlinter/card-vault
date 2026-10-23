import { UiText, UiElement } from "@/components/ui-text";
import { createPortfolioSnapshotAction, deletePortfolioSnapshotAction, renamePortfolioSnapshotAction } from "@/app/actions/portfolio";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { PortfolioFilterInput } from "@/lib/portfolio-analysis";
import type { StoredPortfolioSnapshot } from "@/lib/portfolio-persistence";
import { formatPortfolioDateTime as dateTime } from "@/lib/portfolio-presentation";
import { buildQueryHref } from "@/lib/query-params";
import { buildPortfolioScope } from "@/lib/portfolio-analysis-scope";
import { PortfolioCriterion } from "./portfolio-criterion";
import { PendingSubmitButton } from "./pending-submit-button";
import { PortfolioContextFields, PortfolioScopeLink, PortfolioRangeField } from "./portfolio-context";
import { portfolioTrendRangeKeys } from "@/lib/portfolio-trend";
import styles from "./portfolio-center.module.css";

export function PortfolioWorkspaceControls({ query, snapshots, compareLeft, compareRight, state = {} }: {
  query: PortfolioFilterInput;
  snapshots: StoredPortfolioSnapshot[];
  compareLeft?: string;
  compareRight?: string;
  state?: Record<string, string | undefined>;
}) {
  const contextFields = <PortfolioContextFields state={state} queryJson={JSON.stringify(query)} />;
  const tokens = new Set(snapshots.map(snapshot => `snapshot:${snapshot.id}`));
  const leftValue = compareLeft && tokens.has(compareLeft) ? compareLeft : snapshots[0] ? `snapshot:${snapshots[0].id}` : "";
  const rightValue = compareRight && tokens.has(compareRight) ? compareRight : "current";
  const snapshotOptions = snapshots.map(snapshot => <option key={snapshot.id} value={`snapshot:${snapshot.id}`}>{snapshot.name} · {dateTime(snapshot.capturedAt)}</option>);

  return <section className={`${styles.section} ${styles.workspaceSection}`}>
    <form action={createPortfolioSnapshotAction} className={styles.workspaceForm}>
      {contextFields}
      <UiElement as="input" uiAttributes={["placeholder", "aria-label"]} name="name" maxLength={80} placeholder="快照名称（可选）" aria-label="时间点快照名称" />
      <PendingSubmitButton><UiText text="保存当前快照" /></PendingSubmitButton>
    </form>
    <form className={styles.compareForm} method="get">
      {Object.entries({ ...query, ...state }).map(([key, value]) => value && !portfolioTrendRangeKeys.some(rangeKey => rangeKey === key) ? <input key={key} type="hidden" name={key} value={value} /> : null)}
      <PortfolioRangeField />
      <input type="hidden" name="workspace" value="1" />
      <UiElement as="select" uiAttributes={["aria-label"]} aria-label="比较对象" name="compareRight" defaultValue={rightValue} disabled={!snapshots.length}>
        <option value="current"><UiText text="当前数据（实时）" /></option>{snapshotOptions}
      </UiElement>
      <UiElement as="select" uiAttributes={["aria-label"]} aria-label="比较基准" name="compareLeft" defaultValue={leftValue} disabled={!snapshots.length}>
        {snapshots.length ? snapshotOptions : <option value=""><UiText text="暂无已保存快照" /></option>}
      </UiElement>
      <button type="submit" className="btn btn-secondary" disabled={!snapshots.length}><UiText text="开始比较" /></button>
    </form>
    {snapshots.length ? <details className={styles.workspaceManager}>
      <summary><UiText text="已保存快照" /></summary>
      <div className={styles.savedItems}>{snapshots.map(snapshot => <div key={snapshot.id}>
        <span>{snapshot.name}<small>{dateTime(snapshot.capturedAt)}</small><small>{buildPortfolioScope(snapshot.query).criteria.map(item => <span key={item.field}><PortfolioCriterion item={item} /></span>)}</small></span>
        <PortfolioScopeLink href={buildQueryHref("/portfolio", { ...query, ...state, snapshotId: snapshot.id, workspace: "1" })}><UiText text="查看" /></PortfolioScopeLink>
        <form action={renamePortfolioSnapshotAction} className={styles.workspaceForm}>{contextFields}<input type="hidden" name="id" value={snapshot.id} /><UiElement as="input" uiAttributes={["aria-label"]} aria-label="快照名称" name="name" defaultValue={snapshot.name} maxLength={80} required /><PendingSubmitButton><UiText text="重命名" /></PendingSubmitButton></form>
        <form action={deletePortfolioSnapshotAction.bind(null, snapshot.id)}>{contextFields}<ConfirmSubmitButton className={styles.textButton} message={`确认删除时间点快照“${snapshot.name}”吗？`}><UiText text="删除" /></ConfirmSubmitButton></form>
      </div>)}</div>
    </details> : null}
  </section>;
}
