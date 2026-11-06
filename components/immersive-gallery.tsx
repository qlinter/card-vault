"use client";

import { useState, type CSSProperties } from "react";
import { defaultGalleryPreferences, galleryCaption, galleryPosition, galleryPreferenceKey, normalizeGalleryPreferences, type GalleryCard, type GalleryPreferences, type GallerySource } from "@/lib/immersive-presentation";
import { useLanguage } from "./language-provider";
import { useImmersiveViewer } from "./use-immersive-viewer";
import { ShowcaseImage } from "./showcase-image";
import { ShowcaseIcon } from "./showcase-icon";
import { ImmersiveGallerySettings } from "./immersive-gallery-settings";

function initialPreferences() {
  try { return normalizeGalleryPreferences(JSON.parse(localStorage.getItem(galleryPreferenceKey) ?? "null")); }
  catch { return { ...defaultGalleryPreferences }; }
}

export function ImmersiveGallery({ source, onClose }: { source: GallerySource; onClose: () => void }) {
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState(initialPreferences);
  const viewer = useImmersiveViewer({ source, onClose, playback: preferences });
  const update = (patch: Partial<GalleryPreferences>) => { viewer.pause(); setPreferences(value => normalizeGalleryPreferences({ ...value, ...patch })); };
  const save = (interval: number) => {
    const saved = normalizeGalleryPreferences({ ...preferences, interval, allImages: viewer.allImages, random: viewer.session?.random ?? preferences.random });
    try { localStorage.setItem(galleryPreferenceKey, JSON.stringify(saved)); setPreferences(saved); return true; }
    catch { return false; }
  };
  const position = galleryPosition(viewer.session?.index, viewer.session?.ids.length);
  const current = viewer.card?.id === viewer.cardId ? viewer.card : undefined;
  const sceneStyle = { "--gallery-light": preferences.light / 100, "--gallery-art-scale": preferences.artScale / 100 } as CSSProperties;
  const scopeLabel = source.group || (source.spec ? `${source.spec.year}${source.spec.month ? ` / ${source.spec.month}` : ""}` : source.q);
  const sceneLabel = scopeLabel !== current?.playerName && scopeLabel !== current?.cardTitle ? scopeLabel : undefined;
  const failure = !current ? "卡片已删除或不在当前范围。" : viewer.unavailable ? "当前范围的图片均不可用。可重试或退出赏卡。" : "图片暂时无法显示，可重试或跳过。";

  return <dialog ref={viewer.dialog} tabIndex={-1} className={`immersive-viewer${viewer.controls ? "" : " is-idle"}`} style={sceneStyle}
    data-gallery-scene={preferences.scene} data-gallery-layout={preferences.layout} data-gallery-captions={preferences.captions} data-gallery-settings={viewer.settingsOpen} data-ready={viewer.loaded}
    aria-label={t("沉浸式赏卡")} onCancel={event => { event.preventDefault(); viewer.dismiss(); }} onMouseMove={viewer.showControls} onTouchStart={viewer.showControls}>
    <div ref={viewer.surface} className="immersive-surface">
    <div className="gallery-architecture" aria-hidden="true"><div className="gallery-spotlight" /><div className="gallery-floor" /><div className="gallery-wall-seam" /></div>
    <header className="immersive-top" onFocus={viewer.showControls}>
      <div className="gallery-wordmark">CARD VAULT</div>
      {sceneLabel ? <div className="gallery-collection-heading">{sceneLabel}</div> : <span />}
      <div className="gallery-window-actions">
        <button ref={viewer.settingsToggle} type="button" className="gallery-icon-button" title={t("展馆设置")} aria-label={t("展馆设置")} aria-expanded={viewer.settingsOpen} aria-controls="gallery-settings" onClick={() => { viewer.pause(); viewer.setSettingsOpen(value => !value); viewer.showControls(); }}><ShowcaseIcon name="settings" /></button>
        <button type="button" className="gallery-icon-button" title={t(viewer.fullscreen ? "退出全屏" : "全屏")} aria-label={t(viewer.fullscreen ? "退出全屏" : "全屏")} onClick={viewer.toggleFullscreen}><ShowcaseIcon name="expand" /></button>
        <button type="button" className="gallery-icon-button" title={t("退出赏卡")} aria-label={t("退出赏卡")} onClick={viewer.close}><ShowcaseIcon name="close" /></button>
      </div>
    </header>

    <div className="immersive-composition">
      <div className="immersive-stage" data-card-id={viewer.cardId} data-playing={viewer.playing} aria-busy={!viewer.loaded && !viewer.broken && Boolean(viewer.cardId)}>
        <div className="gallery-work-halo" aria-hidden="true" />
        {viewer.card ? <div className="gallery-art-viewport"><div className="immersive-art" style={{ width: `${viewer.zoom * 100}%`, height: `${viewer.zoom * 100}%` }}>
          <div className="gallery-image-reveal" key={`${viewer.image?.id ?? "none"}-${viewer.cardId}-${viewer.imageIndex}-${viewer.imageRetry}`}>
            <ShowcaseImage src={viewer.image?.path} alt={viewer.card.cardTitle} rotation={(viewer.image?.rotation ?? 0) + viewer.rotation} eager priority shadow={false} onStatus={viewer.imageStatus} />
          </div>
        </div></div> : <div className="gallery-loading" role="status"><span />{t(viewer.session?.ids.length === 0 ? "当前范围没有卡片。" : viewer.message || "正在布展…")}</div>}
        <span className="gallery-art-baseline" aria-hidden="true" />
        {viewer.broken ? <div className="immersive-failure" role="status"><p>{t(failure)}</p><div>
          <button type="button" onClick={() => { viewer.pause(); viewer.setImageRetry(value => value + 1); }}>{t("重试")}</button>
          <button type="button" disabled={Boolean(viewer.unavailable)} onClick={() => viewer.allImages && current && viewer.imageIndex < current.images.length - 1 ? viewer.shiftImage(1) : viewer.move(1)}>{t("跳过")}</button>
        </div></div> : null}
      </div>
      {preferences.captions && current ? <GalleryCaption card={current} /> : null}
    </div>

    <footer className="immersive-controls" onFocus={viewer.showControls}>
      <output className="gallery-position" aria-label={t("浏览进度")}><strong>{String(position.current).padStart(3, "0")}</strong><i>/</i><span>{String(position.total).padStart(3, "0")}</span></output>
      <div className="immersive-transport">
        <button type="button" className="gallery-icon-button" aria-label={t("上一张")} title={t("上一张")} disabled={!viewer.session || viewer.session.index === 0} onClick={() => viewer.move(-1)}><ShowcaseIcon name="previous" /></button>
        <button type="button" className="gallery-play-button" aria-label={t(viewer.playing ? "暂停" : "播放")} title={t(viewer.playing ? "暂停" : "播放")} disabled={!viewer.loaded || viewer.broken || !viewer.session?.ids.length} aria-pressed={viewer.playing} onClick={() => viewer.setPlaying(value => !value)}><ShowcaseIcon name={viewer.playing ? "pause" : "play"} /></button>
        <button type="button" className="gallery-icon-button" aria-label={t("下一张")} title={t("下一张")} disabled={!viewer.session?.ids.length || Boolean(viewer.unavailable)} onClick={() => viewer.move(1)}><ShowcaseIcon name="next" /></button>
      </div>
      <div className="gallery-image-tools">
        {current && current.images.length > 1 ? <div className="gallery-image-pagination"><button type="button" className="gallery-icon-button" title={t("上一幅")} aria-label={t("上一幅")} onClick={() => viewer.shiftImage(-1)}><ShowcaseIcon name="previous" /></button><span>{viewer.imageIndex + 1}<i>/</i>{current.images.length}</span><button type="button" className="gallery-icon-button" title={t("下一幅")} aria-label={t("下一幅")} onClick={() => viewer.shiftImage(1)}><ShowcaseIcon name="next" /></button></div> : null}
        <button type="button" className="gallery-icon-button" title={t("缩小")} aria-label={t("缩小")} onClick={() => viewer.resize(-.25)}><ShowcaseIcon name="minus" /></button>
        <button type="button" className="gallery-zoom-value" title={t("重置缩放")} aria-label={t("重置缩放")} onClick={() => viewer.resize(0)}>{Math.round(viewer.zoom * 100)}%</button>
        <button type="button" className="gallery-icon-button" title={t("放大")} aria-label={t("放大")} onClick={() => viewer.resize(.25)}><ShowcaseIcon name="plus" /></button>
        <button type="button" className="gallery-icon-button" title={t("旋转")} aria-label={t("旋转")} onClick={() => { viewer.pause(); viewer.setRotation(value => (value + 90) % 360); }}><ShowcaseIcon name="right" /></button>
      </div>
    </footer>
    {viewer.message ? <p className="gallery-notice" role="status">{t(viewer.message)}<button type="button" onClick={() => viewer.setRetry(value => value + 1)}>{t("重试")}</button></p> : null}
    <ImmersiveGallerySettings viewer={viewer} preferences={preferences} update={update} save={save} />
    </div>
  </dialog>;
}

function GalleryCaption({ card }: { card: GalleryCard }) {
  const { t } = useLanguage();
  const { subtitle, year, facts } = galleryCaption(card);
  return <aside className="immersive-caption" aria-label={t("作品展签")}>
    {year ? <p className="gallery-work-year">{year}</p> : null}
    <h1 title={card.playerName}>{card.playerName}</h1>
    {subtitle ? <p className="gallery-work-title" title={subtitle}>{subtitle}</p> : null}
    {facts.length ? <dl className="gallery-work-facts">{facts.map(fact => <div key={fact.label}><dt>{t(fact.label)}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
    {card.collectionStatus === "sold" ? <p className="gallery-current-status">{t("当前已售出")}</p> : null}
  </aside>;
}
