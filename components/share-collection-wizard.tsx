"use client";

import type { FormEvent, MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { ShareCardPicker, type ShareCardDraft, type SharePickerCard } from "@/components/share-card-picker";
import { ShareGalleryEditor } from "@/components/share-gallery-editor";
import { ShareThemeGenerator, type ShareThemeCard, type ShareThemeField, shareThemeFields } from "@/components/share-theme-generator";
import { useShareDraftPersistence } from "@/components/use-share-draft-persistence";
import { useShareEditorHistory } from "@/components/use-share-editor-history";
import { useShareEditorState, type ShareEditorInitialValues } from "@/components/use-share-editor-state";
import { useShareWizardNavigation } from "@/components/use-share-wizard-navigation";
import { moveId, normalizeCardOrder, reorderIds, type ShareEditorSnapshot } from "@/lib/share-editor-state";
import type { ShareSectionDraft } from "@/lib/share-sections";

type ShareCollectionWizardProps = {
  action: (formData: FormData) => void | Promise<void>;
  draftId: string;
  cards: SharePickerCard[];
  aiCards: ShareThemeCard[];
  initialValues: ShareEditorInitialValues;
  error?: string;
};

const steps = [
  { id: 0, title: "选择球星卡", helper: "先挑选本次分享要展示的卡片。" },
  { id: 1, title: "AI 生成", helper: "基于已选卡片生成展馆主题文案。" },
  { id: 2, title: "内容修改", helper: "调整标题、封面介绍、叙事和单卡展示覆盖。" },
  { id: 3, title: "确认保存", helper: "检查卡片数量和隐私提示，然后保存分享集。" }
] as const;

function ShareSubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "保存中…" : "确认保存"}</button>;
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(safeText).filter(Boolean).join("\n");
  return "";
}

