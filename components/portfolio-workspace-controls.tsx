import {
  createPortfolioSnapshotAction,
  createPortfolioViewAction,
  deletePortfolioSnapshotAction,
  deletePortfolioViewAction
} from "@/app/actions/portfolio";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { PortfolioFilterInput } from "@/lib/portfolio-analysis";
import type { SavedPortfolioView, StoredPortfolioSnapshot } from "@/lib/portfolio-persistence";
import { formatPortfolioDateTime as dateTime } from "@/lib/portfolio-presentation";
import styles from "./portfolio-center.module.css";

function portfolioHref(query: PortfolioFilterInput, viewId?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  if (viewId) params.set("viewId", viewId);
  const suffix = params.toString();
  return suffix ? `/portfolio?${suffix}` : "/portfolio";
}

function hiddenQueryFields(query: PortfolioFilterInput) {
  return Object.entries(query).map(([key, value]) => value
    ? <input key={key} type="hidden" name={key} value={value} />
    : null);
}

export function PortfolioWorkspaceControls({
  query,
  activeViewId,
  views,
  snapshots,
  compareLeft,
  compareRight
}: {
  query: PortfolioFilterInput;
  activeViewId?: string;
  views: SavedPortfolioView[];
  snapshots: StoredPortfolioSnapshot[];
  compareLeft?: string;
  compareRight?: string;
}) {
  const queryJson = JSON.stringify(query);
  const compareOptions = [
    { value: "current", label: "当前范围" },
    ...views.map((view) => ({ value: `view:${view.id}`, label: `视图 · ${view.name}` })),
    ...snapshots.map((snapshot) => ({ value: `snapshot:${snapshot.id}`, label: `快照 · ${snapshot.name} · ${dateTime(snapshot.capturedAt)}` }))
  ];
  const optionValues = new Set(compareOptions.map((option) => option.value));
  const leftValue = compareLeft && optionValues.has(compareLeft) ? compareLeft : "current";
  const rightFallback = snapshots[0]
    ? `snapshot:${snapshots[0].id}`
    : views[0]
      ? `view:${views[0].id}`
      : "current";
  const rightValue = compareRight && optionValues.has(compareRight) ? compareRight : rightFallback;

  return (
    <section className={`${styles.section} ${styles.workspaceSection}`}>
      <header className={styles.sectionHeader}>
        <div><span>WORKSPACE</span><h2>保存与比较设置</h2></div>
      </header>

      <nav className={styles.viewTabs} aria-label="收藏视图">
        <a className={!activeViewId ? styles.activeView : undefined} href="/portfolio">全部收藏</a>
        {views.map((view) => (
          <a
            className={activeViewId === view.id ? styles.activeView : undefined}
            href={portfolioHref(view.query, view.id)}
            key={view.id}
          >
            {view.name}
          </a>
        ))}
      </nav>

      <div className={styles.workspaceActions}>
        <form action={createPortfolioViewAction} className={styles.workspaceForm}>
          <input type="hidden" name="queryJson" value={queryJson} />
          <input name="name" maxLength={60} placeholder="当前范围的视图名称" aria-label="收藏视图名称" required />
          <button type="submit" className="btn btn-secondary">保存视图</button>
        </form>
        <form action={createPortfolioSnapshotAction} className={styles.workspaceForm}>
          <input type="hidden" name="queryJson" value={queryJson} />
          {activeViewId ? <input type="hidden" name="savedViewId" value={activeViewId} /> : null}
          <input name="name" maxLength={80} placeholder="快照名称（可选）" aria-label="时间点快照名称" />
          <button type="submit" className="btn btn-secondary">保存当前快照</button>
        </form>
      </div>

      <form className={styles.compareForm} method="get">
        {hiddenQueryFields(query)}
        {activeViewId ? <input type="hidden" name="viewId" value={activeViewId} /> : null}
        <label><span>比较基准</span><select name="compareLeft" defaultValue={leftValue}>{compareOptions.map((option) => <option key={`left-${option.value}`} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>比较对象</span><select name="compareRight" defaultValue={rightValue}>{compareOptions.map((option) => <option key={`right-${option.value}`} value={option.value}>{option.label}</option>)}</select></label>
        <button type="submit" className="btn btn-secondary">开始比较</button>
      </form>

      {(views.length > 0 || snapshots.length > 0) ? (
        <details className={styles.workspaceManager}>
          <summary>管理已保存内容</summary>
          {views.length > 0 ? <div className={styles.savedItems}><strong>收藏视图</strong>{views.map((view) => (
            <div key={view.id}><span>{view.name}</span><form action={deletePortfolioViewAction.bind(null, view.id)}><ConfirmSubmitButton className={styles.textButton} message={`确认删除收藏视图“${view.name}”吗？已保存的时间点快照会保留。`}>删除</ConfirmSubmitButton></form></div>
          ))}</div> : null}
          {snapshots.length > 0 ? <div className={styles.savedItems}><strong>时间点快照</strong>{snapshots.map((snapshot) => (
            <div key={snapshot.id}><span>{snapshot.name}<small>{dateTime(snapshot.capturedAt)}</small></span><form action={deletePortfolioSnapshotAction.bind(null, snapshot.id)}><ConfirmSubmitButton className={styles.textButton} message={`确认删除时间点快照“${snapshot.name}”吗？`}>删除</ConfirmSubmitButton></form></div>
          ))}</div> : null}
        </details>
      ) : null}
    </section>
  );
}
