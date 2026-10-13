"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLanguage } from "./language-provider";
import { emptyScoutQuery, normalizeScoutQuery, scoutSearchText, type ScoutQuery } from "@/lib/scout-domain";
import type { ScoutData } from "@/lib/scout-service";
import { ScoutQueryPanel } from "./scout-query-panel";
import { ScoutWishlist } from "./scout-wishlist";
import { DisclosureIcon } from "./disclosure-icon";
import { useWorkspaceData } from "./use-workspace-data";
import { WorkspaceFeedback } from "./workspace-feedback";
import { WorkspacePagination } from "./workspace-pagination";
import { useScoutState } from "./use-scout-state";
import { defaultWishView, wishViewForTarget } from "@/lib/scout-view";

export function ScoutWorkspace({ identity, initialQuery = emptyScoutQuery, initialTab = "query", initialWatchId = "", initialWishId = "" }: { identity: string; initialTab?: string; initialWatchId?: string; initialWishId?: string; initialQuery?: ScoutQuery }) {
  const { locale } = useLanguage(), l = (zh: string, en: string) => locale === "en" ? en : zh;
  const context = useScoutState(identity, "workspace", { tab: initialTab === "wishlist" ? "wishlist" : "query", watchId: initialWatchId, search: "", watchPage: 1, wishView: defaultWishView, queryDrafts: {} as Record<string, string>, savedOpen: true }, true);
  const { tab, watchId, search, watchPage, wishView, queryDrafts, savedOpen } = context.value;
  const setTab = context.field("tab"), setWatchId = context.field("watchId"), setSearch = context.field("search"), setWatchPage = context.field("watchPage"), setWishView = context.field("wishView"), setQueryDrafts = context.field("queryDrafts"), setSavedOpen = context.field("savedOpen");
  const source = "/api/scout?" + new URLSearchParams({ window: "1", q: search, watchPage: String(watchPage), wishPage: String(wishView.page), cancelledPage: String(wishView.cancelledPage), acquired: wishView.acquired ? "1" : "0", wishQ: wishView.search, wishSort: wishView.sort });
  const { data, dataSource, issue, busy, submitting, notice, mutate, refresh, setIssue } = useWorkspaceData<ScoutData>(source, "/api/scout");
  const [wishFocus, setWishFocus] = useState<{ id: string; revision: number } | null>(null);
  const positions = useRef<Record<string, number>>({ query: 0, wishlist: 0 });
  const focusRevision = useRef(0);
  const initialWishHandled = useRef(false);
  const initialNavigationHandled = useRef(false), scrollRestored = useRef(false);
  useEffect(() => {
    if (!context.ready || initialNavigationHandled.current) return;
    const frame = requestAnimationFrame(() => {
      initialNavigationHandled.current = true;
      if (initialWatchId || initialQuery.keyword) { setTab("query"); setWatchId(initialWatchId); if (initialQuery.keyword) setQueryDrafts(drafts => ({ ...drafts, new: initialQuery.keyword })); }
      else if (initialTab === "wishlist") setTab("wishlist");
    });
    return () => cancelAnimationFrame(frame);
  }, [context.ready, initialWatchId, initialQuery.keyword, initialTab, setTab, setWatchId, setQueryDrafts]);
  useEffect(() => {
    if (!context.ready || !data || busy || scrollRestored.current) return;
    scrollRestored.current = true;
    try { positions.current = JSON.parse(window.sessionStorage.getItem("card-vault:scout-scroll:" + identity) ?? "{}"); } catch { positions.current = {}; }
    const frame = requestAnimationFrame(() => { if (!initialWishId) window.scrollTo({ top: positions.current[tab] ?? 0 }); });
    return () => cancelAnimationFrame(frame);
  }, [context.ready, data, busy, identity, tab, initialWishId]);
  useEffect(() => {
    if (!context.ready) return;
    const save = () => { positions.current[tab] = window.scrollY; try { window.sessionStorage.setItem("card-vault:scout-scroll:" + identity, JSON.stringify(positions.current)); } catch { /* Context remains usable without browser storage. */ } };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);
    return () => { window.removeEventListener("scroll", save); window.removeEventListener("pagehide", save); };
  }, [tab, identity, context.ready]);
  useEffect(() => {
    if (!context.ready || !initialWishId || !data || dataSource !== source || initialWishHandled.current) return;
    const next = wishViewForTarget(data.wishOptions, data.wishPageSize, initialWishId, wishView);
    if (!next) { initialWishHandled.current = true; return; }
    const frame = requestAnimationFrame(() => {
      initialWishHandled.current = true;
      setWishView(next);
      setTab("wishlist"); setWishFocus({ id: initialWishId, revision: ++focusRevision.current });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialWishId, data, dataSource, source, wishView, context.ready, setWishView, setTab]);
  const [selection, setSelectedIds] = useState<string[]>([]);
  const keywordIds = useMemo(() => new Set(data?.keywordOptions.map(row => row.id)), [data]);
  const selectedIds = selection.filter(id => keywordIds.has(id));
  const linkedWishes = useMemo(() => {
    const index = new Map<string, ScoutData["wishOptions"]>();
    for (const wish of data?.wishOptions ?? []) for (const id of wish.watchIds) {
      const wishes = index.get(id) ?? []; wishes.push(wish); index.set(id, wishes);
    }
    return index;
  }, [data]);
  const savedContentId = useId();
  const selectAllRef = useRef<HTMLInputElement>(null);
  function switchTab(next: string) {
    if (tab === next) return;
    positions.current[tab] = window.scrollY;
    setTab(next);
    requestAnimationFrame(() => window.scrollTo({ top: positions.current[next] ?? 0 }));
  }
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "query") url.searchParams.delete("tab"); else url.searchParams.set("tab", tab);
    if (watchId) url.searchParams.set("watch", watchId); else url.searchParams.delete("watch");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [tab, watchId]);
  function openWatch(id: string) {
    setWatchId(id); switchTab("query");
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".scout-query input")?.focus({ preventScroll: true }));
  }
  function openWish(id: string) {
    const next = data && wishViewForTarget(data.wishOptions, data.wishPageSize, id, wishView);
    if (!next) return;
    setWishView(next);
    switchTab("wishlist"); setWishFocus({ id, revision: ++focusRevision.current });
  }
  async function deleteKeywords(ids: string[]) {
    const question = l("确定删除所选的 " + ids.length + " 个关键词吗？", "Delete the " + ids.length + " selected keywords?");
    if (!window.confirm(question + l("关联心愿会解除，心愿与卡片保留。", " Wishes will be unlinked; wishes and cards will remain."))) return;
    if (await mutate({ action: "keywords-delete", ids })) {
      setSelectedIds(selected => selected.filter(id => !ids.includes(id)));
      if (ids.includes(watchId)) setWatchId("");
    }
  }
  const watch = data?.keywordOptions.find(row => row.id === watchId);
  async function saveKeyword(keyword: string) {
    if (!data || busy) return;
    try {
      const query = normalizeScoutQuery({ keyword });
      const existing = data.keywordOptions.find(row => row.keyword === query.keyword);
      if (existing) { setIssue(null); setQueryDrafts(drafts => { const next = { ...drafts }; delete next[watchId || "new"]; next[existing.id] = query.keyword; return next; }); openWatch(existing.id); return; }
      const result = await mutate({ action: "keyword-save", keyword: query.keyword });
      if (result?.id) { setQueryDrafts(drafts => { const next = { ...drafts }; delete next[watchId || "new"]; next[result.id!] = query.keyword; return next; }); openWatch(result.id); }
    } catch (error) { setIssue({ kind: "save", message: error instanceof Error ? error.message : String(error) }); }
  }
  const savedQueries = data?.watches ?? [];
  const allSelected = savedQueries.length > 0 && savedQueries.every(row => selectedIds.includes(row.id));
  const someSelected = savedQueries.some(row => selectedIds.includes(row.id));
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected; }, [someSelected, allSelected, tab]);
  return <div className="page management-page scout-page">
    <div className="scout-tabs" role="tablist" aria-label={l("寻卡功能", "Scout sections")}>
      {[["query", l("跨站查询", "Cross-site search")], ["wishlist", l("心愿单", "Wishlist")]].map(([value, label]) => <button className={"btn " + (tab === value ? "btn-primary" : "btn-secondary")} role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} aria-controls={"scout-" + value} id={"tab-" + value} key={value} onClick={() => switchTab(value)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "query" : event.key === "End" ? "wishlist" : tab === "query" ? "wishlist" : "query"; switchTab(next); document.getElementById("tab-" + next)?.focus(); } }}>{label}</button>)}
    </div>
    <WorkspaceFeedback issue={issue} submitting={submitting} notice={notice} refresh={() => void refresh()} />
      <div role="tabpanel" id="scout-query" aria-labelledby="tab-query" hidden={tab !== "query"} className="scout-query-stack">
        <ScoutQueryPanel value={queryDrafts[watchId || "new"] ?? watch?.keyword ?? scoutSearchText(initialQuery)} onChange={keyword => setQueryDrafts(drafts => ({ ...drafts, [watchId || "new"]: keyword }))} busy={busy || !data} locked={submitting} save={saveKeyword} />
        <section className="panel scout-saved">
          <div className="title-row scout-saved-head"><h2>{l("已保存关键词", "Saved keywords")}</h2><button type="button" className="btn btn-secondary disclosure-button" aria-label={savedOpen ? l("收起已保存关键词", "Collapse saved keywords") : l("展开已保存关键词", "Expand saved keywords")} aria-expanded={savedOpen} aria-controls={savedContentId} onClick={() => setSavedOpen(!savedOpen)}><DisclosureIcon expanded={savedOpen} /></button></div>
          <div id={savedContentId} hidden={!savedOpen}>
          <div className="scout-saved-toolbar">
            <label className="scout-saved-filter"><span className="sr-only">{l("筛选关键词", "Filter keywords")}</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input value={search} onChange={event => { setSearch(event.target.value); setWatchPage(1); }} /></label>
            <div className="scout-saved-actions"><a className="btn btn-secondary" href="/api/scout/export?kind=keywords" download>{l("导出", "Export")}</a>{selectedIds.length ? <span className="muted">{l("已选 " + selectedIds.length + " 项", selectedIds.length + " selected")}</span> : null}<button type="button" className="btn btn-danger" disabled={busy || !selectedIds.length} onClick={() => void deleteKeywords(selectedIds)}>{l("删除", "Delete")}</button></div>
          </div>
          <div className="scout-watch-list">
            {data?.watches.length ? <div className="scout-watch-columns">
              <input type="checkbox" ref={selectAllRef} aria-label={l("全选当前页", "Select this page")} checked={allSelected} disabled={busy || !savedQueries.length} onChange={event => setSelectedIds(ids => event.target.checked ? [...new Set([...ids, ...savedQueries.map(row => row.id)])] : ids.filter(id => !savedQueries.some(row => row.id === id)))} />
              <span>{l("关键词", "Keywords")}</span><span>{l("关联心愿", "Linked wishes")}</span>
            </div> : null}
            {savedQueries.map(row => {
            const plans = linkedWishes.get(row.id) ?? [];
            const keyword = scoutSearchText(JSON.parse(row.queryJson));
            return <article className={"scout-watch-row" + (row.id === watchId ? " is-active" : "") + (selectedIds.includes(row.id) ? " is-selected" : "")} key={row.id}>
              <input type="checkbox" aria-label={l("选择关键词：", "Select keywords: ") + keyword} checked={selectedIds.includes(row.id)} disabled={busy} onChange={event => setSelectedIds(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} />
              <button type="button" className="scout-watch-select" disabled={busy} aria-pressed={row.id === watchId} onClick={() => openWatch(row.id)}>{keyword}</button>
              <div className="scout-linked-wishes">{plans.length ? plans.map(plan => <button type="button" key={plan.id} onClick={() => openWish(plan.id)}>{plan.title}</button>) : <span className="scout-unlinked">—</span>}</div>
            </article>;
          })}</div>
          {data ? <WorkspacePagination page={data.watchPage} pageSize={data.watchPageSize} count={data.watchCount} busy={busy} onChange={setWatchPage} /> : null}
          {data && !savedQueries.length ? <p className="muted">{data.watches.length ? l("没有匹配的关键词。", "No matching keywords.") : l("暂无已保存关键词。", "No saved keywords.")}</p> : null}
          {!data ? <p role="status">{l("正在读取已保存关键词…", "Reading saved keywords…")}</p> : null}
          </div>
        </section>
      </div>
      <div role="tabpanel" id="scout-wishlist" aria-labelledby="tab-wishlist" hidden={tab !== "wishlist"}>
        {data ? <ScoutWishlist data={data} busy={busy} saving={submitting} mutate={mutate} openWatch={openWatch} visible={tab === "wishlist"} focusWish={wishFocus} view={wishView} onViewChange={view => { setWishView(view); setWishFocus(null); }} /> : <p role="status">{l("正在读取寻卡记录…", "Reading scout records…")}</p>}
      </div>
  </div>;
}
