"use client";

import type { FormEvent, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { ShareCardDraft, ShareCardPicker, SharePickerCard } from "@/components/share-card-picker";
import {
  ShareThemeCard,
  ShareThemeField,
  ShareThemeGenerator,
  ShareThemeValues,
  shareThemeFields
} from "@/components/share-theme-generator";

type ShareCollectionWizardProps = {
  action: (formData: FormData) => void | Promise<void>;
  cards: SharePickerCard[];
  aiCards: ShareThemeCard[];
  initialValues: ShareThemeValues & {
    coverImagePath: string;
  };
  error?: string;
};

const steps = [
  { id: 0, title: "选择球星卡", helper: "先挑出本次分享要展示的卡片。" },
  { id: 1, title: "AI 生成", helper: "基于已选卡片生成展馆主题文案。" },
  { id: 2, title: "内容修改", helper: "调整标题、封面介绍、叙事和单卡展示覆盖。" },
  { id: 3, title: "确认保存", helper: "检查卡片数量和隐私提示，然后保存分享集。" }
] as const;

function safeText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(safeText).filter(Boolean).join("\n");
  }
  return "";
}

function initialDrafts(cards: SharePickerCard[]): Record<string, ShareCardDraft> {
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      {
        sortOrder: String(card.sortOrder),
        displayTitle: card.displayTitle,
        displayDescription: card.displayDescription
      }
    ])
  );
}

function selectedLabels(cards: SharePickerCard[], selectedIds: string[], drafts: Record<string, ShareCardDraft>): string[] {
  const selectedSet = new Set(selectedIds);

  return cards
    .filter((card) => selectedSet.has(card.id))
    .sort((a, b) => {
      const aOrder = Number.parseInt(drafts[a.id]?.sortOrder ?? `${a.sortOrder}`, 10);
      const bOrder = Number.parseInt(drafts[b.id]?.sortOrder ?? `${b.sortOrder}`, 10);
      return aOrder - bOrder;
    })
    .map((card) => `${card.playerName} - ${card.cardTitle}`);
}

