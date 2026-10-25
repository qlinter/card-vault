"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fitShowcaseImage } from "@/lib/showcase-presentation";
import { UiText } from "./ui-text";
import { ShowcaseIcon } from "./showcase-icon";

type ShowcaseImageProps = { src?: string; alt: string; rotation?: number; eager?: boolean; priority?: boolean; shadow?: boolean };

/** The reserved frame fits the actual image bounds, including quarter-turn rotations. */
export function ShowcaseImage({ src, alt, rotation = 0, eager = false, priority = false, shadow = true }: ShowcaseImageProps) {
  const frame = useRef<HTMLSpanElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    // Local or cached files can finish before React hydrates its load/error handlers.
    if (!image?.complete) return;
    if (image.naturalWidth) setNatural({ width: image.naturalWidth, height: image.naturalHeight });
    else setFailed(true);
  }, []);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const dimensions = fitShowcaseImage(natural.width, natural.height, frameSize.width, frameSize.height, rotation);
  return <span ref={frame} className="showcase-media">
    {src && !failed ? <img ref={imageRef} className={`showcase-media-image${shadow ? " has-shadow" : ""}`} src={src} alt={alt} data-fitted={dimensions ? "true" : "false"}
      loading={eager ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async"
      onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      onError={() => setFailed(true)}
      style={{ width: dimensions?.width, height: dimensions?.height, transform: `rotate(${rotation}deg)` }} /> :
      <span className="showcase-image-placeholder" role="img" aria-label={alt}><ShowcaseIcon name="image" /><span><UiText text={failed ? "图片暂时无法显示" : "暂无卡图"} /></span></span>}
  </span>;
}
