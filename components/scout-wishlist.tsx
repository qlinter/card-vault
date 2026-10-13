"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLanguage } from "./language-provider";
import { formatMinorMoneyGrouped } from "@/lib/financial-history";
import type { ScoutData } from "@/lib/scout-service";
import type { ScoutMutation } from "./scout-query-panel";
import { ScoutCardBinding } from "./scout-card-binding";
import { useWishDrafts } from "./use-wish-drafts";
import { WorkspacePagination } from "./workspace-pagination";
import { useScoutState } from "./use-scout-state";
import type { WishUndo } from "@/lib/scout-domain";
import type { WishView } from "@/lib/scout-view";

export function ScoutWishlist({ data, busy, saving, mutate, openWatch, visible, focusWish, view, onViewChange }: { data: ScoutData; busy: boolean; saving: boolean; mutate: ScoutMutation; openWatch: (id: string) => void; visible: boolean; focusWish: { id: string; revision: number } | null; view: WishView; onViewChange: (view: WishView) => void }) {
  const { locale } = useLanguage(), l = (zh: string, en: string) => locale === "en" ? en : zh;
  const { plan, setPlan, formOpen, setFormOpen, openEditor, completeDraft, available } = useWishDrafts(data.identity);
  const expanded = useScoutState(data.identity, "expanded", { acquire: "", binding: false, cancelledOpen: false }, true);
  const { acquire, binding, cancelledOpen } = expanded.value;
  const setAcquire = expanded.field("acquire"), setBinding = expanded.field("binding"), setCancelledOpen = expanded.field("cancelledOpen");
  const [undo, setUndo] = useState<WishUndo | null>(null);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 30000); return () => clearTimeout(timer); }, [undo]);
  const [keywordFilter, setKeywordFilter] = useState(""), [keywordLimit, setKeywordLimit] = useState(50);
  const wishesRef = useRef<HTMLElement>(null);
  const handledFocus = useRef(0);
  useEffect(() => {
    if (!visible || !focusWish || handledFocus.current === focusWish.revision || !data.plans.some(row => row.id === focusWish.id)) return;
    let focusFrame = 0;
    const timer = requestAnimationFrame(() => {
      handledFocus.current = focusWish.revision;
      const element = [...(wishesRef.current?.querySelectorAll<HTMLElement>(".scout-wish") ?? [])].find(element => element.dataset.wishId === focusWish.id);
      const details = element?.closest("details");
      if (details) details.open = true;
      focusFrame = requestAnimationFrame(() => {
        element?.scrollIntoView({ block: "center", behavior: "instant" });
        element?.focus({ preventScroll: true });
        element?.classList.add("is-targeted");
      });
    });
    const clear = window.setTimeout(() => wishesRef.current?.querySelectorAll(".is-targeted").forEach(element => element.classList.remove("is-targeted")), 2500);
    const container = wishesRef.current;
    return () => { cancelAnimationFrame(timer); cancelAnimationFrame(focusFrame); window.clearTimeout(clear); container?.querySelectorAll(".is-targeted").forEach(element => element.classList.remove("is-targeted")); };
  }, [visible, focusWish, data.plans]);
  const bindingId = useId();
  const money = (amount: string, currency: string) => formatMinorMoneyGrouped(BigInt(amount), currency);
  const keywordMap = useMemo(() => new Map(data.keywordOptions.map(row => [row.id, row.keyword])), [data.keywordOptions]);
  const keyword = (watchId: string) => keywordMap.get(watchId) ?? "—";
  const visiblePlans = data.plans.filter(row => row.status === "planned" || (view.acquired && row.status === "acquired"));
  const cancelledPlans = data.plans.filter(row => row.status === "cancelled");
  const keywordOptions = data.keywordOptions.filter(row => row.keyword.toLowerCase().includes(keywordFilter.toLowerCase()));
  function renderWish(row: ScoutData["plans"][number]) {
    const priority = ({ 1: l("优先级-高", "Priority: High"), 2: l("优先级-普通", "Priority: Normal"), 3: l("优先级-低", "Priority: Low") })[row.scoutDetails?.priority ?? 2 as 1 | 2 | 3];
    const target = row.scoutDetails?.targetCount;
    return <article className="management-task scout-wish" key={row.id} data-wish-id={row.id} tabIndex={-1}>
      <div className="wish-identity"><strong>{row.title}</strong><span className="muted">{row.playerName || "—"}{target ? " · " + l("进度 ", "Progress ") + row.acquiredCardIds.length + " / " + target : ""}</span></div>
      <div className="wish-budget">{row.budgetMinor === null ? l("未设预算", "No budget") : money(row.budgetMinor, row.currency)}</div>
      <time className="wish-date">{row.targetDate?.slice(0, 10) || "—"}</time>
      <div className="wish-priority"><span>{priority}</span></div>
      {row.status !== "planned" ? <span className="record-status wish-state">{row.status === "acquired" ? l("已实现", "Acquired") : l("已取消", "Cancelled")}</span> : null}
      <div className="management-toolbar wish-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={() => openEditor(row)}>{l("编辑", "Edit")}</button>
        {row.status === "planned" ? <>
          <button className="btn btn-secondary" disabled={busy} onClick={() => { setAcquire(acquire === row.id ? "" : row.id); setBinding(false); }}>{target ? l("记录进度", "Record progress") : l("完成入藏", "Acquire")}</button>
          <button className="btn btn-secondary" disabled={busy} onClick={async () => { if (row.acquiredCardIds.length && !window.confirm(l("取消心愿会解除入藏绑定，卡片和财务记录保留。", "Cancelling unlinks acquired cards; cards and financial records remain."))) return; const result = await mutate({ action: "wish-state", id: row.id, status: "cancelled" }); if (result) { setUndo(result.undo ?? null); setAcquire(""); setBinding(false); } }}>{l("取消心愿", "Cancel wish")}</button>
        </> : <button className="btn btn-secondary" disabled={busy} onClick={async () => { if (row.acquiredCardIds.length && !window.confirm(l("重新计划会解除全部入藏绑定，卡片和财务记录保留。操作后 30 秒内可撤销。", "Planning again unlinks all acquired cards; cards and financial records remain. You can undo for 30 seconds."))) return; const result = await mutate({ action: "wish-state", id: row.id, status: "planned" }); if (result) { setUndo(result.undo ?? null); setAcquire(""); setBinding(false); } }}>{l("重新计划", "Plan again")}</button>}
      </div>
      {row.notes || row.scoutWatches.length || row.acquiredCardIds.length || row.status === "acquired" ? <div className="wish-support">
        {row.scoutWatches.length ? <div className="wish-keywords"><span className="wish-support-label">{l("关联关键词", "Linked keywords")}</span><ul>{row.scoutWatches.map(link => <li key={link.watchId}><button type="button" className="wish-keyword-link" onClick={() => openWatch(link.watchId)}>{keyword(link.watchId)}</button></li>)}</ul></div> : null}
        {row.notes ? <div className="wish-notes"><span className="wish-support-label">{l("备注", "Notes")}</span><p>{row.notes}</p></div> : null}
        {row.acquiredCardIds.length || row.status === "acquired" ? <div className="wish-acquired-card"><span className="wish-support-label">{l("入藏卡片", "Acquired cards")}</span><div className="wish-card-actions">{row.acquiredCardIds.length ? <><a className="wish-card-link" href={"/?wish=" + encodeURIComponent(row.id)}>{l("查看入藏卡片", "View acquired cards")}</a><span className="muted">{row.acquiredCardIds.length + l(" 张", " cards")}</span></> : <span className="muted">{l("未绑定", "Unlinked")}</span>}{row.status === "acquired" ? <button type="button" className="wish-card-change" disabled={busy} aria-expanded={acquire === row.id} aria-controls={bindingId} onClick={() => { setAcquire(acquire === row.id ? "" : row.id); setBinding(true); }}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 5.5A5 5 0 0 0 4 3.8L2.5 5.5m0-3v3h3m-2 5A5 5 0 0 0 12 12.2l1.5-1.7m0 3v-3h-3" /></svg>{l("更换", "Change")}</button> : null}</div></div> : null}
      </div> : null}
      {acquire === row.id && row.status === "planned" ? <div className="scout-acquire">
        <div className="scout-acquire-choices"><a className="btn btn-secondary" href={"/cards/new?wish=" + encodeURIComponent(row.id)}>{target ? l("录入新卡并记录进度", "Create card and record progress") : l("录入新卡并完成心愿", "Create card and complete wish")}</a><button type="button" className="btn btn-secondary" disabled={busy} aria-expanded={binding} aria-controls={bindingId} onClick={() => setBinding(!binding)}>{target ? l("绑定已录入卡片记录进度", "Bind recorded cards and record progress") : l("绑定已录入卡片完成心愿", "Bind recorded card and complete wish")}</button></div>
        {binding ? <div id={bindingId}><ScoutCardBinding key={row.id} wishId={row.id} busy={busy} mutate={mutate} onComplete={() => { setAcquire(""); setBinding(false); }} /></div> : null}
      </div> : null}
      {acquire === row.id && row.status === "acquired" ? <div className="scout-acquire" id={bindingId}>
        <div className="title-row"><strong>{l("更换入藏卡片", "Change acquired card")}</strong><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setAcquire(""); setBinding(false); }}>{l("关闭", "Close")}</button></div>
        <ScoutCardBinding key={row.id} wishId={row.id} busy={busy} mutate={mutate} onComplete={() => { setAcquire(""); setBinding(false); }} />
      </div> : null}
    </article>;
  }
  return <section className="panel scout-wishlist" ref={wishesRef}>
    <div className="title-row wish-header"><h2>{l("心愿单", "Wishlist")}</h2><div className="wish-header-actions"><label className="scout-toggle"><input type="checkbox" checked={view.acquired} disabled={busy} onChange={event => onViewChange({ ...view, acquired: event.target.checked, page: 1 })} />{l("已实现", "Acquired")}</label><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => openEditor()}>{l("新增", "New")}</button></div></div>
    <div className="wish-budgets">{Object.entries(data.budgets).map(([currency, amount]) => <strong key={currency}>{l("预算", "Budget")} · {money(amount, currency)}</strong>)}</div>
    <div className="wish-list-toolbar"><label><span className="sr-only">{l("搜索心愿", "Search wishes")}</span><input type="search" value={view.search} maxLength={500} placeholder={l("搜索心愿、主体或关联关键词", "Search wishes, subjects or linked keywords")} onChange={event => onViewChange({ ...view, search: event.target.value, page: 1, cancelledPage: 1 })} /></label><label><span className="sr-only">{l("心愿排序", "Sort wishes")}</span><select aria-label={l("心愿排序", "Sort wishes")} value={view.sort} onChange={event => onViewChange({ ...view, sort: event.target.value, page: 1, cancelledPage: 1 })}><option value="priority">{l("按优先级", "By priority")}</option><option value="recent">{l("最近新增", "Recently added")}</option><option value="target">{l("目标日期", "Target date")}</option></select></label><a className="btn btn-secondary" href="/api/scout/export?kind=wishes">{l("导出", "Export")}</a></div>
    {undo ? <div className="wish-undo" role="status"><span>{l("状态已更新，入藏绑定已解除。", "Status updated; card bindings cleared.")}</span><button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { if (await mutate({ action: "wish-undo", ...undo })) setUndo(null); }}>{l("撤销", "Undo")}</button></div> : null}
    <div className="wish-list">
      {formOpen ? <div className="wish-editor">
        <div className="title-row"><h3>{plan.id ? l("编辑心愿", "Edit wish") : l("新增心愿", "New wish")}</h3><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setFormOpen(false)}>{l("关闭录入", "Close editor")}</button></div>
        <form onSubmit={async event => { event.preventDefault(); if (await mutate({ action: "wish", ...plan, watchIds: plan.watchIds.filter(id => keywordMap.has(id)) })) completeDraft(); }}>
          <p className="muted wish-draft-status">{available ? l("草稿自动保存在本机，可离开后继续。", "Drafts are saved on this device; you can return later.") : l("本机草稿保存不可用，请保存心愿后再离开。", "Local draft storage is unavailable; save the wish before leaving.")}</p>
          <div className="mapping-grid">{([["title", "心愿名称", "Wish title"], ["playerName", "卡片主体", "Subject"], ["budget", "预算", "Budget"], ["targetDate", "目标日期", "Target date"], ["notes", "备注", "Notes"]] as const).map(([field, zh, en]) => <label key={field}>{l(zh, en)}<input disabled={saving} required={field === "title"} type={field === "targetDate" ? "date" : "text"} value={plan[field]} onChange={event => setPlan({ ...plan, [field]: event.target.value })} /></label>)}
            <label>{l("币种", "Currency")}<select disabled={saving} aria-label={l("币种", "Currency")} value={plan.currency} onChange={event => setPlan({ ...plan, currency: event.target.value })}><option>CNY</option><option>USD</option></select></label>
            <label>{l("目标数量（可选）", "Target count (optional)")}<input type="number" min={1} max={500} step={1} disabled={saving} value={plan.targetCount} onChange={event => setPlan({ ...plan, targetCount: event.target.value })} /></label>
            <label>{l("优先级", "Priority")}<select disabled={saving} aria-label={l("优先级", "Priority")} value={plan.priority} onChange={event => setPlan({ ...plan, priority: Number(event.target.value) })}><option value={1}>{l("高", "High")}</option><option value={2}>{l("普通", "Normal")}</option><option value={3}>{l("低", "Low")}</option></select></label>
          </div>
          {data.keywordOptions.length ? <fieldset><legend>{l("关联关键词", "Linked keywords")}</legend>{data.keywordOptions.length > 50 ? <label className="wish-keyword-search"><span className="sr-only">{l("筛选关联关键词", "Filter linked keywords")}</span><input type="search" value={keywordFilter} onChange={event => { setKeywordFilter(event.target.value); setKeywordLimit(50); }} /></label> : null}<div className="wish-keyword-options">{keywordOptions.slice(0, keywordLimit).map(watch => <label className="scout-watch-check" key={watch.id}><input type="checkbox" disabled={saving} checked={plan.watchIds.includes(watch.id)} onChange={event => setPlan({ ...plan, watchIds: event.target.checked ? [...plan.watchIds, watch.id] : plan.watchIds.filter(id => id !== watch.id) })} /><span>{watch.keyword}</span></label>)}</div>{keywordOptions.length > keywordLimit ? <button type="button" className="btn btn-secondary" onClick={() => setKeywordLimit(keywordLimit + 50)}>{l("显示更多", "Show more")}</button> : null}</fieldset> : null}
          <div className="management-toolbar"><button className="btn btn-primary" disabled={busy}>{saving ? l("正在保存…", "Saving…") : plan.id ? l("保存心愿", "Save wish") : l("添加心愿", "Add wish")}</button>{plan.id ? <button className="btn btn-danger" type="button" disabled={busy} onClick={async () => { if (window.confirm(l("确定删除心愿“" + plan.title + "”吗？", "Delete wish “" + plan.title + "”?")) && await mutate({ action: "wish-delete", id: plan.id })) completeDraft(); }}>{l("删除心愿", "Delete wish")}</button> : null}</div>
        </form>
      </div> : null}
      <div>{visiblePlans.map(renderWish)}{!visiblePlans.length ? <p className="muted">{l("暂无心愿，点击“新增”录入。", "No wishes to show. Choose New to add one.")}</p> : null}</div>
      <div className="wish-pagination"><WorkspacePagination page={data.wishPage} pageSize={data.wishPageSize} count={data.wishCount} busy={busy} onChange={page => onViewChange({ ...view, page })} /></div>
      {data.cancelledCount ? <details className="wish-cancelled" open={cancelledOpen} onToggle={event => setCancelledOpen(event.currentTarget.open)}><summary>{l("已取消", "Cancelled")} · {data.cancelledCount}</summary>{cancelledPlans.map(renderWish)}<WorkspacePagination page={data.cancelledPage} pageSize={data.wishPageSize} count={data.cancelledCount} busy={busy} onChange={cancelledPage => onViewChange({ ...view, cancelledPage })} /></details> : null}
    </div>
  </section>;
}
