"use client";

import { useState } from "react";
import type { ShareCardDraft, SharePickerCard } from "@/components/share-card-picker";
import { ShareDesignPreview } from "@/components/share-design-preview";
import { ShareSectionEditor } from "@/components/share-section-editor";
import type { ShareThemeField, ShareThemeValues } from "@/components/share-theme-generator";
import { shareLayouts, type SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionDraft } from "@/lib/share-sections";
import { shareThemes, type ShareThemeId } from "@/lib/share-themes";

type EditorPanel = "content" | "visual" | "sections" | "cards";

type ShareGalleryEditorProps = {
  theme: ShareThemeId;
  presentation: SharePresentation;
  values: ShareThemeValues;
  sections: ShareSectionDraft[];
  cards: SharePickerCard[];
  drafts: Record<string, ShareCardDraft>;
  coverMode: "auto" | "custom";
  initialCoverImagePath: string;
  initialBackgroundImagePath: string;
  onThemeChange: (theme: ShareThemeId) => void;
  onPresentationChange: (updater: (current: SharePresentation) => SharePresentation) => void;
  onThemeFieldChange: (field: ShareThemeField, value: string) => void;
  onCoverModeChange: (mode: "auto" | "custom") => void;
  onAddSection: () => void;
  onUpdateSection: (sectionId: string, patch: Partial<ShareSectionDraft>) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onAssignSectionCard: (sectionId: string, cardId: string, assigned: boolean) => void;
  onDraftChange: (cardId: string, patch: Partial<ShareCardDraft>) => void;
};

