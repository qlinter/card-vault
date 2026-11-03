"use client";

import { UiText } from "@/components/ui-text";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/feedback-messages";

import { type ShareThemeCard, type ShareThemeField, type ShareThemeValues } from "@/lib/share-theme-domain";

type ShareThemeGeneratorProps = {
  cards: ShareThemeCard[];
  currentValues: ShareThemeValues;
  onApplySuggestion: (suggestion: Partial<Record<ShareThemeField, unknown>>, overwrite: boolean) => ShareThemeField[];
};

function fieldLabel(field: ShareThemeField): string {
  switch (field) {
    case "title":
      return "标题";
    case "subtitle":
      return "副标题";
    case "description":
      return "封面介绍";
    case "themeNarrative":
      return "展馆叙事";
    case "themeHighlights":
      return "收藏亮点";
    case "groupNotes":
      return "主题分组";
  }
}

export function ShareThemeGenerator({ cards, currentValues, onApplySuggestion }: ShareThemeGeneratorProps) {
  const [overwrite, setOverwrite] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  async function generateTheme() {
    if (cards.length === 0) {
      setStatus("请先选择至少一张卡片。");
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setStatus("AI 正在生成分享集主题...");

    try {
      const response = await fetch("/api/ai/share-theme", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: currentValues, cards })
      });
      const data = (await response.json()) as { suggestion?: Partial<Record<ShareThemeField, unknown>>; error?: string };
      if (controller.signal.aborted) return;

      if (!response.ok || data.error) {
        throw new Error(data.error || `AI 主题生成失败：${response.status}`);
      }

      const filledFields = onApplySuggestion(data.suggestion ?? {}, overwrite);
      const filledLabels = filledFields.map(fieldLabel);

      setStatus(
        filledLabels.length > 0
          ? `已生成并填入：${filledLabels.join("、")}。`
          : "AI 已生成主题；当前字段已有内容，未覆盖。"
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const detail = errorMessage(error, "");
      setStatus(
        detail === "Failed to fetch"
          ? "无法连接 Card Vault 本地服务，请重新启动程序后重试。"
          : detail || "AI 主题生成失败，请稍后重试。"
      );
    } finally {
      if (!controller.signal.aborted && activeRequest.current === controller) setLoading(false);
    }
  }

  return (
    <section className="share-ai-panel">
      <div>
        <strong><UiText text={"AI 生成主题"} /></strong>
      </div>
      <div className="share-ai-actions">
        <label className="inline-check">
          <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} /><UiText text={"覆盖当前文案"} /></label>
        <button type="button" className="btn btn-primary" onClick={generateTheme} disabled={loading}>
          {loading ? <UiText text={"生成中..."} /> : <UiText text={"生成主题"} />}
        </button>
      </div>
      {status ? <p className="muted" role="status">{status}</p> : null}
    </section>
  );
}