export function ShareCollectionWizard({ action, cards, aiCards, initialValues, error }: ShareCollectionWizardProps) {
  const initialCoverImagePath = initialValues.coverImagePath.startsWith("/share-covers/") ? initialValues.coverImagePath : "";
  const [activeStep, setActiveStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => cards.filter((card) => card.selected).map((card) => card.id));
  const [drafts, setDrafts] = useState(() => initialDrafts(cards));
  const [themeValues, setThemeValues] = useState<ShareThemeValues>({
    title: initialValues.title,
    subtitle: initialValues.subtitle,
    description: initialValues.description,
    themeNarrative: initialValues.themeNarrative,
    themeHighlights: initialValues.themeHighlights,
    groupNotes: initialValues.groupNotes
  });
  const [coverMode, setCoverMode] = useState<"auto" | "custom">(initialCoverImagePath ? "custom" : "auto");
  const [message, setMessage] = useState("");

  const selectedAiCards = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return aiCards.filter((card) => selectedSet.has(card.id));
  }, [aiCards, selectedIds]);
  const selectedCardLabels = useMemo(() => selectedLabels(cards, selectedIds, drafts), [cards, selectedIds, drafts]);

  function updateSelection(cardId: string, selected: boolean) {
    setSelectedIds((current) => {
      if (selected) {
        return current.includes(cardId) ? current : [...current, cardId];
      }
      return current.filter((id) => id !== cardId);
    });
  }

  function updateDraft(cardId: string, patch: Partial<ShareCardDraft>) {
    setDrafts((current) => ({
      ...current,
      [cardId]: {
        ...current[cardId],
        sortOrder: current[cardId]?.sortOrder ?? "0",
        displayTitle: current[cardId]?.displayTitle ?? "",
        displayDescription: current[cardId]?.displayDescription ?? "",
        ...patch
      }
    }));
  }

  function updateThemeField(field: ShareThemeField, value: string) {
    setThemeValues((current) => ({ ...current, [field]: value }));
  }

  function applySuggestion(suggestion: Partial<Record<ShareThemeField, unknown>>, overwrite: boolean): ShareThemeField[] {
    const filledFields: ShareThemeField[] = [];

    setThemeValues((current) => {
      const next = { ...current };
      for (const field of shareThemeFields) {
        const text = safeText(suggestion[field]);
        if (!text) {
          continue;
        }
        if (!overwrite && safeText(current[field])) {
          continue;
        }
        next[field] = text;
        filledFields.push(field);
      }
      return next;
    });

    return filledFields;
  }

  function goNext() {
    if (activeStep === 0 && selectedIds.length === 0) {
      setMessage("请至少选择一张卡片。");
      return;
    }
    setMessage("");
    setActiveStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function handleNextClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    goNext();
  }

  function goPrevious() {
    setMessage("");
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  function goToStep(stepId: number) {
    if (stepId > 0 && selectedIds.length === 0) {
      setMessage("请至少选择一张卡片。");
      return;
    }
    setMessage("");
    setActiveStep(stepId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (activeStep < steps.length - 1) {
      event.preventDefault();
      goNext();
      return;
    }
    if (selectedIds.length === 0) {
      event.preventDefault();
      setMessage("请至少选择一张卡片。");
      setActiveStep(0);
    }
  }

  return (
    <form action={action} className="share-form" onSubmit={handleSubmit} encType="multipart/form-data">
      {error ? <p className="note-error">{error}</p> : null}
      {message ? <p className="note-error">{message}</p> : null}

      <div className="share-wizard-header panel">
        <div className="share-wizard-steps" aria-label="分享集创建步骤">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              className={`share-wizard-step${activeStep === step.id ? " active" : ""}`}
              aria-current={activeStep === step.id ? "step" : undefined}
              onClick={(event) => {
                event.preventDefault();
                goToStep(step.id);
              }}
            >
              <span>{step.id + 1}</span>
              {step.title}
            </button>
          ))}
        </div>
        <div className="share-wizard-actions">
          <button type="button" className="btn btn-secondary" onClick={goPrevious} disabled={activeStep === 0}>
            上一步
          </button>
          {activeStep < steps.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={handleNextClick}>
              下一步
            </button>
          ) : (
            <button type="submit" className="btn btn-primary">
              确认保存
            </button>
          )}
          <a href="/shares" className="btn btn-secondary">
            返回分享
          </a>
        </div>
      </div>

      <section className="panel share-wizard-current">
        <p className="muted">第 {activeStep + 1} 步</p>
        <h2>{steps[activeStep].title}</h2>
        <p className="muted">{steps[activeStep].helper}</p>
        <p className="muted">当前已选择 {selectedIds.length} 张卡片</p>
      </section>

      <div className={activeStep === 0 ? "" : "share-step-hidden"}>
        <ShareCardPicker
          cards={cards}
          selectedIds={selectedIds}
          drafts={drafts}
          onSelectionChange={updateSelection}
          onDraftChange={updateDraft}
        />
      </div>

      <div className={activeStep === 1 ? "" : "share-step-hidden"}>
        <ShareThemeGenerator cards={selectedAiCards} currentValues={themeValues} onApplySuggestion={applySuggestion} />
      </div>

      <div className={activeStep === 2 ? "" : "share-step-hidden"}>
        <section className="panel share-section">
          <div className="form-grid">
            <label className="field">
              <span>分享集标题 *</span>
              <input name="title" value={themeValues.title} onChange={(event) => updateThemeField("title", event.target.value)} />
            </label>
            <label className="field">
              <span>副标题</span>
              <input name="subtitle" value={themeValues.subtitle} onChange={(event) => updateThemeField("subtitle", event.target.value)} />
            </label>
            <label className="field full">
              <span>封面介绍</span>
              <textarea name="description" value={themeValues.description} onChange={(event) => updateThemeField("description", event.target.value)} />
            </label>
            <label className="field full">
              <span>展馆叙事</span>
              <textarea
                name="themeNarrative"
                value={themeValues.themeNarrative}
                onChange={(event) => updateThemeField("themeNarrative", event.target.value)}
              />
            </label>
            <label className="field full">
              <span>收藏亮点</span>
              <textarea
                name="themeHighlights"
                value={themeValues.themeHighlights}
                onChange={(event) => updateThemeField("themeHighlights", event.target.value)}
              />
            </label>
            <label className="field full">
              <span>主题分组</span>
              <textarea name="groupNotes" value={themeValues.groupNotes} onChange={(event) => updateThemeField("groupNotes", event.target.value)} />
            </label>
            <label className="field full">
              <span>封面图</span>
              <div className="share-cover-options">
                <label className="inline-check">
                  <input type="radio" name="coverMode" value="auto" checked={coverMode === "auto"} onChange={() => setCoverMode("auto")} />
                  自动使用第一张有图卡片
                </label>
                <label className="inline-check">
                  <input type="radio" name="coverMode" value="custom" checked={coverMode === "custom"} onChange={() => setCoverMode("custom")} />
                  自定义上传
                </label>
                <input type="hidden" name="existingCoverImagePath" value={initialCoverImagePath} />
                {coverMode === "custom" ? (
                  <div className="share-cover-upload">
                    <input name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" />
                    {initialCoverImagePath ? <p className="muted">未重新上传时，将继续使用当前自定义封面。</p> : null}
                  </div>
                ) : null}
              </div>
            </label>
          </div>
        </section>
      </div>

      <div className={activeStep === 3 ? "" : "share-step-hidden"}>
        <section className="panel share-section">
          <div className="share-section-head">
            <div>
              <h2>确认保存</h2>
              <p className="muted">保存前确认本次分享集包含的卡片。导出包不会包含价格、成本、购买渠道和备注。</p>
            </div>
            <span className="muted">{selectedIds.length} 张卡片</span>
          </div>
          {selectedCardLabels.length > 0 ? (
            <ol className="share-confirm-list">
              {selectedCardLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ol>
          ) : (
            <p className="muted">还没有选择卡片。</p>
          )}
          <div className="share-form-actions">
            <button type="submit" className="btn btn-primary">
              确认保存
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(0)}>
              返回选卡
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
