"use client";

import { useEffect, useRef, useState } from "react";
import { changePlaybackOrder } from "@/lib/immersive-playback";
import { galleryScenes, type GalleryPreferences } from "@/lib/immersive-presentation";
import type { ImmersiveController } from "./use-immersive-viewer";
import { useLanguage } from "./language-provider";
import { ShowcaseIcon } from "./showcase-icon";

export function ImmersiveGallerySettings({ viewer, preferences, update, save }: {
  viewer: ImmersiveController;
  preferences: GalleryPreferences;
  update: (patch: Partial<GalleryPreferences>) => void;
  save: (interval: number) => boolean;
}) {
  const { t } = useLanguage();
  const closeButton = useRef<HTMLButtonElement>(null);
  const [intervalDraft, setIntervalDraft] = useState(String(viewer.interval));
  const [saveMessage, setSaveMessage] = useState("");
  const commitInterval = () => {
    const parsed = intervalDraft.trim() ? Number(intervalDraft) : viewer.interval;
    const seconds = Number.isFinite(parsed) ? Math.max(1, Math.min(3600, Math.round(parsed))) : viewer.interval;
    viewer.setIntervalSeconds(seconds); setIntervalDraft(String(seconds));
    return seconds;
  };
  useEffect(() => { if (viewer.settingsOpen) { closeButton.current?.focus({ preventScroll: true }); setSaveMessage(""); } }, [viewer.settingsOpen]);
  return <aside id="gallery-settings" className="immersive-settings" hidden={!viewer.settingsOpen} aria-labelledby="gallery-settings-title" onChangeCapture={() => setSaveMessage("")}>
    <header className="immersive-settings-heading">
      <h2 id="gallery-settings-title">{t("展馆设置")}</h2>
      <button ref={closeButton} className="gallery-icon-button" type="button" aria-label={t("关闭设置")} onClick={viewer.closeSettings}><ShowcaseIcon name="close" /></button>
    </header>
    <div className="immersive-settings-body">
      <section className="gallery-settings-section">
        <label className="gallery-setting-field">{t("展示风格")}<select className="gallery-scene-select" value={preferences.scene} onChange={event => update({ scene: event.target.value as GalleryPreferences["scene"] })}>
          {Object.entries(galleryScenes).map(([scene, details]) => <option value={scene} key={scene}>{t(details.label)}</option>)}
        </select></label>
        <label className="gallery-setting-field">{t("画面构图")}<select value={preferences.layout} onChange={event => update({ layout: event.target.value as GalleryPreferences["layout"] })}>
          <option value="exhibition">{t("展馆布展")}</option><option value="focus">{t("专注画面")}</option>
        </select></label>
        <label className="gallery-range"><span>{t("画幅大小")}<output>{preferences.artScale}%</output></span><input aria-label={t("画幅大小")} type="range" min="60" max="100" step="1" value={preferences.artScale} onChange={event => update({ artScale: Number(event.target.value) })} /></label>
        <label className="gallery-range"><span>{t("聚光强度")}<output>{preferences.light}%</output></span><input aria-label={t("聚光强度")} type="range" min="0" max="100" step="1" value={preferences.light} onChange={event => update({ light: Number(event.target.value) })} /></label>
        <label className="gallery-setting-check"><span>{t("显示标题")}</span><input type="checkbox" checked={preferences.captions} onChange={event => update({ captions: event.target.checked })} /></label>
      </section>
      <section className="gallery-settings-section" aria-labelledby="gallery-playback-title">
        <h3 id="gallery-playback-title">{t("播放设置")}</h3>
        <div className="gallery-setting-fields">
          <label>{t("播放顺序")}<select aria-label={t("播放顺序")} value={viewer.session?.random ? "random" : "sequential"} onChange={event => { viewer.pause(); viewer.setSession(state => state && changePlaybackOrder(state, event.target.value === "random")); }}><option value="sequential">{t("顺序")}</option><option value="random">{t("随机")}</option></select></label>
          <label>{t("间隔（秒）")}<input type="number" min="1" max="3600" step="1" required title={t("可设置 1–3600 秒")} value={intervalDraft} onChange={event => { viewer.pause(); setIntervalDraft(event.target.value); if (event.target.validity.valid) viewer.setIntervalSeconds(Number(event.target.value)); }} onBlur={commitInterval} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
        </div>
        <label className="gallery-setting-field">{t("播放模式")}<select value={viewer.allImages ? "all" : "first"} onChange={event => { viewer.pause(); viewer.setAllImages(event.target.value === "all"); }}>
          <option value="first">{t("首图")}</option><option value="all">{t("全部")}</option>
        </select></label>
      </section>
    </div>
    <footer className="gallery-settings-footer">
      {saveMessage ? <p role="status">{t(saveMessage)}</p> : null}
      <button type="button" onClick={() => { viewer.pause(); setSaveMessage(save(commitInterval()) ? "展馆设置已保存。" : "无法保存到本机，当前设置仍可使用。请检查本地存储后重试。"); }}>{t("保存")}</button>
    </footer>
  </aside>;
}