const themeCategories = [...new Set(shareThemes.map((theme) => theme.category))];
const editorPanels: Array<{ id: EditorPanel; label: string; description: string }> = [
  { id: "content", label: "基本内容", description: "标题与展馆介绍" },
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
  onThemeChange,
  onPresentationChange,
  onThemeFieldChange,
  onCoverModeChange,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onMoveSection,
  onAssignSectionCard,
  onDraftChange
}: ShareGalleryEditorProps) {
  const [activePanel, setActivePanel] = useState<EditorPanel>("content");
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
          <section className="panel share-section share-editor-v2-panel" hidden={activePanel !== "content"}>
            <div className="share-section-head">
              <div>
                <h2>基本内容</h2>
                <p className="muted">建立访客首先看到的标题、定位和封面介绍。</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>分享集标题 *</span>
                <input name="title" value={values.title} onChange={(event) => onThemeFieldChange("title", event.target.value)} />
              </label>
              <label className="field">
                <span>副标题</span>
                <input name="subtitle" value={values.subtitle} onChange={(event) => onThemeFieldChange("subtitle", event.target.value)} />
              </label>
              <label className="field full">
                <span>封面介绍</span>
                <textarea name="description" value={values.description} onChange={(event) => onThemeFieldChange("description", event.target.value)} />
              </label>
            </div>
          </section>

          <section className="panel share-section share-editor-v2-panel" hidden={activePanel !== "visual"}>
            <div className="share-section-head">
              <div>
                <h2>视觉设计</h2>
                <p className="muted">调整展馆结构、视觉主题、背景焦点和内容面板。</p>
              </div>
            </div>
            <div className="form-grid">
              <div className="field full">
                <span>展馆版式</span>
                <div className="share-layout-options" role="radiogroup" aria-label="展馆版式">
                  {shareLayouts.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      role="radio"
                      aria-checked={presentation.layout === layout.id}
                      className={`share-layout-option${presentation.layout === layout.id ? " active" : ""}`}
                      onClick={() => onPresentationChange((current) => ({ ...current, layout: layout.id }))}
                    >
                      <strong>{layout.label}</strong>
                      <span>{layout.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="field full">
                <span>展馆主题</span>
                <select name="theme" value={theme} onChange={(event) => onThemeChange(event.target.value as ShareThemeId)}>
                  {themeCategories.map((category) => (
                    <optgroup label={category} key={category}>
                      {shareThemes.filter((option) => option.category === category).map((option) => (
                        <option value={option.id} key={option.id}>{option.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="muted">{activeTheme?.description}</p>
              </label>
              <div className="field full share-visual-controls">
                <span>背景与文字面板</span>
                <label>
                  <span>水平焦点 {presentation.backgroundPosition.x}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={presentation.backgroundPosition.x}
                    onChange={(event) => onPresentationChange((current) => ({
                      ...current,
                      backgroundPosition: { ...current.backgroundPosition, x: Number(event.target.value) }
                    }))}
                  />
                </label>
                <label>
                  <span>垂直焦点 {presentation.backgroundPosition.y}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={presentation.backgroundPosition.y}
                    onChange={(event) => onPresentationChange((current) => ({
                      ...current,
                      backgroundPosition: { ...current.backgroundPosition, y: Number(event.target.value) }
                    }))}
                  />
                </label>
                <label>
                  <span>文字面板透明度 {presentation.panelOpacity}%</span>
                  <input
                    type="range"
                    min="4"
                    max="55"
                    value={presentation.panelOpacity}
                    onChange={(event) => onPresentationChange((current) => ({ ...current, panelOpacity: Number(event.target.value) }))}
                  />
                </label>
              </div>
              <label className="field full">
                <span>分享集背景图</span>
                <div className="share-background-upload">
                  <input type="hidden" name="existingBackgroundImagePath" value={initialBackgroundImagePath} />
                  <input name="backgroundImage" type="file" accept="image/jpeg,image/png,image/webp" />
                  {initialBackgroundImagePath ? (
                    <>
                      <p className="muted">未重新上传时，将继续使用当前背景图。</p>
                      <label className="inline-check">
                        <input type="checkbox" name="clearBackgroundImage" />
                        清除当前背景图
                      </label>
                    </>
                  ) : <p className="muted">可上传一张横版图片作为分享展馆背景。未上传时使用主题背景。</p>}
                </div>
              </label>
              <label className="field full">
                <span>封面图</span>
                <div className="share-cover-options">
                  <label className="inline-check">
                    <input type="radio" name="coverMode" value="auto" checked={coverMode === "auto"} onChange={() => onCoverModeChange("auto")} />
                    自动使用第一张有图卡片
                  </label>
                  <label className="inline-check">
                    <input type="radio" name="coverMode" value="custom" checked={coverMode === "custom"} onChange={() => onCoverModeChange("custom")} />
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

          <div className="share-editor-v2-panel" hidden={activePanel !== "sections"}>
            <ShareSectionEditor
              sections={sections}
              cards={cards}
              onAdd={onAddSection}
              onChange={onUpdateSection}
              onRemove={onRemoveSection}
              onMove={onMoveSection}
              onCardAssignment={onAssignSectionCard}
            />
          </div>

          <section className="panel share-section share-editor-v2-panel" hidden={activePanel !== "cards"}>
            <div className="share-section-head">
              <div>
                <h2>单卡展示编辑</h2>
                <p className="muted">设置对外展示标题、描述和顺序；留空时使用卡片原始公开信息。</p>
              </div>
              <span className="muted">{cards.length} 张卡片</span>
            </div>
            <div className="share-item-editor">
              {cards.map((card) => {
                const draft = drafts[card.id] ?? {
                  sortOrder: String(card.sortOrder),
                  displayTitle: card.displayTitle,
                  displayDescription: card.displayDescription
                };
                return (
                  <article key={card.id} className="share-item-edit-card">
                    <input type="hidden" name={`sortOrder-${card.id}`} value={draft.sortOrder || "0"} />
                    <input type="hidden" name={`displayTitle-${card.id}`} value={draft.displayTitle} />
                    <input type="hidden" name={`displayDescription-${card.id}`} value={draft.displayDescription} />
                    <div>
                      <strong>{card.playerName}</strong>
                      <p className="muted">{card.cardTitle}</p>
                    </div>
                    <label className="field share-sort-field">
                      <span>排序</span>
                      <input type="number" value={draft.sortOrder} onChange={(event) => onDraftChange(card.id, { sortOrder: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>展示标题</span>
                      <input value={draft.displayTitle} placeholder={card.cardTitle} onChange={(event) => onDraftChange(card.id, { displayTitle: event.target.value })} />
                    </label>
                    <label className="field full">
                      <span>展示描述</span>
                      <textarea
                        value={draft.displayDescription}
                        placeholder={card.publicDescription || "留空时使用卡片公开描述"}
                        onChange={(event) => onDraftChange(card.id, { displayDescription: event.target.value })}
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <ShareDesignPreview
          theme={theme}
          presentation={presentation}
          values={values}
          sections={sections}
          cards={cards}
          drafts={drafts}
          backgroundImagePath={initialBackgroundImagePath}
        />
      </div>
    </div>
  );
}
