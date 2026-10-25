"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLanguage } from "./language-provider";
import { ShowcaseImage } from "./showcase-image";
import { ShowcaseIcon } from "./showcase-icon";
import { UiText } from "./ui-text";

type Image = { id: string; path: string; rotation: number };
type Props = { cardTitle: string; images: Image[]; activeIndex: number; rotation: number; onSelect: (index: number) => void };
const MIN_ZOOM = .25;
const MAX_ZOOM = 5;

export function ShowcaseLightbox({ cardTitle, images, activeIndex, rotation, onSelect }: Props) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomInput, setZoomInput] = useState("100");
  const active = images[activeIndex];
  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; };
  }, [open]);
  useEffect(() => {
    const element = viewport.current;
    if (element && open) element.scrollTo({ left: Math.max(0, (element.scrollWidth - element.clientWidth) / 2), top: Math.max(0, (element.scrollHeight - element.clientHeight) / 2) });
  }, [zoom, open, activeIndex]);
  if (!active) return null;
  function changeZoom(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) * 100) / 100;
    setZoom(next);
    setZoomInput(String(Math.round(next * 100)));
  }
  function commitZoom() {
    if (!zoomInput.trim()) { setZoomInput(String(Math.round(zoom * 100))); return; }
    const entered = Number(zoomInput);
    if (!Number.isFinite(entered)) { setZoomInput(String(Math.round(zoom * 100))); return; }
    changeZoom(entered / 100);
  }
  function select(index: number) { changeZoom(1); onSelect(index); }
  function keyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.target instanceof HTMLInputElement) {
      if (event.key === "Enter") { event.preventDefault(); commitZoom(); event.target.blur(); }
      return;
    }
    if (event.key === "ArrowLeft" && images.length > 1) { event.preventDefault(); select((activeIndex + images.length - 1) % images.length); }
    if (event.key === "ArrowRight" && images.length > 1) { event.preventDefault(); select((activeIndex + 1) % images.length); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(zoom + .5); }
    if (event.key === "-") { event.preventDefault(); changeZoom(zoom - .5); }
    if (event.key === "0") { event.preventDefault(); changeZoom(1); }
  }
  return <>
    <button type="button" className="showcase-tool showcase-expand" onClick={() => { changeZoom(1); dialog.current?.showModal(); setOpen(true); }}><ShowcaseIcon name="expand" /><UiText text="查看大图" /></button>
    <dialog ref={dialog} className="showcase-lightbox" aria-label={t("卡片大图")} onClose={() => setOpen(false)} onKeyDown={keyDown}>
      <div className="showcase-lightbox-head"><span className="showcase-lightbox-title">{cardTitle}</span><button type="button" className="showcase-tool" onClick={() => dialog.current?.close()} aria-label={t("关闭大图")}><ShowcaseIcon name="close" /></button></div>
      <div ref={viewport} className="showcase-lightbox-viewport" aria-label={t("大图浏览区域")}>
        {open ? <div className="showcase-lightbox-canvas" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><ShowcaseImage key={active.id} src={active.path} alt={cardTitle} rotation={rotation} eager /></div> : null}
      </div>
      <div className="showcase-lightbox-tools">
        {images.length > 1 ? <div className="showcase-tool-group">
          <button type="button" className="showcase-tool" onClick={() => select((activeIndex + images.length - 1) % images.length)} aria-label={t("上一张图片")}><ShowcaseIcon name="previous" /></button>
          <span className="showcase-image-counter" aria-live="polite">{activeIndex + 1} / {images.length}</span>
          <button type="button" className="showcase-tool" onClick={() => select((activeIndex + 1) % images.length)} aria-label={t("下一张图片")}><ShowcaseIcon name="next" /></button>
        </div> : null}
        <div className="showcase-tool-group showcase-zoom-controls" role="group" aria-label={t("缩放比例")}>
          <button type="button" className="showcase-tool" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(zoom - .5)} aria-label={t("缩小图片")}><ShowcaseIcon name="minus" /></button>
          <label className="showcase-zoom-field"><input type="number" min="25" max="500" step="1" inputMode="numeric" aria-label={t("缩放比例")} value={zoomInput} onChange={event => setZoomInput(event.target.value)} onBlur={commitZoom} /><span aria-hidden="true">%</span></label>
          <button type="button" className="showcase-tool" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(zoom + .5)} aria-label={t("放大图片")}><ShowcaseIcon name="plus" /></button>
        </div>
      </div>
    </dialog>
  </>;
}
