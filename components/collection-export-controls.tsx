"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./language-provider";
import { buildQueryHref } from "@/lib/query-params";
import { maximumExportSelection, restoreCollectionExport, saveCollectionExport } from "@/lib/collection-export-state";

export function useCollectionExport(historyKey: string, enabled: boolean) {
  const [selected, setSelected] = useState<string[]>([]);
  const [publicOnly, setPublicOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const saved = restoreCollectionExport(window.history.state, historyKey);
    setSelected(saved.selected);
    setPublicOnly(saved.publicOnly);
    setReady(true);
  }, [historyKey, enabled]);
  useEffect(() => {
    if (enabled && ready) window.history.replaceState(saveCollectionExport(window.history.state, { url: historyKey, selected, publicOnly }), "");
  }, [historyKey, enabled, ready, selected, publicOnly]);
  function choose(ids: string[], append = false) {
    const next = [...new Set(append ? [...selected, ...ids] : ids)];
    if (next.length > maximumExportSelection) { setError("一次最多选择 10000 张卡片，请缩小筛选范围。"); return; }
    setError("");
    setSelected(next);
  }
  async function selectAll() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const url = new URL(historyKey, window.location.origin);
      url.pathname = "/api/data-center";
      url.searchParams.set("selection", "true");
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      choose(data.ids);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return { selected, publicOnly, setPublicOnly, choose, selectAll, busy: busy || !ready, error };
}

export function CollectionExportControls({ selection, query, loadedIds, totalCount }: { selection: ReturnType<typeof useCollectionExport>; query: Record<string, string | undefined>; loadedIds: string[]; totalCount: number }) {
  const { locale, t } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  return <section className="collection-export panel" aria-label={l("导出收藏", "Export collection")}>
    <div className="collection-export-heading"><div><h2>{l("导出收藏", "Export collection")}</h2><p>{selection.selected.length ? l(`已选 ${selection.selected.length} 张`, `${selection.selected.length} selected`) : l(`当前筛选共 ${totalCount} 张，未选卡片时导出全部结果`, `${totalCount} matching cards. With no selection, all results are exported.`)}</p></div><Link href={buildQueryHref("/", query)} className="scope-navigation-link">{l("结束导出", "Close export")}</Link></div>
    <div className="collection-export-actions">
      <div className="selection-actions"><button type="button" className="btn btn-secondary" disabled={selection.busy || !loadedIds.length} onClick={() => selection.choose(loadedIds, true)}>{l("选中已加载", "Select loaded")}</button><button type="button" className="btn btn-secondary" disabled={selection.busy || !totalCount} onClick={() => void selection.selectAll()}>{l("选择全部结果", "Select all results")}</button><button type="button" className="btn btn-secondary" disabled={selection.busy || !selection.selected.length} onClick={() => selection.choose([])}>{l("清空选择", "Clear selection")}</button></div>
      <form method="post" action="/api/data-center" className="collection-export-download">
        <input type="hidden" name="action" value="export" />
        {Object.entries(query).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
        <input type="hidden" name="publicOnly" value={String(selection.publicOnly)} />
        {selection.selected.length ? <input type="hidden" name="ids" value={JSON.stringify(selection.selected)} /> : null}
        <label className="export-public"><input type="checkbox" checked={selection.publicOnly} disabled={selection.busy} onChange={event => selection.setPublicOnly(event.target.checked)} />{l("仅导出公开档案", "Export public archives only")}</label>
        {["csv", "xlsx"].map(format => <button key={format} type="submit" name="format" value={format} className="btn btn-secondary" disabled={selection.busy || !totalCount} title={selection.selected.length ? l("导出选中的卡片", "Export selected cards") : l("导出当前筛选结果", "Export current results")}>{format.toUpperCase()}</button>)}
      </form>
    </div>
    {selection.error ? <p className="note-error" role="alert">{t(selection.error)}</p> : null}
  </section>;
}
