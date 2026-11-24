"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";

type Inventory = { ready: number; pending: string[]; missingFront: number };

export function StudioRecovery({ hasKey }: { hasKey: boolean }) {
  const { locale } = useLanguage(), en = locale === "en";
  const [inventory, setInventory] = useState<Inventory>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/studio", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!controller.signal.aborted) setInventory(result);
    }).catch(() => { if (!controller.signal.aborted) setError(en ? "Could not load studio images." : "无法读取展馆图状态。"); });
    return () => controller.abort();
  }, [en, hasKey]);

  async function resume() {
    if (!inventory || busy || !hasKey) return;
    setBusy(true); setError("");
    try {
      for (const id of inventory.pending) {
        const response = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (!response.ok) throw new Error((await response.json()).error);
        setInventory(current => current && ({ ...current, ready: current.ready + 1, pending: current.pending.filter(item => item !== id) }));
      }
    } catch (problem) { setError(problem instanceof Error ? problem.message : (en ? "Generation failed." : "生成失败。")); }
    finally { setBusy(false); }
  }
  return <section className="studio-recovery">
    <div className="studio-recovery-heading">
      <h3>{en ? "AI studio images" : "AI 展馆图"}</h3>
      {inventory && <p className="studio-recovery-counts" role="status" aria-atomic="true">
        <span>{en ? "Ready" : "已生成"} <strong>{inventory.ready}</strong></span>
        <span>{en ? "Pending" : "待生成"} <strong>{inventory.pending.length}</strong></span>
      </p>}
    </div>
    {!hasKey && <p className="muted">{en ? "Save an OpenAI key to generate missing images. Original images remain available." : "配置 OpenAI Key 后可补生成。缺图时展馆使用原始首图。"}</p>}
    {inventory && inventory.pending.length > 0 && <button type="button" className="btn btn-secondary" disabled={!hasKey || busy} onClick={resume}>{busy ? (en ? "Generating…" : "生成中…") : (en ? "Generate missing images" : "补生成展馆图")}</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
