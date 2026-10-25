"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { useState } from "react";
import { ShareGalleryCardsPanel } from "@/components/share-gallery-cards-panel";
import { ShareGalleryContentPanel } from "@/components/share-gallery-content-panel";
import type { ShareGalleryEditorProps } from "@/components/share-gallery-editor-types";
import { ShareGallerySectionsPanel } from "@/components/share-gallery-sections-panel";
import { ShareGalleryVisualPanel } from "@/components/share-gallery-visual-panel";
import { ShareDesignPreview } from "@/components/share-design-preview";
import { useShareGalleryEditorState, type ShareGalleryEditorPanel } from "@/components/use-share-gallery-editor-state";
import { shareLayouts } from "@/lib/share-presentation";
import { shareGalleryTemplates } from "@/lib/share-templates";
import { shareThemes } from "@/lib/share-themes";
import styles from "./share-gallery-editor.module.css";

const editorPanels: Array<{ id: ShareGalleryEditorPanel; label: string }> = [
  { id: "content", label: "基础内容" },
  { id: "visual", label: "视觉设计" },
  { id: "sections", label: "展馆章节" },
  { id: "cards", label: "单卡展示" }
];

export function ShareGalleryEditor({
  theme,
  presentation,
  values,
  sections,
  cards,
  drafts,
  coverMode,
  initialCoverImagePath,
  initialBackgroundImagePath,
  canUndo,
  canRedo,
  draftStatus,
  onUndo,
  onRedo,
  onThemeChange,
  onPresentationChange,
  onFeaturedCardChange,
  onTemplateApply,
  onThemeFieldChange,
  onCoverModeChange,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onMoveSection,
  onReorderSection,
  onAssignSectionCard,
  onDraftChange,
  onMoveCard,
  onReorderCard
}: ShareGalleryEditorProps) {
  const [customizing, setCustomizing] = useState(false);
  const {
    activePanel,
    setActivePanel,
    coverPreviewUrl,
    backgroundPreviewUrl,
    setCoverPreviewUrl,
    setBackgroundPreviewUrl,
    backgroundFileSelected,
    setBackgroundFileSelected,
    backgroundCleared,
    setBackgroundCleared,
    draggedCardId,
    setDraggedCardId,
    previewFile
  } = useShareGalleryEditorState();
  const activeTheme = shareThemes.find((option) => option.id === theme);
  const activeLayout = shareLayouts.find((option) => option.id === presentation.layout);
  const activeStyle = shareGalleryTemplates.find((option) => option.id === presentation.templateId);

  return (
    <div className={styles.editor}>
      <header className="share-editor-v2-header">
        <h2 className="sr-only"><UiText text="分享设置" /></h2>
        <UiElement as="div" uiAttributes={["aria-label"]} className="share-editor-v2-summary" aria-label="当前展馆摘要">
          <span><small><UiText text={"样式"} /></small><strong><UiText text={activeStyle?.label ?? activeLayout?.label ?? presentation.layout} /></strong></span>
          <span><small><UiText text={"主题"} /></small><strong><UiText text={activeTheme?.label ?? theme} /></strong></span>
        </UiElement>
        <UiElement as="div" uiAttributes={["aria-label"]} className="share-editor-history" aria-label="编辑历史">
          <button type="button" className="btn btn-secondary" onClick={onUndo} disabled={!canUndo}><UiText text={"撤销"} /></button>
          <button type="button" className="btn btn-secondary" onClick={onRedo} disabled={!canRedo}><UiText text={"重做"} /></button>
          {draftStatus && draftStatus !== "草稿已自动保存到本机" ? <small className="muted"><UiText text={draftStatus} /></small> : null}
        </UiElement>
      </header>

      <details className="share-custom-tools" onToggle={event => setCustomizing(event.currentTarget.open)}><summary><UiText text="自定义设计" /></summary>
      <UiElement as="nav" uiAttributes={["aria-label"]} className="share-editor-v2-tabs" aria-label="展馆编辑分区">
        {editorPanels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            className={`share-editor-v2-tab${activePanel === panel.id ? " active" : ""}`}
            aria-current={activePanel === panel.id ? "page" : undefined}
            onClick={() => setActivePanel(panel.id)}
          >
            <strong><UiText text={panel.label} /></strong>
          </button>
        ))}
      </UiElement>
      </details>

      <input type="hidden" name="themeNarrative" value={values.themeNarrative} />
      <input type="hidden" name="themeHighlights" value={values.themeHighlights} />
      <input type="hidden" name="groupNotes" value={values.groupNotes} />

      <div className="share-design-workspace">
        <div className="share-design-controls">
          <div hidden={customizing && activePanel !== "content"}>
            <ShareGalleryContentPanel values={values} onThemeFieldChange={onThemeFieldChange} />
          </div>
          <div hidden={customizing && activePanel !== "visual"}>
            <ShareGalleryVisualPanel
              theme={theme}
              presentation={presentation}
              coverMode={coverMode}
              initialCoverImagePath={initialCoverImagePath}
              initialBackgroundImagePath={initialBackgroundImagePath}
              onThemeChange={onThemeChange}
              onPresentationChange={onPresentationChange}
              onTemplateApply={onTemplateApply}
              onCoverModeChange={onCoverModeChange}
              setCoverPreviewUrl={setCoverPreviewUrl}
              setBackgroundPreviewUrl={setBackgroundPreviewUrl}
              backgroundFileSelected={backgroundFileSelected}
              setBackgroundFileSelected={setBackgroundFileSelected}
              backgroundCleared={backgroundCleared}
              setBackgroundCleared={setBackgroundCleared}
              previewFile={previewFile}
            />
          </div>
          <div hidden={!customizing || activePanel !== "sections"}>
            <ShareGallerySectionsPanel
              sections={sections}
              cards={cards}
              onAddSection={onAddSection}
              onUpdateSection={onUpdateSection}
              onRemoveSection={onRemoveSection}
              onMoveSection={onMoveSection}
              onReorderSection={onReorderSection}
              onAssignSectionCard={onAssignSectionCard}
            />
          </div>
          <div hidden={!customizing || activePanel !== "cards"}>
            <ShareGalleryCardsPanel
              cards={cards}
              drafts={drafts}
              presentation={presentation}
              onFeaturedCardChange={onFeaturedCardChange}
              onDraftChange={onDraftChange}
              onMoveCard={onMoveCard}
              onReorderCard={onReorderCard}
              draggedCardId={draggedCardId}
              setDraggedCardId={setDraggedCardId}
            />
          </div>
        </div>

        <ShareDesignPreview
          theme={theme}
          presentation={presentation}
          values={values}
          sections={sections}
          cards={cards}
          drafts={drafts}
          coverImagePath={coverMode === "custom" ? coverPreviewUrl || initialCoverImagePath : ""}
          backgroundImagePath={backgroundCleared ? "" : backgroundPreviewUrl || initialBackgroundImagePath}
        />
      </div>
    </div>
  );
}