export function ShareCollectionWizard({ action, draftId, cards, aiCards, initialValues, error }: ShareCollectionWizardProps) {
  const editor = useShareEditorState(cards, aiCards, initialValues);
  const { activeStep, setActiveStep, message, setMessage, goNext, goPrevious, goToStep } = useShareWizardNavigation(steps.length, editor.selectedIds.length);
  const applySnapshot = (snapshot: ShareEditorSnapshot) => {
    editor.setSelectedIds(snapshot.selectedIds);
    editor.setDrafts(snapshot.drafts);
    editor.setThemeValues(snapshot.themeValues);
    editor.setTheme(snapshot.theme);
    editor.setPresentation(snapshot.presentation);
    editor.setSections(snapshot.sections);
    editor.setCoverMode(snapshot.coverMode);
  };
  const history = useShareEditorHistory(editor.currentSnapshot, applySnapshot);
  const persistence = useShareDraftPersistence({ draftId, cards, error, initialSnapshot: editor.initialSnapshot, currentSnapshot: editor.currentSnapshot, applySnapshot, resetHistory: history.resetHistory });

  function updateSelection(cardId: string, selected: boolean) {
    history.recordHistory();
    const nextIds = selected ? (editor.selectedIds.includes(cardId) ? editor.selectedIds : [...editor.selectedIds, cardId]) : editor.selectedIds.filter((id) => id !== cardId);
    editor.setSelectedIds(nextIds);
    editor.setDrafts((current) => normalizeCardOrder(nextIds, current));
    if (!selected) editor.setSections((current) => current.map((section) => ({ ...section, cardIds: section.cardIds.filter((id) => id !== cardId) })));
  }

  function updateDraft(cardId: string, patch: Partial<ShareCardDraft>) {
    history.recordHistory();
    editor.setDrafts((current) => ({ ...current, [cardId]: { sortOrder: current[cardId]?.sortOrder ?? "0", displayTitle: current[cardId]?.displayTitle ?? "", displayDescription: current[cardId]?.displayDescription ?? "", ...patch } }));
  }

  function updateThemeField(field: ShareThemeField, value: string) { history.recordHistory(); editor.setThemeValues((current) => ({ ...current, [field]: value })); }

  function applySuggestion(suggestion: Partial<Record<ShareThemeField, unknown>>, overwrite: boolean): ShareThemeField[] {
    history.recordHistory();
    const filledFields: ShareThemeField[] = [];
    editor.setThemeValues((current) => {
      const next = { ...current };
      for (const field of shareThemeFields) {
        const value = safeText(suggestion[field]);
        if (value && (overwrite || !safeText(current[field]))) { next[field] = value; filledFields.push(field); }
      }
      return next;
    });
    const generatedSections: Array<{ id: string; field: ShareThemeField; title: string; layout: ShareSectionDraft["layout"]; cardIds: string[] }> = [
      { id: "ai-narrative", field: "themeNarrative", title: "展馆叙事", layout: "editorial", cardIds: [] },
      { id: "ai-highlights", field: "themeHighlights", title: "收藏亮点", layout: "rail", cardIds: editor.selectedIds },
      { id: "ai-groups", field: "groupNotes", title: "主题分组", layout: "grid", cardIds: editor.selectedIds }
    ];
    editor.setSections((current) => {
      const next = [...current];
      for (const generated of generatedSections) {
        const description = safeText(suggestion[generated.field]);
        if (!description || (!overwrite && safeText(editor.themeValues[generated.field]))) continue;
        const section = { id: generated.id, title: generated.title, description, layout: generated.layout, cardIds: generated.cardIds };
        const index = next.findIndex((item) => item.id === generated.id);
        if (index >= 0) next[index] = section; else next.push(section);
      }
      return next;
    });
    return filledFields;
  }

  function addSection() { history.recordHistory(); editor.setSections((current) => [...current, { id: `section-${crypto.randomUUID()}`, title: `新章节 ${current.length + 1}`, description: "", layout: "editorial", cardIds: [] }]); }
  function updateSection(sectionId: string, patch: Partial<ShareSectionDraft>) { history.recordHistory(); editor.setSections((current) => current.map((section) => section.id === sectionId ? { ...section, ...patch } : section)); }
  function removeSection(sectionId: string) { history.recordHistory(); editor.setSections((current) => current.filter((section) => section.id !== sectionId)); }
  function moveSection(sectionId: string, direction: -1 | 1) {
    history.recordHistory();
    editor.setSections((current) => { const index = current.findIndex((section) => section.id === sectionId); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current; const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next; });
  }
  function reorderSection(activeId: string, targetId: string) {
    history.recordHistory();
    editor.setSections((current) => { const order = reorderIds(current.map((section) => section.id), activeId, targetId); const byId = new Map(current.map((section) => [section.id, section])); return order.map((id) => byId.get(id)).filter((section): section is ShareSectionDraft => Boolean(section)); });
  }
  function reorderCard(activeId: string, targetId: string) { history.recordHistory(); const nextIds = reorderIds(editor.selectedIds, activeId, targetId); editor.setSelectedIds(nextIds); editor.setDrafts((current) => normalizeCardOrder(nextIds, current)); }
  function moveCard(cardId: string, direction: -1 | 1) { history.recordHistory(); const nextIds = moveId(editor.selectedIds, cardId, direction); editor.setSelectedIds(nextIds); editor.setDrafts((current) => normalizeCardOrder(nextIds, current)); }
  function assignSectionCard(sectionId: string, cardId: string, assigned: boolean) {
    history.recordHistory();
    editor.setSections((current) => current.map((section) => ({ ...section, cardIds: section.id === sectionId ? (assigned ? [...new Set([...section.cardIds, cardId])] : section.cardIds.filter((id) => id !== cardId)) : assigned ? section.cardIds.filter((id) => id !== cardId) : section.cardIds })));
  }

  function handleNextClick(event: MouseEvent<HTMLButtonElement>) { event.preventDefault(); goNext(); }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (activeStep < steps.length - 1) { event.preventDefault(); goNext(); return; }
    if (editor.selectedIds.length === 0) { event.preventDefault(); setMessage("请至少选择一张卡片。"); setActiveStep(0); return; }
    if (!editor.themeValues.title.trim()) { event.preventDefault(); setMessage("请填写分享集标题。"); setActiveStep(2); return; }
    persistence.markSubmitted(); setMessage("正在保存分享集，请稍候…");
  }

  return <form action={action} className="share-form" onSubmit={handleSubmit} noValidate>
    {editor.selectedIds.map((cardId) => <input key={cardId} type="hidden" name="cardIds" value={cardId} />)}
    <input type="hidden" name="layout" value={editor.presentation.layout} /><input type="hidden" name="backgroundPositionX" value={editor.presentation.backgroundPosition.x} /><input type="hidden" name="backgroundPositionY" value={editor.presentation.backgroundPosition.y} /><input type="hidden" name="panelOpacity" value={editor.presentation.panelOpacity} /><input type="hidden" name="typography" value={editor.presentation.typography} /><input type="hidden" name="density" value={editor.presentation.density} /><input type="hidden" name="imageFit" value={editor.presentation.imageFit} /><input type="hidden" name="textScale" value={editor.presentation.textScale} /><input type="hidden" name="sectionsJson" value={JSON.stringify(editor.sections)} />
    {error ? <p className="note-error">{error}</p> : null}{message ? <p className="note-error">{message}</p> : null}
    {persistence.recoverableDraft ? <section className="panel share-draft-recovery" role="status"><div><strong>检测到未完成的本机草稿</strong><p className="muted">{persistence.draftStatus}，恢复后仍可使用撤销返回当前已保存内容。</p></div><div><button type="button" className="btn btn-primary" onClick={persistence.restoreDraft}>恢复草稿</button><button type="button" className="btn btn-secondary" onClick={persistence.discardDraft}>放弃草稿</button></div></section> : null}
    <div className="share-wizard-header panel"><div className="share-wizard-steps" aria-label="分享集创建步骤">{steps.map((step) => <button key={step.id} type="button" className={`share-wizard-step${activeStep === step.id ? " active" : ""}`} aria-current={activeStep === step.id ? "step" : undefined} onClick={(event) => { event.preventDefault(); goToStep(step.id); }}><span>{step.id + 1}</span>{step.title}</button>)}</div><div className="share-wizard-actions"><button type="button" className="btn btn-secondary" onClick={goPrevious} disabled={activeStep === 0}>上一步</button>{activeStep < steps.length - 1 ? <button type="button" className="btn btn-primary" onClick={handleNextClick}>下一步</button> : <ShareSubmitButton />}<a href="/shares" className="btn btn-secondary">返回分享</a></div></div>
    <section className="panel share-wizard-current"><p className="muted">第 {activeStep + 1} 步</p><h2>{steps[activeStep].title}</h2><p className="muted">{steps[activeStep].helper}</p><p className="muted">当前已选择 {editor.selectedIds.length} 张卡片</p></section>
    <div className={activeStep === 0 ? "" : "share-step-hidden"}><ShareCardPicker cards={cards} selectedIds={editor.selectedIds} drafts={editor.drafts} onSelectionChange={updateSelection} onDraftChange={updateDraft} /></div>
    <div className={activeStep === 1 ? "" : "share-step-hidden"}><ShareThemeGenerator cards={editor.selectedAiCards} currentValues={editor.themeValues} onApplySuggestion={applySuggestion} /></div>
    <div className={activeStep === 2 ? "" : "share-step-hidden"}><ShareGalleryEditor theme={editor.theme} presentation={editor.presentation} values={editor.themeValues} sections={editor.sections} cards={editor.selectedCards} drafts={editor.drafts} coverMode={editor.coverMode} initialCoverImagePath={editor.initialCoverImagePath} initialBackgroundImagePath={editor.initialBackgroundImagePath} canUndo={history.canUndo} canRedo={history.canRedo} draftStatus={persistence.draftStatus} onUndo={history.undo} onRedo={history.redo} onThemeChange={(nextTheme) => { history.recordHistory(); editor.setTheme(nextTheme); }} onPresentationChange={(updater) => { history.recordHistory(); editor.setPresentation(updater); }} onThemeFieldChange={updateThemeField} onCoverModeChange={(mode) => { history.recordHistory(); editor.setCoverMode(mode); }} onAddSection={addSection} onUpdateSection={updateSection} onRemoveSection={removeSection} onMoveSection={moveSection} onReorderSection={reorderSection} onAssignSectionCard={assignSectionCard} onDraftChange={updateDraft} onMoveCard={moveCard} onReorderCard={reorderCard} /></div>
    <div className={activeStep === 3 ? "" : "share-step-hidden"}><section className="panel share-section"><div className="share-section-head"><div><h2>确认保存</h2><p className="muted">保存前确认本次分享集包含的卡片。导出包不会包含价格、成本、购买渠道和备注。</p></div><span className="muted">{editor.selectedIds.length} 张卡片</span></div>{editor.selectedCardLabels.length ? <ol className="share-confirm-list">{editor.selectedCardLabels.map((label) => <li key={label}>{label}</li>)}</ol> : <p className="muted">还没有选择卡片。</p>}<div className="share-form-actions"><ShareSubmitButton /><button type="button" className="btn btn-secondary" onClick={() => setActiveStep(0)}>返回选卡</button></div></section></div>
  </form>;
}
