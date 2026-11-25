"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
type Status = { version: string; ready: boolean; generating: boolean; candidate: string | null; failure: string | null; hasKey: boolean };

export function CardStudioPanel({ id }: { id: string }) {
  const en = useLanguage().locale === "en";
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/studio?id=" + encodeURIComponent(id), { cache: "no-store" });
    if (!response.ok) throw new Error();
    setStatus(await response.json());
  }, [id]);
  const loadError = en ? "Could not load studio status." : "无法读取展馆图状态。";
  useEffect(() => {
    void refresh().catch(() => setError(loadError));
    // A background job may start just after a save redirects to this page.
    const timer = setInterval(() => { if (!document.hidden) void refresh().catch(() => setError(loadError)); }, 5000);
    return () => clearInterval(timer);
  }, [refresh, loadError]);
  async function act(action?: string) {
    if (!status || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, version: status.version, candidate: status.candidate }) });
      if (!response.ok) throw new Error((await response.json()).error);
    } catch (e) { setError(e instanceof Error ? e.message : loadError); }
    finally { await refresh().catch(() => setError(loadError)); setBusy(false); }
  }
  const working = busy || status?.generating;
  const label = working ? (en ? "Processing…" : "处理中…") : status?.candidate ? (en ? "Preview ready" : "待确认新图")
    : status?.failure ? (en ? "Last attempt failed" : "上次生成失败") : status?.ready ? (en ? "Ready" : "已生成") : (en ? "Pending" : "待生成");
  const reasons: Record<string, string> = en
    ? { key: "OpenAI key missing", quota: "Check quota or rate limits", access: "Check key and model access", generation: "Check the network and original image" }
    : { key: "缺少 OpenAI 密钥", quota: "请检查额度或请求频率", access: "请检查密钥与模型权限", generation: "请检查网络与首图" };
  const image = "/api/studio?image=" + encodeURIComponent(status?.version ?? "");
  return <section id="studio-image" className="card-studio-panel">
    <header className="studio-panel-heading">
      <h3>{en ? "AI studio image" : "AI 展馆图"}</h3>
      {status && <div className="studio-panel-tools">
        <span role="status">{label}{!working && status.failure && !status.candidate && " · " + (reasons[status.failure] ?? reasons.generation)}</span>
        {status.candidate ? <>
          <button type="button" className="btn btn-primary" disabled={working} onClick={() => act("adopt")}>{en ? "Use new image" : "采用新图"}</button>
          <button type="button" className="btn btn-secondary" disabled={working} onClick={() => act("discard")}>{en ? "Discard preview" : "放弃新图"}</button>
        </> : <button type="button" className="btn btn-secondary" disabled={working || !status.hasKey} onClick={() => act(status.ready ? "redo" : undefined)}>
          {status.ready ? (en ? "Regenerate" : "重新生成") : (en ? "Generate" : "生成展馆图")}</button>}
      </div>}
    </header>
    {status && !status.hasKey && !status.candidate && <small className="studio-key-link"><a href="/settings?section=ai#ai-settings">{en ? "Configure OpenAI key" : "配置 OpenAI 密钥"}</a></small>}
    {error && <span role="alert">{error}</span>}
    {status?.candidate ? <div className="studio-compare">
      {status.ready && <figure><img src={image} alt="" /><figcaption>{en ? "Current" : "当前成品"}</figcaption></figure>}
      <figure><img src={image + "&candidate=" + status.candidate} alt="" /><figcaption>{en ? "New preview" : "新图预览"}</figcaption></figure>
    </div> : status?.ready && <div className="studio-photo-frame"><img className="studio-current-photo" src={"/api/immersive?studio=thumbnail&id=" + encodeURIComponent(id)} alt={en ? "Current studio image" : "当前展馆图"} /></div>}
  </section>;
}
