"use client";

import type { ShareGalleryContentPanelProps } from "@/components/share-gallery-editor-types";

export function ShareGalleryContentPanel({ values, onThemeFieldChange }: ShareGalleryContentPanelProps) {
  return (
    <section className="panel share-section share-editor-v2-panel">
      <div className="share-section-head">
        <div>
          <h2>基础内容</h2>
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
  );
}
