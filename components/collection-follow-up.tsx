"use client";
import { useEffect, useId, useState } from "react";
import { useLanguage } from "./language-provider";
import type { loadHomeOverview } from "@/lib/home-overview";
import { useWorkspaceData } from "./use-workspace-data";
import { WorkspaceFeedback } from "./workspace-feedback";
import { DisclosureIcon } from "./disclosure-icon";

type Data = Awaited<ReturnType<typeof loadHomeOverview>>;

export function CollectionFollowUp({ scope, returnTo }: { scope: string; returnTo: string }) {
  return <FollowUpContent key={scope} scope={scope} returnTo={returnTo} />;
}

function FollowUpContent({ scope, returnTo }: { scope: string; returnTo: string }) {
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [expanded, setExpanded] = useState(false), [handled, setHandled] = useState(false), [page, setPage] = useState(1);
  const params = new URLSearchParams(scope);
  params.set("review", "followup");
  if (expanded) { params.set("tasks", "1"); params.set("handled", handled ? "1" : "0"); params.set("page", String(page)); }
  const { data, issue, busy, loading, submitting, notice, mutate, refresh } = useWorkspaceData<Data>("/api/home-overview?" + params, "/api/collection-management");
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
  const kinds = { images: l("补充卡图", "Add images"), purchase: l("补充购买记录", "Add purchase history"), valuation: l("补充估值", "Add valuation"), stale: l("更新过期估值", "Refresh valuation"), grading: l("跟进送评进度", "Follow up grading"), listed: l("检查待售状态", "Review listing") };
  const tasks = loading ? [] : data?.tasks ?? [];
  return <div className="collection-follow-up overview-review-list">
    <button type="button" className="collection-follow-up-toggle" aria-expanded={expanded} aria-controls={queueId} onClick={() => { setExpanded(!expanded); setHandled(false); setPage(1); }}><span>{l("送评与待售跟进", "Grading and listing follow-ups")} <small>{data?.followupOpenCount ?? "–"}</small></span><span>{l("历史提醒", "Reminder history")} <DisclosureIcon expanded={expanded} /></span></button>
    {expanded ? <section id={queueId}>
      <div className="title-row"><label className="review-handled-toggle"><input type="checkbox" checked={handled} disabled={busy} onChange={event => { setHandled(event.target.checked); setPage(1); }} />{l("显示已处理", "Show handled reminders")}</label></div>
      {loading ? <p role="status">{l("正在读取整理记录…", "Reading review records…")}</p> : null}
      {!loading && data && !tasks.length ? <p className="muted">{l("当前范围暂无跟进事项。", "No follow-ups in this scope.")}</p> : null}
      {tasks.map(task => <article className="management-task" key={task.id}>
        <div><strong>{kinds[task.kind]}</strong><a href={`/cards/${encodeURIComponent(task.cardId)}?returnTo=${encodeURIComponent(returnTo)}`}>{task.playerName} · {task.cardTitle}</a><small>{task.days} {l("天", "days")} · {task.dateEstimated ? l("起始日估算 · ", "Estimated start · ") : ""}{({ open: l("待处理", "Open"), done: l("已完成", "Done"), snoozed: l("已延后", "Snoozed"), dismissed: l("已忽略", "Dismissed") } as Record<string, string>)[task.state]}</small></div>
        <div className="management-toolbar">{(task.state === "open" ? ["done", "snoozed", "dismissed"] : ["open"]).map(status => <button disabled={busy} className="btn btn-secondary" key={status} onClick={() => void changeTask(task, status)}>{({ done: l("完成", "Done"), snoozed: l("延后 7 天", "Snooze 7 days"), dismissed: l("忽略", "Dismiss"), open: l("重新打开", "Reopen") } as Record<string, string>)[status]}</button>)}</div>
      </article>)}
      {data && data.taskCount > data.pageSize ? <div className="scout-card-pagination"><button type="button" className="btn btn-secondary" disabled={busy || data.page <= 1} onClick={() => setPage(data.page - 1)}>{l("上一页", "Previous")}</button><span>{data.page} / {Math.ceil(data.taskCount / data.pageSize)}</span><button type="button" className="btn btn-secondary" disabled={busy || data.page * data.pageSize >= data.taskCount} onClick={() => setPage(data.page + 1)}>{l("下一页", "Next")}</button></div> : null}
    </section> : null}
    {undo ? <p className="workspace-feedback muted">{l("整理记录已更新", "Review record updated")} <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { if (await mutate({ action: "task", ...undo, status: "open" })) setUndo(null); }}>{l("撤销", "Undo")}</button></p> : null}
    <WorkspaceFeedback issue={issue} submitting={submitting} notice={notice && !undo} refresh={() => void refresh()} />
  </div>;
}
