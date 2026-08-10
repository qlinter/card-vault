"use client";

import type { FormEvent, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ShareCardDraft, ShareCardPicker, SharePickerCard } from "@/components/share-card-picker";
import { ShareGalleryEditor } from "@/components/share-gallery-editor";
import {
  ShareThemeCard,
  ShareThemeField,
  ShareThemeGenerator,
  ShareThemeValues,
  shareThemeFields
} from "@/components/share-theme-generator";
import type { ShareThemeId } from "@/lib/share-themes";
import type { SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionDraft } from "@/lib/share-sections";

type ShareCollectionWizardProps = {
  action: (formData: FormData) => void | Promise<void>;
  cards: SharePickerCard[];
  aiCards: ShareThemeCard[];
  initialValues: ShareThemeValues & {
    theme: ShareThemeId;
    coverImagePath: string;
    backgroundImagePath: string;
    presentation: SharePresentation;
    sections: ShareSectionDraft[];
  };
  error?: string;
};

const steps = [
  { id: 0, title: "选择球星卡", helper: "先挑出本次分享要展示的卡片。" },
  { id: 1, title: "AI 生成", helper: "基于已选卡片生成展馆主题文案。" },
  { id: 2, title: "内容修改", helper: "调整标题、封面介绍、叙事和单卡展示覆盖。" },
  { id: 3, title: "确认保存", helper: "检查卡片数量和隐私提示，然后保存分享集。" }
] as const;

function ShareSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "保存中..." : "确认保存"}
    </button>
  );
}

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

export function ShareCollectionWizard({ action, cards, aiCards, initialValues, error }: ShareCollectionWizardProps) {
  const initialCoverImagePath = initialValues.coverImagePath.startsWith("/share-covers/") ? initialValues.coverImagePath : "";
  const initialBackgroundImagePath = initialValues.backgroundImagePath.startsWith("/share-backgrounds/") ? initialValues.backgroundImagePath : "";
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
  const [theme, setTheme] = useState<ShareThemeId>(initialValues.theme);
  const [presentation, setPresentation] = useState<SharePresentation>(initialValues.presentation);
  const [sections, setSections] = useState<ShareSectionDraft[]>(initialValues.sections);
  const [coverMode, setCoverMode] = useState<"auto" | "custom">(initialCoverImagePath ? "custom" : "auto");
  const [message, setMessage] = useState("");

  const selectedAiCards = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return aiCards.filter((card) => selectedSet.has(card.id));
  }, [aiCards, selectedIds]);
  const selectedCards = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const selectedOrder = new Map(selectedIds.map((id, index) => [id, index]));
    return cards
      .filter((card) => selectedSet.has(card.id))
      .sort((a, b) => {
        const aOrder = Number.parseInt(drafts[a.id]?.sortOrder ?? `${a.sortOrder}`, 10);
        const bOrder = Number.parseInt(drafts[b.id]?.sortOrder ?? `${b.sortOrder}`, 10);
        const aRank = Number.isFinite(aOrder) && aOrder > 0 ? aOrder : selectedOrder.get(a.id) ?? 0;
        const bRank = Number.isFinite(bOrder) && bOrder > 0 ? bOrder : selectedOrder.get(b.id) ?? 0;
        return aRank - bRank;
      });
  }, [cards, drafts, selectedIds]);
  const selectedCardLabels = useMemo(
    () => selectedCards.map((card) => `${card.playerName} - ${card.cardTitle}`),
    [selectedCards]
  );

  function updateSelection(cardId: string, selected: boolean) {
    setSelectedIds((current) => {
      if (selected) {
        return current.includes(cardId) ? current : [...current, cardId];
      }
      return current.filter((id) => id !== cardId);
    });
    if (!selected) {
      setSections((current) => current.map((section) => ({
        ...section,
        cardIds: section.cardIds.filter((id) => id !== cardId)
      })));
    }
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

    const generatedSections = [
      { id: "ai-narrative", field: "themeNarrative" as const, title: "展馆叙事", layout: "editorial" as const, cardIds: [] as string[] },
      { id: "ai-highlights", field: "themeHighlights" as const, title: "收藏亮点", layout: "rail" as const, cardIds: selectedIds },
      { id: "ai-groups", field: "groupNotes" as const, title: "主题分组", layout: "grid" as const, cardIds: selectedIds }
    ];
    setSections((current) => {
      const next = [...current];
      for (const generated of generatedSections) {
        const description = safeText(suggestion[generated.field]);
        if (!description || (!overwrite && safeText(themeValues[generated.field]))) {
          continue;
        }
        const index = next.findIndex((section) => section.id === generated.id);
        const section: ShareSectionDraft = {
          id: generated.id,
          title: generated.title,
          description,
          layout: generated.layout,
          cardIds: generated.cardIds
        };
        if (index >= 0) {
          next[index] = section;
        } else {
          next.push(section);
        }
      }
      return next;
    });

    return filledFields;
  }

  function addSection() {
    setSections((current) => [
      ...current,
      { id: `section-${crypto.randomUUID()}`, title: `新章节 ${current.length + 1}`, description: "", layout: "editorial", cardIds: [] }
    ]);
  }

  function updateSection(sectionId: string, patch: Partial<ShareSectionDraft>) {
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  }

  function removeSection(sectionId: string) {
    setSections((current) => current.filter((section) => section.id !== sectionId));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function assignSectionCard(sectionId: string, cardId: string, assigned: boolean) {
    setSections((current) => current.map((section) => ({
      ...section,
      cardIds: section.id === sectionId
        ? assigned
          ? [...new Set([...section.cardIds, cardId])]
          : section.cardIds.filter((id) => id !== cardId)
        : assigned
          ? section.cardIds.filter((id) => id !== cardId)
          : section.cardIds
    })));
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
      return;
    }
    if (!themeValues.title.trim()) {
      event.preventDefault();
      setMessage("请填写分享集标题。");
      setActiveStep(2);
      return;
    }
    setMessage("正在保存分享集，请稍候...");
  }

  return (
    <form action={action} className="share-form" onSubmit={handleSubmit} noValidate>
      {selectedIds.map((cardId) => (
        <input key={cardId} type="hidden" name="cardIds" value={cardId} />
      ))}
      <input type="hidden" name="layout" value={presentation.layout} />
      <input type="hidden" name="backgroundPositionX" value={presentation.backgroundPosition.x} />
      <input type="hidden" name="backgroundPositionY" value={presentation.backgroundPosition.y} />
      <input type="hidden" name="panelOpacity" value={presentation.panelOpacity} />
      <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
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
            <ShareSubmitButton />
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
        <ShareGalleryEditor
          theme={theme}
          presentation={presentation}
          values={themeValues}
          sections={sections}
          cards={selectedCards}
          drafts={drafts}
          coverMode={coverMode}
          initialCoverImagePath={initialCoverImagePath}
          initialBackgroundImagePath={initialBackgroundImagePath}
          onThemeChange={setTheme}
          onPresentationChange={setPresentation}
          onThemeFieldChange={updateThemeField}
          onCoverModeChange={setCoverMode}
          onAddSection={addSection}
          onUpdateSection={updateSection}
          onRemoveSection={removeSection}
          onMoveSection={moveSection}
          onAssignSectionCard={assignSectionCard}
          onDraftChange={updateDraft}
        />
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
            <ShareSubmitButton />
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(0)}>
              返回选卡
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
