"use client";

import type { ShareGalleryVisualPanelProps } from "@/components/share-gallery-editor-types";
import {
  shareDensityOptions,
  shareImageFitOptions,
  shareLayouts,
  shareTextScaleOptions,
  shareTypographyOptions,
  type SharePresentation
} from "@/lib/share-presentation";
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
  onCoverModeChange,
  setCoverPreviewUrl,
  setBackgroundPreviewUrl,
  previewFile
}: ShareGalleryVisualPanelProps) {
  const activeTheme = shareThemes.find((option) => option.id === theme);

  return (
    <section className="panel share-section share-editor-v2-panel">
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
        <div className="field full share-composition-controls">
          <span>排版与构图</span>
          <label>
            <span>字体风格</span>
            <select value={presentation.typography} onChange={(event) => onPresentationChange((current) => ({ ...current, typography: event.target.value as SharePresentation["typography"] }))}>
              {shareTypographyOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>文字大小</span>
            <select value={presentation.textScale} onChange={(event) => onPresentationChange((current) => ({ ...current, textScale: event.target.value as SharePresentation["textScale"] }))}>
              {shareTextScaleOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>内容密度</span>
            <select value={presentation.density} onChange={(event) => onPresentationChange((current) => ({ ...current, density: event.target.value as SharePresentation["density"] }))}>
              {shareDensityOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>图片构图</span>
            <select value={presentation.imageFit} onChange={(event) => onPresentationChange((current) => ({ ...current, imageFit: event.target.value as SharePresentation["imageFit"] }))}>
              {shareImageFitOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <label className="field full">
          <span>分享集背景图</span>
          <div className="share-background-upload">
            <input type="hidden" name="existingBackgroundImagePath" value={initialBackgroundImagePath} />
            <input
              name="backgroundImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => previewFile(event.target.files?.[0], setBackgroundPreviewUrl)}
            />
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
                <input
                  name="coverImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => previewFile(event.target.files?.[0], setCoverPreviewUrl)}
                />
                {initialCoverImagePath ? <p className="muted">未重新上传时，将继续使用当前自定义封面。</p> : null}
              </div>
            ) : null}
          </div>
        </label>
      </div>
    </section>
  );
}
