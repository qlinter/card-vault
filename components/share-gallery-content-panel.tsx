"use client";

import { UiText } from "@/components/ui-text";
import type { ShareGalleryContentPanelProps } from "@/components/share-gallery-editor-types";

export function ShareGalleryContentPanel({ values, onThemeFieldChange }: ShareGalleryContentPanelProps) {
  return (
    <section className="panel share-section share-editor-v2-panel">
      <div className="share-section-head">
        <h2><UiText text={"基础内容"} /></h2>
      </div>
      <div className="form-grid">
        <label className="field">
          <span><UiText text={"分享集标题 *"} /></span>
          <input name="title" value={values.title} onChange={(event) => onThemeFieldChange("title", event.target.value)} />
        </label>
        <label className="field">
          <span><UiText text={"副标题"} /></span>
          <input name="subtitle" value={values.subtitle} onChange={(event) => onThemeFieldChange("subtitle", event.target.value)} />
        </label>
        <label className="field full">
          <span><UiText text={"封面介绍"} /></span>
          <textarea name="description" value={values.description} onChange={(event) => onThemeFieldChange("description", event.target.value)} />
        </label>
      </div>
    </section>
  );
}
