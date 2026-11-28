"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "./language-provider";
import { maxStoredImageBytes } from "@/lib/card-image-limits.js";

type Status = { version: string; assetVersion: string | null; ready: boolean; generating: boolean; candidate: string | null; failure: string | null; hasKey: boolean };

export function CardStudioPanel({ id }: { id: string }) {
  const en = useLanguage().locale === "en";
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const filePicker = useRef<HTMLInputElement>(null);
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
  async function act(action?: "redo" | "adopt" | "discard" | File) {
    if (!status || busy) return;
    setBusy(true); setError("");
    try {
      let options: RequestInit;
      if (action instanceof File) {
        if (action.size > maxStoredImageBytes) throw new Error(en ? "Choose an image of 15 MB or less." : "展馆图不能超过 15MB。");
        const form = new FormData();
        form.set("id", id);
        form.set("version", status.version);
        form.set("image", action);
        options = { method: "POST", body: form };
      } else {
        options = { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, version: status.version, candidate: status.candidate }) };
      }
      const response = await fetch("/api/studio", options);
      if (!response.ok) throw new Error((await response.json()).error);
    } catch (e) { setError(e instanceof Error ? e.message : loadError); }
    finally { await refresh().catch(() => setError(loadError)); setBusy(false); }
  }
  const working = busy || status?.generating;
  const reasons: Record<string, string> = en
    ? { key: "OpenAI key missing", quota: "Check quota or rate limits", access: "Check key and model access", generation: "Check the network and original image" }
    : { key: "缺少 OpenAI 密钥", quota: "请检查额度或请求频率", access: "请检查密钥与模型权限", generation: "请检查网络与首图" };
  const [reason, ...details] = (status?.failure ?? "").split(" ");
  const requestId = details.find(item => item.startsWith("req_"));
  const stage = details.find(item => item.startsWith("stage="))?.slice(6);
  const categories = details.filter(item => item.startsWith("category=")).map(item => item.slice(9));
  const stageLabels: Record<string, string> = en
    ? { input: "Request input", output: "Generated image", unknown: "Unknown stage" }
    : { input: "请求输入", output: "生成结果", unknown: "阶段未知" };
  const lastFailure = reason === "moderation_blocked"
    ? (en ? "Blocked by OpenAI safety review" : "OpenAI 安全审核已拦截") + (requestId ? " · " + requestId : "")
    : reasons[reason] ?? reasons.generation;
  const image = "/api/studio?image=" + encodeURIComponent(status?.version ?? "");
  const assetQuery = "&v=" + encodeURIComponent(status?.assetVersion ?? "");
  const discardButton = <button type="button" className="btn btn-secondary" disabled={working} onClick={() => act("discard")}>
    {status?.ready ? (en ? "Keep original image" : "保留原图") : (en ? "Discard preview" : "放弃新图")}
  </button>;
  return <section id="studio-image" className="card-studio-panel" aria-busy={Boolean(working)}>
    <header className="studio-panel-heading">
      <h3>{en ? "AI studio image" : "AI 展馆图"}</h3>
      {status && !status.candidate && <div className="studio-panel-tools">
          <button type="button" className="btn btn-secondary" disabled={working || !status.hasKey} onClick={() => act(status.ready ? "redo" : undefined)}>
          {status.ready ? (en ? "Regenerate" : "重新生成") : (en ? "Generate" : "生成展馆图")}</button>
          <input ref={filePicker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void act(file);
          }} />
          <button type="button" className="btn btn-secondary" disabled={working} onClick={() => filePicker.current?.click()}>
            {en ? "Upload studio image" : "上传展馆图"}
          </button>
      </div>}
    </header>
    {status && !status.hasKey && !status.candidate && <small className="studio-key-link"><a href="/settings?section=ai#ai-settings">{en ? "Configure OpenAI key" : "配置 OpenAI 密钥"}</a></small>}
    {!working && status?.failure && !status.candidate && !error && <small>{lastFailure}</small>}
    {reason === "moderation_blocked" && !status?.candidate && (stage || categories.length > 0) &&
      <details><summary>{en ? "Review details" : "审核详情"}</summary>
        {stage && <div>{en ? "Stage" : "审核阶段"} · {stageLabels[stage] ?? stage}</div>}
        {categories.length > 0 && <div>{en ? "Categories" : "类别"} · {categories.join(", ")}</div>}
      </details>}
    {error && <span role="alert">{error}</span>}
    {status?.candidate ? <div className="studio-compare">
      {status.ready && <figure><img src={image + assetQuery} alt={en ? "Current studio image" : "当前展馆图"} />
        <figcaption>{discardButton}</figcaption>
      </figure>}
      <figure><img src={image + "&candidate=" + status.candidate} alt={en ? "Proposed studio image" : "待采用的展馆图"} />
        <figcaption>
          <button type="button" className="btn btn-secondary" disabled={working} onClick={() => act("adopt")}>{en ? "Use new image" : "采用新图"}</button>
          {!status.ready && discardButton}
        </figcaption>
      </figure>
    </div> : status?.ready && <div className="studio-photo-frame"><img className="studio-current-photo" src={"/api/immersive?studio=thumbnail&id=" + encodeURIComponent(id) + assetQuery} alt={en ? "Current studio image" : "当前展馆图"} /></div>}
  </section>;
}
