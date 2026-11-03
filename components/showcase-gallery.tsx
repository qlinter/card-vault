"use client";

import { useState } from "react";
import { useLanguage } from "./language-provider";
import { ShowcaseIcon } from "./showcase-icon";
import { ShowcaseImage } from "./showcase-image";
import { CardImageExport } from "./card-image-export";
import { ShowcaseLightbox } from "./showcase-lightbox";

type ShowcaseGalleryProps = { cardId: string; cardTitle: string; images: Array<{ id: string; path: string; rotation: number }> };

export function ShowcaseGallery({ cardId, cardTitle, images }: ShowcaseGalleryProps) {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewRotation, setViewRotation] = useState(0);
  const activeImage = images[activeIndex];
  const displayedRotation = (activeImage?.rotation ?? 0) + viewRotation;
  function select(index: number) { setActiveIndex(index); setViewRotation(0); }
  return <>
    <div className="showcase-detail-main-frame">
      <ShowcaseImage key={activeImage?.id ?? "empty"} src={activeImage?.path} alt={cardTitle} rotation={displayedRotation} eager priority />
    </div>
    {activeImage ? <div className="showcase-image-controls">
      <div className="showcase-tool-group">
        {images.length > 1 ? <button type="button" className="showcase-tool" onClick={() => select((activeIndex + images.length - 1) % images.length)} aria-label={t("上一张图片")}><ShowcaseIcon name="previous" /></button> : null}
        {images.length > 1 ? <span className="showcase-image-counter" aria-live="polite">{activeIndex + 1} / {images.length}</span> : null}
        {images.length > 1 ? <button type="button" className="showcase-tool" onClick={() => select((activeIndex + 1) % images.length)} aria-label={t("下一张图片")}><ShowcaseIcon name="next" /></button> : null}
      </div>
      <div className="showcase-tool-group" role="group" aria-label={t("旋转当前图片")}>
        <button type="button" className="showcase-tool" onClick={() => setViewRotation(value => value - 90)} aria-label={t("向左旋转图片")}><ShowcaseIcon name="left" /></button>
        <button type="button" className="showcase-tool" onClick={() => setViewRotation(value => value + 90)} aria-label={t("向右旋转图片")}><ShowcaseIcon name="right" /></button>
        <ShowcaseLightbox cardTitle={cardTitle} images={images} activeIndex={activeIndex} rotation={displayedRotation} onSelect={select} />
        <CardImageExport cardId={cardId} showcase />
      </div>
    </div> : null}
    {images.length > 1 ? <div className="showcase-detail-thumbs" role="group" aria-label={t("卡片图片")}>
      {images.map((image, index) => <button key={image.id} type="button" className={`showcase-thumb-button${index === activeIndex ? " active" : ""}`} aria-pressed={index === activeIndex}
        aria-label={t("查看第 {0} 张图片").replace("{0}", String(index + 1))} onClick={() => select(index)}>
        <ShowcaseImage src={image.path} alt={`${cardTitle} · ${index + 1}`} rotation={image.rotation} shadow={false} />
      </button>)}
    </div> : null}
  </>;
}
