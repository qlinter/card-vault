"use client";

import { useState } from "react";

export type ShareThemeCard = {
  id: string;
  playerName: string;
  cardTitle: string;
  sport: string;
  team: string | null;
  year: string | null;
  brand: string | null;
  productLine: string | null;
  subsetName: string | null;
  parallel: string | null;
  cardNumber: string | null;
  serialNumber: string | null;
  serialRange: string | null;
  isRookie: boolean;
  isAutograph: boolean;
  autoType: string | null;
  isPatch: boolean;
  patchType: string | null;
  gradingCompany: string | null;
  grade: string | null;
  certNumber: string | null;
  publicDescription: string | null;
};

export const shareThemeFields = ["title", "subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes"] as const;

export type ShareThemeField = (typeof shareThemeFields)[number];
export type ShareThemeValues = Record<ShareThemeField, string>;

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
  const [status, setStatus] = useState<string>("选择卡片后，可用 AI 生成展馆文案。");
  const [loading, setLoading] = useState(false);

  async function generateTheme() {
    if (cards.length === 0) {
      setStatus("请先选择至少一张卡片。");
      return;
    }

    setLoading(true);
    setStatus("AI 正在生成分享集主题...");

    try {
      const response = await fetch("/api/ai/share-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: currentValues, cards })
      });
      const data = (await response.json()) as { suggestion?: Partial<Record<ShareThemeField, unknown>>; error?: string };

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
      setStatus(error instanceof Error ? error.message : "AI 主题生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="share-ai-panel">
      <div>
        <strong>AI 生成主题</strong>
        <p className="muted">基于已选卡片生成中文展馆标题、封面介绍、收藏叙事和分组说明。</p>
      </div>
      <div className="share-ai-actions">
        <label className="inline-check">
          <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
          覆盖当前文案
        </label>
        <button type="button" className="btn btn-primary" onClick={generateTheme} disabled={loading}>
          {loading ? "生成中..." : "生成主题"}
        </button>
      </div>
      <p className="muted">{status}</p>
    </section>
  );
}
