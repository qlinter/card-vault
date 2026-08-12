"use client";

import { ShareGalleryCardsPanel } from "@/components/share-gallery-cards-panel";
import { ShareGalleryContentPanel } from "@/components/share-gallery-content-panel";
import type { ShareGalleryEditorProps } from "@/components/share-gallery-editor-types";
import { ShareGallerySectionsPanel } from "@/components/share-gallery-sections-panel";
import { ShareGalleryVisualPanel } from "@/components/share-gallery-visual-panel";
import { ShareDesignPreview } from "@/components/share-design-preview";
import { useShareGalleryEditorState, type ShareGalleryEditorPanel } from "@/components/use-share-gallery-editor-state";
import { shareLayouts } from "@/lib/share-presentation";
import { shareThemes } from "@/lib/share-themes";

const editorPanels: Array<{ id: ShareGalleryEditorPanel; label: string; description: string }> = [
  { id: "content", label: "基础内容", description: "标题与展馆介绍" },
  { id: "visual", label: "视觉设计", description: "版式、主题与图片" },
  { id: "sections", label: "展馆章节", description: "叙事结构与分组" },
  { id: "cards", label: "单卡展示", description: "顺序与展示覆盖" }
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
  const {
    activePanel,
    setActivePanel,
    coverPreviewUrl,
    backgroundPreviewUrl,
    setCoverPreviewUrl,
    setBackgroundPreviewUrl,
    draggedCardId,
    setDraggedCardId,
    previewFile
  } = useShareGalleryEditorState();
  const activeTheme = shareThemes.find((option) => option.id === theme);
  const activeLayout = shareLayouts.find((option) => option.id === presentation.layout);

  return (
    <div className="share-editor-v2">
      <header className="panel share-editor-v2-header">
        <div>
          <span className="share-editor-v2-kicker">GALLERY EDITOR 2.0</span>
          <h2>分享展馆编辑工作台</h2>
          <p className="muted">分区编辑内容、视觉、章节与单卡展示，右侧同步呈现最终静态展馆。</p>
        </div>
        <div className="share-editor-v2-summary" aria-label="当前展馆摘要">
          <span><small>版式</small><strong>{activeLayout?.label ?? presentation.layout}</strong></span>
          <span><small>主题</small><strong>{activeTheme?.label ?? theme}</strong></span>
          <span><small>章节</small><strong>{sections.length}</strong></span>
          <span><small>卡片</small><strong>{cards.length}</strong></span>
        </div>
        <div className="share-editor-history" aria-label="编辑历史">
          <button type="button" className="btn btn-secondary" onClick={onUndo} disabled={!canUndo}>撤销</button>
          <button type="button" className="btn btn-secondary" onClick={onRedo} disabled={!canRedo}>重做</button>
          <small className="muted">{draftStatus}</small>
        </div>
      </header>

      <nav className="share-editor-v2-tabs" aria-label="展馆编辑分区">
        {editorPanels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            className={`share-editor-v2-tab${activePanel === panel.id ? " active" : ""}`}
            aria-current={activePanel === panel.id ? "page" : undefined}
            onClick={() => setActivePanel(panel.id)}
          >
            <strong>{panel.label}</strong>
            <span>{panel.description}</span>
          </button>
        ))}
      </nav>

      <input type="hidden" name="themeNarrative" value={values.themeNarrative} />
      <input type="hidden" name="themeHighlights" value={values.themeHighlights} />
      <input type="hidden" name="groupNotes" value={values.groupNotes} />

      <div className="share-design-workspace">
        <div className="share-design-controls">
          <div hidden={activePanel !== "content"}>
            <ShareGalleryContentPanel values={values} onThemeFieldChange={onThemeFieldChange} />
          </div>
          <div hidden={activePanel !== "visual"}>
            <ShareGalleryVisualPanel
              theme={theme}
              presentation={presentation}
              coverMode={coverMode}
              initialCoverImagePath={initialCoverImagePath}
              initialBackgroundImagePath={initialBackgroundImagePath}
              onThemeChange={onThemeChange}
              onPresentationChange={onPresentationChange}
              onCoverModeChange={onCoverModeChange}
              setCoverPreviewUrl={setCoverPreviewUrl}
              setBackgroundPreviewUrl={setBackgroundPreviewUrl}
              previewFile={previewFile}
            />
          </div>
          <div hidden={activePanel !== "sections"}>
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
          <div hidden={activePanel !== "cards"}>
            <ShareGalleryCardsPanel
              cards={cards}
              drafts={drafts}
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
          backgroundImagePath={backgroundPreviewUrl || initialBackgroundImagePath}
        />
      </div>
    </div>
  );
}
