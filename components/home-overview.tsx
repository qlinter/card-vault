"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useLanguage } from "./language-provider";
import type { loadHomeOverview } from "@/lib/home-overview";
import { useWorkspaceData } from "./use-workspace-data";
import { WorkspaceFeedback } from "./workspace-feedback";

type Data = Awaited<ReturnType<typeof loadHomeOverview>>;

export function HomeOverview({ scope, children }: { scope: string; children: ReactNode }) {
  return <HomeOverviewContent key={scope} scope={scope}>{children}</HomeOverviewContent>;
}

function HomeOverviewContent({ scope, children }: { scope: string; children: ReactNode }) {
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [expanded, setExpanded] = useState(false), [handled, setHandled] = useState(false), [page, setPage] = useState(1);
  const params = new URLSearchParams(scope);
  if (expanded) { params.set("tasks", "1"); params.set("handled", handled ? "1" : "0"); params.set("page", String(page)); }
  const { data, issue, busy, loading, submitting, notice, mutate: save, refresh } = useWorkspaceData<Data>("/api/home-overview?" + params, "/api/collection-management");
  const [quietSave, setQuietSave] = useState(false);
  function mutate(body: Record<string, unknown>) {
    setQuietSave(body.action === "settings");
    return save(body);
  }
  const [undo, setUndo] = useState<{ id: string; fingerprint: string } | null>(null);
  const queueId = useId();
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  async function changeTask(task: Data["tasks"][number], status: string) {
    if (await mutate({ action: "task", id: task.id, fingerprint: task.fingerprint, status })) {
      setUndo(task.state === "open" && status !== "open" ? { id: task.id, fingerprint: task.fingerprint } : null);
    }
  }
  function toggleQueue() {
    setExpanded(!expanded);
    setHandled(false);
    setPage(1);
  }
  const kinds = { images: l("补充卡图", "Add images"), purchase: l("补充购买记录", "Add purchase history"), valuation: l("补充估值", "Add valuation"), stale: l("更新过期估值", "Refresh valuation"), grading: l("跟进送评进度", "Follow up grading"), listed: l("检查待售状态", "Review listing") };
  const tasks = loading ? [] : data?.tasks ?? [];
  return <div className="home-overview-grid" aria-busy={!data}>
    <div className="summary-grid home-summary-grid">
      {children}
      <section className="panel overview-digest">
        <div className="title-row home-summary-head"><strong>{l("收藏概览", "Collection overview")}</strong><label><span className="sr-only">{l("统计周期", "Period")}</span><select aria-label={l("统计周期", "Period")} disabled={busy || !data} value={data?.cadence ?? "weekly"} onChange={event => void mutate({ action: "settings", digestCadence: event.target.value })}><option value="weekly">{l("最近 7 天", "Last 7 days")}</option><option value="monthly">{l("最近 30 天", "Last 30 days")}</option></select></label></div>
        <div className="overview-metrics">{[[l("新增", "New cards"), data?.digest.newCards, l("统计周期内新增的卡片档案数", "Card archives created in this period")], [l("出售", "Sales"), data?.digest.sales, l("统计周期内的出售记录数", "Sale records in this period")], [l("估值", "Valuations"), data?.digest.valuations, l("统计周期内的估值记录数", "Valuation records in this period")]].map(([label, value, title]) => <div key={label} title={String(title)}><span>{label}</span><strong>{value ?? "—"}</strong></div>)}</div>
        <div className="overview-review-summary"><span>{l("待整理", "Review queue")} <b>{data?.openCount ?? "—"}</b></span><button className="btn btn-secondary" disabled={!data?.totalCount || busy} aria-expanded={expanded} aria-controls={queueId} onClick={toggleQueue}>{expanded ? l("收起", "Collapse") : l("查看全部", "View all")}</button></div>
      </section>
    </div>
    {expanded ? <section className="panel overview-review-list" id={queueId}>
      <div className="title-row"><h2>{l("整理记录", "Review records")}</h2><label className="review-handled-toggle"><input type="checkbox" checked={handled} disabled={busy} onChange={event => { setHandled(event.target.checked); setPage(1); }} />{l("显示已处理", "Show handled reminders")}</label></div>
      {loading ? <p role="status">{l("正在读取整理记录…", "Reading review records…")}</p> : null}
      {tasks.map(task => <article className="management-task" key={task.id}>
        <div><strong>{kinds[task.kind]}</strong><a href={`/cards/${task.cardId}`}>{task.playerName} · {task.cardTitle}</a><small>{task.days} {l("天", "days")} · {task.dateEstimated ? l("起始日估算 · ", "Estimated start · ") : ""}{({ open: l("待处理", "Open"), done: l("已完成", "Done"), snoozed: l("已延后", "Snoozed"), dismissed: l("已忽略", "Dismissed") } as Record<string, string>)[task.state]}</small></div>
        <div className="management-toolbar">{(task.state === "open" ? ["done", "snoozed", "dismissed"] : ["open"]).map(status => <button disabled={busy} className="btn btn-secondary" key={status} onClick={() => void changeTask(task, status)}>{({ done: l("完成", "Done"), snoozed: l("延后 7 天", "Snooze 7 days"), dismissed: l("忽略", "Dismiss"), open: l("重新打开", "Reopen") } as Record<string, string>)[status]}</button>)}</div>
      </article>)}
      {data && data.taskCount > data.pageSize ? <div className="scout-card-pagination"><button type="button" className="btn btn-secondary" disabled={busy || data.page <= 1} onClick={() => setPage(data.page - 1)}>{l("上一页", "Previous")}</button><span>{data.page} / {Math.ceil(data.taskCount / data.pageSize)}</span><button type="button" className="btn btn-secondary" disabled={busy || data.page * data.pageSize >= data.taskCount} onClick={() => setPage(data.page + 1)}>{l("下一页", "Next")}</button></div> : null}
    </section> : null}
    {undo ? <p className="workspace-feedback muted">{l("整理记录已更新", "Review record updated")} <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { if (await mutate({ action: "task", ...undo, status: "open" })) setUndo(null); }}>{l("撤销", "Undo")}</button></p> : null}
    <WorkspaceFeedback issue={issue} submitting={submitting && !quietSave} notice={notice && !undo && !quietSave} refresh={() => void refresh()} />
  </div>;
}
