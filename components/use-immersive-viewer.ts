"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advancePlayback, startPlayback, type Playback } from "@/lib/immersive-playback";
import type { GallerySource, GalleryCard, GalleryPreferences } from "@/lib/immersive-presentation";

export function useImmersiveViewer({ source, onClose, playback }: { source: GallerySource; onClose: () => void; playback: Pick<GalleryPreferences, "interval" | "allImages" | "random"> }) {
  const [initialPlayback] = useState(playback);
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Playback>(), [card, setCard] = useState<GalleryCard>();
  const [playing, setPlaying] = useState(false), [interval, setIntervalSeconds] = useState(initialPlayback.interval), [allImages, setAllImages] = useState(initialPlayback.allImages);
  const [imageIndex, setImageIndex] = useState(0), [zoom, setZoom] = useState(1), [rotation, setRotation] = useState(0), [loaded, setLoaded] = useState(false), [broken, setBroken] = useState(false);
  const [message, setMessage] = useState(""), [retry, setRetry] = useState(0), [imageRetry, setImageRetry] = useState(0), [controls, setControls] = useState(true), [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsToggle = useRef<HTMLButtonElement>(null);
  const requestPosition = useRef("");
  const badImages = useRef(new Set<string>()), badCards = useRef(new Set<string>()), idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cardId = session?.history[session.index], image = card?.images[imageIndex];
  const sourceKey = JSON.stringify(source);
  const query = useCallback(() => {
    const value = JSON.parse(sourceKey) as GallerySource, params = new URLSearchParams();
    for (const key of ["q", "group"] as const) if (value[key]) params.set(key, value[key]);
    if (value.spec) params.set("spec", JSON.stringify(value.spec));
    if (value.ids) params.set("ids", JSON.stringify(value.ids));
    return params;
  }, [sourceKey]);
  const pause = useCallback(() => setPlaying(false), []);
  const move = useCallback((delta: number) => { setPlaying(false); setSession(state => state && advancePlayback(state, delta)); }, []);
  const showControls = useCallback(() => {
    setControls(true); clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!settingsOpen && !dialog.current?.querySelector(":focus-visible, .immersive-controls:hover, .immersive-top:hover")) setControls(false);
    }, 3000);
  }, [settingsOpen]);

  useEffect(() => {
    const element = dialog.current, active = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow, scroll = { x: window.scrollX, y: window.scrollY };
    element?.showModal(); element?.focus({ preventScroll: true }); document.body.style.overflow = "hidden";
    return () => { clearTimeout(idleTimer.current); element?.close(); document.body.style.overflow = overflow; active?.focus({ preventScroll: true }); window.scrollTo(scroll.x, scroll.y); };
  }, []);

  useEffect(() => {
    const controller = new AbortController(); setSession(undefined); setMessage(""); badCards.current.clear();
    (async () => {
      const ids: string[] = []; let cursor: string | null = null, revision: string | undefined;
      do {
        const params = query(); if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/immersive?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("无法加载赏卡范围，请重试。");
        const result = await response.json();
        if (revision !== undefined && revision !== result.revision) throw new Error("Collection changed during loading");
        revision = result.revision; ids.push(...result.ids); cursor = result.nextCursor;
      } while (cursor);
      if (!controller.signal.aborted) {
        const preferred = (JSON.parse(sourceKey) as GallerySource).ids;
        setSession(startPlayback(preferred ? preferred.filter(id => ids.includes(id)) : ids, initialPlayback.random));
      }
    })().catch(() => { if (!controller.signal.aborted) setMessage("无法加载赏卡范围，请重试。"); });
    return () => controller.abort();
  }, [query, sourceKey, retry, initialPlayback.random]);

  useEffect(() => {
    const position = `${cardId}:${session?.index}`;
    if (requestPosition.current !== position) setImageIndex(0);
    requestPosition.current = position;
    setZoom(1); setRotation(0); setLoaded(false); setBroken(false);
    if (!cardId) return;
    const controller = new AbortController(), params = query(); params.set("id", cardId);
    fetch(`/api/immersive?${params}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("卡片已删除或不在当前范围。");
      const result = await response.json();
      if (!controller.signal.aborted) {
        setCard(result.card);
        setImageIndex(index => Math.min(index, Math.max(0, result.card.images.length - 1)));
      }
    }).catch(() => { if (!controller.signal.aborted) { setBroken(true); setPlaying(false); badCards.current.add(cardId); } });
    return () => controller.abort();
  }, [cardId, session?.index, query, imageRetry]);

  // Only preload the next card's first image; abort the metadata request and
  // release the image reference whenever the current slide or scope changes.
  useEffect(() => {
    const next = session?.history[(session?.index ?? 0) + 1] ?? session?.remaining[0];
    if (!next || !loaded) return;
    const controller = new AbortController(), params = query(); params.set("id", next); let preload: HTMLImageElement | undefined;
    fetch(`/api/immersive?${params}`, { signal: controller.signal }).then(response => response.ok ? response.json() : undefined).then(result => {
      if (!controller.signal.aborted && result?.card.images[0]) { preload = new Image(); preload.src = result.card.images[0].path; }
    }).catch(() => {});
    return () => { controller.abort(); if (preload) preload.src = ""; };
  }, [session, loaded, query]);

  useEffect(() => {
    if (!playing || !loaded || broken) return;
    const timer = setTimeout(() => {
      if (allImages && card && imageIndex < card.images.length - 1) { setLoaded(false); setImageIndex(value => value + 1); setZoom(1); setRotation(0); }
      else setSession(state => state && advancePlayback(state, 1));
    }, interval * 1000);
    return () => clearTimeout(timer);
  }, [playing, loaded, broken, interval, allImages, card, imageIndex, session]);

  useEffect(() => {
    const hidden = () => { if (document.hidden) pause(); }, changed = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("blur", pause); document.addEventListener("visibilitychange", hidden); document.addEventListener("fullscreenchange", changed);
    return () => { window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", hidden); document.removeEventListener("fullscreenchange", changed); };
  }, [pause]);
  useEffect(() => { showControls(); }, [showControls]);

  const shiftImage = useCallback((delta: number) => {
    pause(); setZoom(1); setRotation(0);
    if (!card?.images.length) return;
    setImageIndex(value => { const next = (value + delta + card.images.length) % card.images.length; if (next !== value) { setLoaded(false); setBroken(false); } return next; });
  }, [card, pause]);
  const resize = useCallback((delta: number) => { pause(); setZoom(value => delta === 0 ? 1 : Math.max(.25, Math.min(5, value + delta))); }, [pause]);
  const close = useCallback(() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); onClose(); }, [onClose]);
  const closeSettings = useCallback(() => { setSettingsOpen(false); settingsToggle.current?.focus({ preventScroll: true }); }, []);
  const dismiss = useCallback(() => {
    if (settingsOpen) closeSettings();
    else if (document.fullscreenElement || fullscreen) { if (document.fullscreenElement) void document.exitFullscreen(); }
    else close();
  }, [settingsOpen, closeSettings, fullscreen, close]);
  const toggleFullscreen = async () => {
    pause();
    // Fullscreening the document would raise the underlying page above the modal.
    // A content element inside the dialog keeps only the exhibition in view.
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await surface.current?.requestFullscreen(); }
    catch { setMessage("无法进入全屏，请使用窗口模式赏卡。"); }
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      showControls();
      if (event.key === "Escape") {
        // Let an expanded native picker consume Escape before closing Settings.
        if (CSS.supports("selector(select:open)") && dialog.current?.querySelector("select:open")) return;
        event.preventDefault(); dismiss(); return;
      }
      if (settingsOpen || (event.target as HTMLElement).matches("input,select,textarea")) return;
      if ((event.key === " " || event.key === "Enter") && (event.target as HTMLElement).closest("button,a")) return;
      const handlers: Record<string, () => void> = { ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: () => shiftImage(-1), ArrowDown: () => shiftImage(1), " ": () => setPlaying(value => loaded && !broken && !document.hidden ? !value : false), "+": () => resize(.25), "=": () => resize(.25), "-": () => resize(-.25), "0": () => resize(0) };
      if (handlers[event.key]) { event.preventDefault(); handlers[event.key](); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [showControls, move, shiftImage, resize, loaded, broken, dismiss, settingsOpen]);
  const imageStatus = useCallback((status: "loaded" | "error") => {
    if (card?.id !== cardId) return;
    setLoaded(status === "loaded"); setBroken(status === "error");
    if (status === "error") { setPlaying(false); badImages.current.add(`${cardId}:${image?.id}`); if (cardId && (!allImages || !card?.images.length || card.images.every(item => badImages.current.has(`${cardId}:${item.id}`)))) badCards.current.add(cardId); } else if (cardId) badCards.current.delete(cardId);
  }, [cardId, allImages, card, image?.id]);
  const unavailable = session && session.ids.length > 0 && badCards.current.size >= session.ids.length;
  return { dialog, surface, session, card, cardId, image, imageIndex, playing, setPlaying, interval, setIntervalSeconds, allImages, setAllImages, zoom, rotation, setRotation, loaded, broken, controls, fullscreen, message, imageRetry, unavailable, setSession, setImageRetry, setRetry, pause, move, showControls, shiftImage, resize, close, imageStatus, settingsOpen, setSettingsOpen, settingsToggle, closeSettings, dismiss, toggleFullscreen };
}

export type ImmersiveController = ReturnType<typeof useImmersiveViewer>;
