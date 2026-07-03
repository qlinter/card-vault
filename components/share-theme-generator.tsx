"use client";

import { useMemo, useState } from "react";

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

type ShareThemeGeneratorProps = {
  cards: ShareThemeCard[];
};

const targetFields = ["title", "subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes"] as const;

type TargetField = (typeof targetFields)[number];

function fieldLabel(field: TargetField): string {
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

function getField(name: string): HTMLInputElement | HTMLTextAreaElement | null {
  return document.querySelector(`[name="${name}"]`);
}

export function ShareThemeGenerator({ cards }: ShareThemeGeneratorProps) {
  const [overwrite, setOverwrite] = useState(false);
  const [status, setStatus] = useState<string>("选择卡片后，可用 AI 生成展馆文案。");
  const [loading, setLoading] = useState(false);
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  async function generateTheme() {
    const selectedIds = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cardIds"]:checked')).map(
      (input) => input.value
    );
    const selectedCards = selectedIds.map((id) => cardMap.get(id)).filter((card): card is ShareThemeCard => Boolean(card));

    if (selectedCards.length === 0) {
      setStatus("请先选择至少一张卡片。");
      return;
    }

    setLoading(true);
    setStatus("AI 正在生成分享集主题...");

    try {
      const current = Object.fromEntries(targetFields.map((field) => [field, getField(field)?.value ?? ""]));
      const response = await fetch("/api/ai/share-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, cards: selectedCards })
      });
      const data = (await response.json()) as { suggestion?: Partial<Record<TargetField, string>>; error?: string };

      if (!response.ok || data.error) {
        throw new Error(data.error || `AI 主题生成失败：${response.status}`);
      }

      let filled = 0;
      for (const field of targetFields) {
        const value = data.suggestion?.[field]?.trim();
        const input = getField(field);
        if (!value || !input) {
          continue;
        }
        if (!overwrite && input.value.trim()) {
          continue;
        }
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        filled += 1;
      }

      const labels = targetFields
        .filter((field) => data.suggestion?.[field])
        .map(fieldLabel)
        .join("、");
      setStatus(filled > 0 ? `已生成并填入：${labels || "展馆文案"}。` : "AI 已生成主题；当前字段已有内容，未覆盖。");
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
        <button type="button" className="btn btn-secondary" onClick={generateTheme} disabled={loading}>
          {loading ? "生成中..." : "生成主题"}
        </button>
      </div>
      <p className="muted">{status}</p>
    </section>
  );
}
