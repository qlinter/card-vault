"use client";

import { UiText, UiElement } from "@/components/ui-text";
import type { ShareGalleryVisualPanelProps } from "@/components/share-gallery-editor-types";
import {
  shareDensityOptions,
  shareImageFitOptions,
  shareTypographyOptions,
  type SharePresentation
} from "@/lib/share-presentation";
import { shareGalleryTemplates } from "@/lib/share-templates";
import { shareThemes, type ShareThemeId } from "@/lib/share-themes";

const themeCategories = [...new Set(shareThemes.map((theme) => theme.category))];

export function ShareGalleryVisualPanel({
  theme,
  presentation,
  coverMode,
  initialCoverImagePath,
  initialBackgroundImagePath,
  onThemeChange,
  onPresentationChange,
  onTemplateApply,
  onCoverModeChange,
  setCoverPreviewUrl,
  setBackgroundPreviewUrl,
  backgroundFileSelected,
  setBackgroundFileSelected,
  backgroundCleared,
  setBackgroundCleared,
  previewFile
}: ShareGalleryVisualPanelProps) {
  return (
    <section className="panel share-section share-editor-v2-panel">
      <div className="share-section-head">
        <div>
          <h2><UiText text={"视觉设计"} /></h2>
        </div>
      </div>
      <div className="field full share-template-library">
        <div className="share-template-library-head">
          <strong><UiText text={"展馆样式"} /></strong>
          {presentation.templateId === "custom" ? <span className="share-template-custom-badge"><UiText text={"自定义"} /></span> : null}
        </div>
        <UiElement as="div" uiAttributes={["aria-label"]} className="share-template-options" aria-label="展馆样式">
          {shareGalleryTemplates.map((template) => {
            const active = presentation.templateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                className={`share-template-option template-${template.id}${active ? " active" : ""}`}
                aria-pressed={active}
                data-template-id={template.id}
                onClick={() => onTemplateApply(template.id)}
              >
                <span className="share-template-thumbnail" aria-hidden="true">
                  <i className="template-cover" />
                  <i className="template-copy" />
                  <i className="template-cards" />
                </span>
                <span className="share-template-copy">
                  <strong><UiText text={template.label} /></strong>
                  <small><UiText text={template.description} /></small>
                  <em>{active ? <UiText text={"已选择"} /> : <UiText text={"选择样式"} />}</em>
                </span>
              </button>
            );
          })}
        </UiElement>
      </div>
      <div className="form-grid">
        <label className="field full">
          <span><UiText text={"展馆主题"} /></span>
          <select name="theme" value={theme} onChange={(event) => onThemeChange(event.target.value as ShareThemeId)}>
            {themeCategories.map((category) => (
              <optgroup label={category} key={category}>
                {shareThemes.filter((option) => option.category === category).map((option) => (
                  <option value={option.id} key={option.id}><UiText text={option.label} /></option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="field full share-visual-controls">
          <span><UiText text={"背景与文字面板"} /></span>
          <label>
            <span><UiText text={"水平焦点 "} />{presentation.backgroundPosition.x}%</span>
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
            <span><UiText text={"垂直焦点 "} />{presentation.backgroundPosition.y}%</span>
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
            <span><UiText text={"文字面板不透明度 "} />{presentation.panelOpacity}%</span>
            <UiElement as="input" uiAttributes={["aria-label"]}
              type="range"
              aria-label="文字面板不透明度"
              min="10"
              max="90"
              value={presentation.panelOpacity}
              onChange={(event) => onPresentationChange((current) => ({ ...current, panelOpacity: Number(event.target.value) }))}
            />
          </label>
        </div>
        <div className="field full share-composition-controls">
          <span><UiText text={"排版与构图"} /></span>
          <label>
            <span><UiText text={"字体风格"} /></span>
            <UiElement as="select" uiAttributes={["aria-label"]} aria-label="字体风格" value={presentation.typography} onChange={(event) => onPresentationChange((current) => ({ ...current, typography: event.target.value as SharePresentation["typography"] }))}>
              {shareTypographyOptions.map((option) => <option value={option.id} key={option.id}><UiText text={option.label} /></option>)}
            </UiElement>
          </label>
          <label>
            <span><UiText text={"内容密度"} /></span>
            <UiElement as="select" uiAttributes={["aria-label"]} aria-label="内容密度" value={presentation.density} onChange={(event) => onPresentationChange((current) => ({ ...current, density: event.target.value as SharePresentation["density"] }))}>
              {shareDensityOptions.map((option) => <option value={option.id} key={option.id}><UiText text={option.label} /></option>)}
            </UiElement>
          </label>
          <label>
            <span><UiText text={"图片构图"} /></span>
            <UiElement as="select" uiAttributes={["aria-label"]} aria-label="图片构图" value={presentation.imageFit} onChange={(event) => onPresentationChange((current) => ({ ...current, imageFit: event.target.value as SharePresentation["imageFit"] }))}>
              {shareImageFitOptions.map((option) => <option value={option.id} key={option.id}><UiText text={option.label} /></option>)}
            </UiElement>
          </label>
        </div>
        <div className="field full">
          <label htmlFor="share-background-image"><UiText text={"分享集背景图"} /></label>
          <div className="share-background-upload">
            <input type="hidden" name="existingBackgroundImagePath" value={initialBackgroundImagePath} />
            <input
              id="share-background-image"
              name="backgroundImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setBackgroundFileSelected(Boolean(event.target.files?.[0]));
                setBackgroundCleared(false);
                previewFile(event.target.files?.[0], setBackgroundPreviewUrl);
              }}
            />
            {initialBackgroundImagePath || backgroundFileSelected ? (
              <>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    name="clearBackgroundImage"
                    checked={backgroundCleared}
                    onChange={(event) => setBackgroundCleared(event.target.checked)}
                  />
                  {initialBackgroundImagePath ? <UiText text={"清除当前背景图"} /> : <UiText text={"取消已选择的背景图"} />}
                </label>
              </>
            ) : null}
          </div>
        </div>
        <div className="field full">
          <span><UiText text={"封面图"} /></span>
          <div className="share-cover-options">
            <label className="inline-check">
              <input type="radio" name="coverMode" value="auto" checked={coverMode === "auto"} onChange={() => onCoverModeChange("auto")} /><UiText text={"自动使用第一张有图卡片"} /></label>
            <label className="inline-check">
              <input type="radio" name="coverMode" value="custom" checked={coverMode === "custom"} onChange={() => onCoverModeChange("custom")} /><UiText text={"自定义上传"} /></label>
            <input type="hidden" name="existingCoverImagePath" value={initialCoverImagePath} />
            {coverMode === "custom" ? (
              <div className="share-cover-upload">
                <input
                  name="coverImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => previewFile(event.target.files?.[0], setCoverPreviewUrl)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
