"use client";

import type { FormEvent, MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  moveId,
  normalizeCardOrder,
  parseShareEditorDraft,
  reorderIds,
  shareEditorDraftVersion,
  snapshotsEqual,
  type ShareEditorDraft,
  type ShareEditorSnapshot
} from "@/lib/share-editor-state";

type ShareCollectionWizardProps = {
  action: (formData: FormData) => void | Promise<void>;
  draftId: string;
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

function cloneSnapshot(snapshot: ShareEditorSnapshot): ShareEditorSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ShareEditorSnapshot;
}

export function ShareCollectionWizard({ action, draftId, cards, aiCards, initialValues, error }: ShareCollectionWizardProps) {
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
  const [historyVersion, setHistoryVersion] = useState(0);
  const [recoverableDraft, setRecoverableDraft] = useState<ShareEditorDraft | null>(null);
  const [draftPersistenceEnabled, setDraftPersistenceEnabled] = useState(false);
  const [draftStatus, setDraftStatus] = useState("正在检查本机草稿...");
  const historyRef = useRef<{ past: ShareEditorSnapshot[]; future: ShareEditorSnapshot[] }>({ past: [], future: [] });
  const draftStorageKey = `card-vault:share-editor:${shareEditorDraftVersion}:${draftId}`;
  const submittedStorageKey = `${draftStorageKey}:submitted`;

  const currentSnapshot = useMemo<ShareEditorSnapshot>(() => ({
    selectedIds,
    drafts,
    themeValues,
    theme,
    presentation,
    sections,
    coverMode
  }), [coverMode, drafts, presentation, sections, selectedIds, theme, themeValues]);

  const initialSnapshot = useMemo<ShareEditorSnapshot>(() => ({
    selectedIds: cards.filter((card) => card.selected).map((card) => card.id),
    drafts: initialDrafts(cards),
    themeValues: {
      title: initialValues.title,
      subtitle: initialValues.subtitle,
      description: initialValues.description,
      themeNarrative: initialValues.themeNarrative,
      themeHighlights: initialValues.themeHighlights,
      groupNotes: initialValues.groupNotes
    },
    theme: initialValues.theme,
    presentation: initialValues.presentation,
    sections: initialValues.sections,
    coverMode: initialCoverImagePath ? "custom" : "auto"
  }), [cards, initialCoverImagePath, initialValues]);

  useEffect(() => {
    const wasSubmitted = localStorage.getItem(submittedStorageKey) === "true";
    if (wasSubmitted && !error) {
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(submittedStorageKey);
      setDraftPersistenceEnabled(true);
      setDraftStatus("本机草稿已启用");
      return;
    }
    if (wasSubmitted) {
      localStorage.removeItem(submittedStorageKey);
    }
    const stored = localStorage.getItem(draftStorageKey);
    const parsed = stored ? parseShareEditorDraft(stored, cards.map((card) => card.id)) : null;
    if (parsed && !snapshotsEqual(parsed.snapshot, initialSnapshot)) {
      setRecoverableDraft(parsed);
      setDraftStatus(`发现 ${new Date(parsed.savedAt).toLocaleString()} 的本机草稿。`);
      return;
    }
    if (stored) {
      localStorage.removeItem(draftStorageKey);
    }
    setDraftPersistenceEnabled(true);
    setDraftStatus("本机草稿已启用");
  }, [cards, draftStorageKey, error, initialSnapshot, submittedStorageKey]);

  useEffect(() => {
    if (!draftPersistenceEnabled || recoverableDraft) {
      return;
    }
    const timeout = window.setTimeout(() => {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        version: shareEditorDraftVersion,
        savedAt: new Date().toISOString(),
        snapshot: currentSnapshot
      } satisfies ShareEditorDraft));
      setDraftStatus("草稿已自动保存到本机");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [currentSnapshot, draftPersistenceEnabled, draftStorageKey, recoverableDraft]);

  function applySnapshot(snapshot: ShareEditorSnapshot) {
    const next = cloneSnapshot(snapshot);
    setSelectedIds(next.selectedIds);
    setDrafts(next.drafts);
    setThemeValues(next.themeValues);
    setTheme(next.theme);
    setPresentation(next.presentation);
    setSections(next.sections);
    setCoverMode(next.coverMode);
  }

  function recordHistory() {
    const history = historyRef.current;
    if (!history.past.length || !snapshotsEqual(history.past[history.past.length - 1], currentSnapshot)) {
      history.past = [...history.past.slice(-79), cloneSnapshot(currentSnapshot)];
    }
    history.future = [];
    setHistoryVersion((value) => value + 1);
  }

  function undo() {
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous) return;
    history.past = history.past.slice(0, -1);
    history.future = [cloneSnapshot(currentSnapshot), ...history.future].slice(0, 80);
    applySnapshot(previous);
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    const history = historyRef.current;
    const next = history.future[0];
    if (!next) return;
    history.future = history.future.slice(1);
    history.past = [...history.past.slice(-79), cloneSnapshot(currentSnapshot)];
    applySnapshot(next);
    setHistoryVersion((value) => value + 1);
  }

  function restoreDraft() {
    if (!recoverableDraft) return;
    applySnapshot(recoverableDraft.snapshot);
    historyRef.current = { past: [cloneSnapshot(initialSnapshot)], future: [] };
    setRecoverableDraft(null);
    setDraftPersistenceEnabled(true);
    setDraftStatus("已恢复本机草稿");
    setHistoryVersion((value) => value + 1);
  }

  function discardDraft() {
    localStorage.removeItem(draftStorageKey);
    setRecoverableDraft(null);
    setDraftPersistenceEnabled(true);
    setDraftStatus("已放弃旧草稿；新的修改会自动保存");
  }

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
    recordHistory();
    const nextIds = selected
      ? selectedIds.includes(cardId) ? selectedIds : [...selectedIds, cardId]
      : selectedIds.filter((id) => id !== cardId);
    setSelectedIds(nextIds);
    setDrafts((current) => normalizeCardOrder(nextIds, current));
    if (!selected) {
      setSections((current) => current.map((section) => ({
        ...section,
        cardIds: section.cardIds.filter((id) => id !== cardId)
      })));
    }
  }

  function updateDraft(cardId: string, patch: Partial<ShareCardDraft>) {
    recordHistory();
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
    recordHistory();
    setThemeValues((current) => ({ ...current, [field]: value }));
  }

  function applySuggestion(suggestion: Partial<Record<ShareThemeField, unknown>>, overwrite: boolean): ShareThemeField[] {
    recordHistory();
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
    recordHistory();
    setSections((current) => [
      ...current,
      { id: `section-${crypto.randomUUID()}`, title: `新章节 ${current.length + 1}`, description: "", layout: "editorial", cardIds: [] }
    ]);
  }

  function updateSection(sectionId: string, patch: Partial<ShareSectionDraft>) {
    recordHistory();
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  }

  function removeSection(sectionId: string) {
    recordHistory();
    setSections((current) => current.filter((section) => section.id !== sectionId));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    recordHistory();
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

  function reorderSection(activeId: string, targetId: string) {
    recordHistory();
    setSections((current) => {
      const order = reorderIds(current.map((section) => section.id), activeId, targetId);
      const byId = new Map(current.map((section) => [section.id, section]));
      return order.map((id) => byId.get(id)).filter((section): section is ShareSectionDraft => Boolean(section));
    });
  }

  function reorderCard(activeId: string, targetId: string) {
    recordHistory();
    const nextIds = reorderIds(selectedIds, activeId, targetId);
    setSelectedIds(nextIds);
    setDrafts((current) => normalizeCardOrder(nextIds, current));
  }

  function moveCard(cardId: string, direction: -1 | 1) {
    recordHistory();
    const nextIds = moveId(selectedIds, cardId, direction);
    setSelectedIds(nextIds);
    setDrafts((current) => normalizeCardOrder(nextIds, current));
  }

  function assignSectionCard(sectionId: string, cardId: string, assigned: boolean) {
    recordHistory();
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
    localStorage.setItem(submittedStorageKey, "true");
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
      <input type="hidden" name="typography" value={presentation.typography} />
      <input type="hidden" name="density" value={presentation.density} />
      <input type="hidden" name="imageFit" value={presentation.imageFit} />
      <input type="hidden" name="textScale" value={presentation.textScale} />
      <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
      {error ? <p className="note-error">{error}</p> : null}
      {message ? <p className="note-error">{message}</p> : null}
      {recoverableDraft ? (
        <section className="panel share-draft-recovery" role="status">
          <div>
            <strong>检测到未完成的本机草稿</strong>
            <p className="muted">{draftStatus} 恢复后仍可使用撤销返回当前已保存内容。</p>
          </div>
          <div>
            <button type="button" className="btn btn-primary" onClick={restoreDraft}>恢复草稿</button>
            <button type="button" className="btn btn-secondary" onClick={discardDraft}>放弃草稿</button>
          </div>
        </section>
      ) : null}

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
          canUndo={historyRef.current.past.length > 0}
          canRedo={historyRef.current.future.length > 0}
          historyVersion={historyVersion}
          draftStatus={draftStatus}
          onUndo={undo}
          onRedo={redo}
          onThemeChange={(nextTheme) => { recordHistory(); setTheme(nextTheme); }}
          onPresentationChange={(updater) => { recordHistory(); setPresentation(updater); }}
          onThemeFieldChange={updateThemeField}
          onCoverModeChange={(mode) => { recordHistory(); setCoverMode(mode); }}
          onAddSection={addSection}
          onUpdateSection={updateSection}
          onRemoveSection={removeSection}
          onMoveSection={moveSection}
          onReorderSection={reorderSection}
          onAssignSectionCard={assignSectionCard}
          onDraftChange={updateDraft}
          onMoveCard={moveCard}
          onReorderCard={reorderCard}
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
