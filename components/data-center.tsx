"use client";
import { useRef, useState, type ReactNode } from "react";
import { ImportJobResults } from "./import-job-results";
import { SettingsDisclosure } from "./settings-disclosure";
import { useLanguage } from "./language-provider";
import { importFields, guessMapping, type ImportMapping, type ImportField } from "@/lib/data-center-fields";
import { mergeImportJobDelta, type ImportJobPage as Job, type ImportJobDelta } from "@/lib/import-job-state";
async function request(body: unknown) {
  const response = await fetch("/api/data-center", body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
}
export function DataCenter({ children, maintenance, embedded = false }: { children?: ReactNode; maintenance?: ReactNode; embedded?: boolean }) {
  const { locale, t } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [table, setTable] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({}), [policy, setPolicy] = useState("skip");
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [publicOnly, setPublicOnly] = useState(false);
  const pauseRequested = useRef(false);
  const [paused, setPaused] = useState(false);
  const [stop, setStop] = useState(false);
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function execute(undo: boolean) {
    if (!job) return;
    pauseRequested.current = false;
    setPaused(false);
    let cursor: number | undefined;
    do {
      const result = await request({ action: undo ? "undo" : "apply", id: job.id, cursor });
      setJob(current => mergeImportJobDelta(current, result as ImportJobDelta)); cursor = result.nextCursor ?? undefined;
    } while (cursor !== undefined && !pauseRequested.current);
    setPaused(cursor !== undefined && pauseRequested.current);
    setStop(false);
  }
  async function loadMoreRows() {
    if (!job || job.nextRow === null) return;
    const response = await fetch(`/api/data-center?id=${encodeURIComponent(job.id)}&after=${job.nextRow}`);
    const next = await response.json();
    if (!response.ok) throw new Error(next.error);
    setJob(current => current && current.id === next.id ? { ...next, rows: [...current.rows, ...next.rows] } : current);
  }
  return <div className={embedded ? "management-page data-workspace" : "page management-page data-workspace settings-surface"}>
    {!embedded ? <header className="title-row"><h1 className="h1">{l("数据", "Data")}</h1><a className="btn btn-secondary" href="/settings">{l("返回设置", "Back to Settings")}</a></header> : null}
    {children}
    {error ? <p className="note-error" role="alert">{t(error)}</p> : null}
    <SettingsDisclosure id="data-transfer" zh="导入与导出" en="Import & export" aliases={["data-export"]}>
    <section className="panel management-section"><h2>{l("导入", "Import")}</h2>
      <label className="import-file-field"><span>{l("选择文件", "Choose file")}</span><input type="file" accept=".csv,.xlsx" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void run(async () => { const data = new FormData(); data.set("file", file); const result = await request(data); setTable(result); setMapping(guessMapping(result.headers)); setJob(null); }); }} /></label>
      {table ? <><p>{table.rows.length} {l("行数据", "rows")}</p><div className="mapping-grid import-mapping-grid">{table.headers.map(header => <label key={header}><span title={header}>{header}</span><select title={mapping[header] ? t(importFields[mapping[header] as ImportField]) : l("忽略此列", "Ignore column")} value={mapping[header] ?? ""} onChange={event => setMapping({ ...mapping, [header]: event.target.value as ImportField | "" })}><option value="">{l("忽略此列", "Ignore column")}</option>{Object.entries(importFields).map(([key, label]) => <option key={key} value={key}>{locale === "en" ? t(label) : label}</option>)}</select><small className="muted" title={table.rows[0][table.headers.indexOf(header)]}>{table.rows[0][table.headers.indexOf(header)]}</small></label>)}</div>
        <div className="import-options"><label><span>{l("重复卡片", "Duplicate cards")}</span><select value={policy} onChange={event => setPolicy(event.target.value)}><option value="skip">{l("跳过重复", "Skip duplicates")}</option><option value="update">{l("更新档案字段", "Update archive fields")}</option><option value="separate">{l("作为独立实物新增", "Create separate physical cards")}</option></select></label>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { setJob(await request({ action: "preview", ...table, mapping, policy })); setPaused(false); })}>{l("建立导入预演", "Preview import")}</button></div></> : null}
    </section>
    <section id="data-export" className="panel management-section"><div className="title-row"><h2>{l("导出全部数据", "Export all data")}</h2><a href="/?export=1" className="scope-navigation-link">{l("前往收藏筛选与导出", "Filter and export from Collection")} →</a></div>
      <form method="post" action="/api/data-center" className="management-toolbar">
        <input type="hidden" name="action" value="export" /><input type="hidden" name="publicOnly" value={String(publicOnly)} />
        <label className="export-public"><input type="checkbox" checked={publicOnly} onChange={event => setPublicOnly(event.target.checked)} />{l("仅导出公开档案", "Export public archives only")}</label>
        {["csv", "xlsx"].map(format => <button type="submit" name="format" value={format} className="btn btn-secondary" key={format}>{format.toUpperCase()}</button>)}
      </form>
    </section>
    {job ? <ImportJobResults job={job} busy={busy} paused={paused} stop={stop}
      onMore={() => void run(loadMoreRows)}
      onRepreview={() => void run(async () => { setJob(await request({ action: "repreview", id: job.id })); setPaused(false); })}
      onApply={() => void run(() => execute(false))} onPause={() => { pauseRequested.current = true; }}
      onUndoRequest={() => setStop(true)} onUndoConfirm={() => void run(() => execute(true))} onUndoCancel={() => setStop(false)} /> : null}

    </SettingsDisclosure>
    {maintenance ? <SettingsDisclosure id="data-maintenance" zh="维护" en="Maintenance">{maintenance}</SettingsDisclosure> : null}
  </div>;
}
