"use client";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ViewModeToggle, useViewMode } from "./view-mode-toggle";
import { useLanguage } from "./language-provider";
import { importFields, guessMapping, type ImportMapping, type ImportField } from "@/lib/data-center-fields";
type Job = { id: string; kind: string; status: string; rows: Array<{ id: string; rowNumber: number; status: string; error: string | null; cardId: string | null; values: Record<string, string | boolean> }> };
type Item = { id: string; playerName: string; cardTitle: string; details: string; tags: string[] };
async function request(body: unknown) {
  const response = await fetch("/api/data-center", body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
}
export function DataCenter({ children, embedded = false }: { children?: ReactNode; embedded?: boolean }) {
  const { locale, t } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [table, setTable] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({}), [policy, setPolicy] = useState("skip");
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [q, setQ] = useState(""), [items, setItems] = useState<Item[]>([]), [page, setPage] = useState(0), [count, setCount] = useState(0), [selected, setSelected] = useState<string[]>([]);
  const [publicOnly, setPublicOnly] = useState(false), [rowLimit, setRowLimit] = useState(100);
  const [stop, setStop] = useState(false);
  const [view, setView] = useViewMode("data", "list");
  const tableView = view === "table";
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#data-export") {
      const params = new URLSearchParams(window.location.search);
      const savedPage = Number(params.get("exportPage"));
      setQ(params.get("exportQ") ?? "");
      setPage(Number.isSafeInteger(savedPage) && savedPage >= 0 ? savedPage : 0);
      setPublicOnly(params.get("exportPublic") === "true");
      const savedView = params.get("exportView");
      if (savedView === "list" || savedView === "table") setView(savedView);
      const snapshot = window.history.state?.cardVaultExport;
      if (snapshot?.url === window.location.pathname + window.location.search + window.location.hash && Array.isArray(snapshot.selected)) {
        setSelected([...new Set<string>(snapshot.selected.filter((id: unknown): id is string => typeof id === "string").slice(0, 10000))]);
      }
    }
    setRestored(true);
  }, [setView]);
  const returnParams = new URLSearchParams({ exportQ: q, exportPage: String(page), exportPublic: String(publicOnly), exportView: tableView ? "table" : "list" });
  const returnTo = (embedded ? "/settings" : "/settings/data") + "?" + returnParams + "#data-export";
  const cardHref = (id: string) => "/cards/" + encodeURIComponent(id) + "?returnTo=" + encodeURIComponent(returnTo);
  function rememberExport(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Keep the framework's history fields and attach state to this exact entry.
    window.history.replaceState({ ...window.history.state, cardVaultExport: { url: returnTo, selected } }, "", returnTo);
  }
  useEffect(() => {
    if (!restored) return;
    const controller = new AbortController();
    void fetch(`/api/cards?q=${encodeURIComponent(q)}&page=${page}`, { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error("加载失败，请重试。"); return response.json(); }).then(data => { setItems(data.cards); setCount(data.totalCount); }).catch(error => { if (!controller.signal.aborted) setError(String(error)); });
    return () => controller.abort();
  }, [q, page, job?.status, restored]);
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function execute(undo: boolean) {
    if (!job) return;
    let cursor: number | undefined;
    do {
      const result = await request({ action: undo ? "undo" : "apply", id: job.id, cursor });
      setJob(result); cursor = result.nextCursor ?? undefined;
    } while (cursor !== undefined);
    setStop(false);
  }
  const statusLabel = (status: string) => ({ preview: l("待预演确认", "Preview ready"), running: l("执行中", "Running"), complete: l("已完成", "Complete"), partial: l("部分完成", "Partially complete"), "undo-running": l("撤销中", "Undoing"), "undo-partial": l("部分撤销", "Partially undone"), pending: l("待执行", "Pending"), applied: l("已完成", "Applied"), failed: l("失败", "Failed"), skipped: l("跳过", "Skipped"), undone: l("已撤销", "Undone"), "undo-failed": l("撤销冲突", "Undo conflict") }[status] ?? status);
  return <div className={embedded ? "management-page data-workspace" : "page management-page data-workspace"}>
    {!embedded ? <header className="title-row"><h1 className="h1">{l("数据", "Data")}</h1><a className="btn btn-secondary" href="/settings">{l("返回设置", "Back to Settings")}</a></header> : null}
    {children}
    {error ? <p className="note-error" role="alert">{t(error)}</p> : null}
    <section className="panel management-section"><h2>{l("导入", "Import")}</h2>
      <label>{l("选择文件", "Choose file")}<input type="file" accept=".csv,.xlsx" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void run(async () => { const data = new FormData(); data.set("file", file); const result = await request(data); setTable(result); setMapping(guessMapping(result.headers)); setJob(null); }); }} /></label>
      {table ? <><p>{table.rows.length} {l("行数据", "rows")}</p><div className="mapping-grid">{table.headers.map(header => <label key={header}><span>{header}</span><select value={mapping[header] ?? ""} onChange={event => setMapping({ ...mapping, [header]: event.target.value as ImportField | "" })}><option value="">{l("忽略此列", "Ignore column")}</option>{Object.entries(importFields).map(([key, label]) => <option key={key} value={key}>{locale === "en" ? t(label) : label}</option>)}</select><small className="muted">{table.rows[0][table.headers.indexOf(header)]}</small></label>)}</div>
        <label>{l("重复卡片", "Duplicate cards")}<select value={policy} onChange={event => setPolicy(event.target.value)}><option value="skip">{l("跳过重复", "Skip duplicates")}</option><option value="update">{l("更新档案字段", "Update archive fields")}</option><option value="separate">{l("作为独立实物新增", "Create separate physical cards")}</option></select></label>
        <button className="btn" disabled={busy} onClick={() => void run(async () => { setJob(await request({ action: "preview", ...table, mapping, policy })); setRowLimit(100); })}>{l("建立导入预演", "Preview import")}</button></> : null}
    </section>
    <section id="data-export" className="panel management-section"><h2>{l("导出", "Export")}</h2><div className="export-controls"><label className="export-search">{l("搜索收藏", "Search cards")}<input value={q} onChange={event => { setQ(event.target.value); setPage(0); setSelected([]); }} /></label><label className="export-public"><input type="checkbox" checked={publicOnly} onChange={event => setPublicOnly(event.target.checked)} />{l("仅导出公开档案", "Export public archives only")}</label>{["csv", "xlsx"].map(format => <a className="btn btn-secondary" key={format} href={`/api/data-center?export=${format}&q=${encodeURIComponent(q)}&publicOnly=${publicOnly}`}>{format.toUpperCase()}</a>)}</div>
      <div className="collection-view-toolbar"><div className="selection-actions"><button className="btn btn-secondary" onClick={() => setSelected([...new Set([...selected, ...items.map(item => item.id)])])}>{l("选中本页", "Select page")}</button><button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { const response = await fetch(`/api/data-center?selection=true&q=${encodeURIComponent(q)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(data.ids); })}>{l("选择全部", "Select all")}</button><button className="btn btn-secondary" onClick={() => setSelected([])}>{l("清空选择", "Clear selection")}</button><span>{selected.length} / {count}</span></div><ViewModeToggle value={tableView ? "table" : "list"} onChange={setView} modes={["list", "table"]} /></div>
      {tableView ? <div className="management-table"><table><thead><tr>{[l("选择", "Select"),l("卡片主体", "Subject"),l("卡片名称", "Card title"),l("资料", "Details"),l("标签", "Tags")].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{items.map(item => <tr key={item.id}><td><input type="checkbox" aria-label={item.cardTitle} checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected,item.id] : selected.filter(id => id !== item.id))} /></td><td><a className="export-card-link" href={cardHref(item.id)} onClick={rememberExport}>{item.playerName}</a></td><td><a className="export-card-link" href={cardHref(item.id)} onClick={rememberExport}>{item.cardTitle}</a></td><td>{item.details}</td><td>{item.tags.join(", ")}</td></tr>)}</tbody></table></div> :
      <div className="management-card-list">{items.map(item => <div className="management-card-option" key={item.id}><input type="checkbox" aria-label={item.cardTitle} checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} /><a className="export-card-link" href={cardHref(item.id)} onClick={rememberExport}>{item.playerName}<small>{item.cardTitle}</small></a></div>)}</div>}
      <nav className="export-pagination" aria-label={l("导出分页", "Export pagination")}><button className="btn btn-secondary" disabled={!page} onClick={() => setPage(page - 1)}>{l("上一页", "Previous")}</button><span>{page + 1} / {Math.max(1, Math.ceil(count / 24))}</span><button className="btn btn-secondary" disabled={(page + 1) * 24 >= count} onClick={() => setPage(page + 1)}>{l("下一页", "Next")}</button></nav>
    </section>
    {job ? <section className="panel management-section" aria-live="polite"><h2>{l("批次预演与结果", "Batch preview & results")}</h2><p>{job.id} · {statusLabel(job.status)} · {job.rows.length}</p><div className="management-toolbar">{["pending", "applied", "failed", "skipped", "undone", "undo-failed"].map(status => <span key={status}>{statusLabel(status)}: {job.rows.filter(row => row.status === status).length}</span>)}</div><div className="management-table"><table><thead><tr>{[l("行", "Row"), l("数据", "Data"), l("状态", "Status"), l("结果", "Result")].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{job.rows.slice(0, rowLimit).map(row => <tr key={row.id}><td>{row.rowNumber}</td><td>{Object.entries(row.values).map(([key, value]) => `${key}: ${value}`).join(" · ")}</td><td>{statusLabel(row.status)}</td><td>{row.error ? t(row.error) : row.cardId ? <a href={`/cards/${row.cardId}`}>{row.cardId}</a> : "—"}</td></tr>)}</tbody></table></div>{rowLimit < job.rows.length ? <button className="btn btn-secondary" onClick={() => setRowLimit(rowLimit + 100)}>{l("显示更多结果", "Show more results")}</button> : null}
      <div className="management-toolbar"><button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { setJob(await request({action:"repreview",id:job.id})); })}>{l("重新建立预演", "Create fresh preview")}</button><button className="btn" disabled={busy || !job.rows.some(row => ["pending", "failed"].includes(row.status)) || job.status === "undone"} onClick={() => void run(() => execute(false))}>{busy ? l("处理中…", "Processing…") : l("执行 / 重试失败行", "Apply / retry failed rows")}</button><button className="btn btn-secondary" disabled={busy || !job.rows.some(row => ["applied", "undo-failed"].includes(row.status))} onClick={() => setStop(true)}>{l("撤销本批次", "Undo this batch")}</button></div>{stop ? <p className="note-error">{l("将恢复本批次修改前的值，并删除本批次新建卡片。后续已修改的卡片会保留并提示冲突。", "Restore previous values and delete cards created by this batch. Later edits are preserved and reported as conflicts.")} <button className="btn" disabled={busy} onClick={() => void run(() => execute(true))}>{l("确认撤销", "Confirm undo")}</button> <button className="btn btn-secondary" onClick={() => setStop(false)}>{l("取消", "Cancel")}</button></p> : null}
    </section> : null}
  </div>;
}
