"use client";

import type { CSSProperties, TouchEvent } from "react";
import { useState } from "react";
import { ShowcaseGallery } from "@/components/showcase-gallery";
import { normalizeImagePath } from "@/lib/image-path";

type SharePreviewImage = {
  id: string;
  path: string;
};

export type SharePreviewItem = {
  id: string;
  playerName: string;
  cardTitle: string;
  displayTitle: string;
  displayDescription: string;
  meta: string;
  images: SharePreviewImage[];
};

type SharePreviewCardsProps = {
  items: SharePreviewItem[];
};

export function SharePreviewCards({ items }: SharePreviewCardsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const activeItem = items[activeIndex] ?? items[0];

  if (!activeItem) {
    return null;
  }

  function goTo(index: number) {
    if (items.length === 0) {
      return;
    }
    setActiveIndex((index + items.length) % items.length);
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX === null) {
      return;
    }
    const delta = event.changedTouches[0].clientX - touchStartX;
    setTouchStartX(null);
    if (Math.abs(delta) < 36) {
      return;
    }
    goTo(activeIndex + (delta < 0 ? 1 : -1));
  }

  return (
    <>
      <section
        className="share-preview-carousel"
        aria-label="分享集卡片切换"
        onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
        onTouchEnd={handleTouchEnd}
      >
        <div className="share-carousel-toolbar">
          <button type="button" className="btn btn-secondary" onClick={() => goTo(activeIndex - 1)} disabled={items.length <= 1}>
            上一张
          </button>
          <span>
            {activeIndex + 1} / {items.length}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => goTo(activeIndex + 1)} disabled={items.length <= 1}>
            下一张
          </button>
        </div>
        <div className="share-card-stage">
        {items.map((item, itemIndex) => {
          const image = item.images[0];
          const offset = itemIndex - activeIndex;
          const visible = Math.abs(offset) <= 2;
          return (
            <button
              key={item.id}
              type="button"
              className={`share-preview-card${offset === 0 ? " active" : ""}`}
              style={{ "--offset": offset, "--abs-offset": Math.abs(offset) } as CSSProperties}
              aria-hidden={!visible}
              aria-label={`切换至 ${item.playerName} ${item.displayTitle}`}
              onClick={() => goTo(itemIndex)}
            >
              {image ? (
                <img src={normalizeImagePath(image.path)} alt={item.cardTitle} />
              ) : (
                <div className="share-card-placeholder" />
              )}
            </button>
          );
        })}
        </div>
      </section>

      <section className="share-preview-detail">
        <div className="panel">
          <ShowcaseGallery cardTitle={activeItem.cardTitle} images={activeItem.images} />
        </div>
        <div className="panel">
          <h2>{activeItem.playerName}</h2>
          <p className="share-preview-subtitle">{activeItem.displayTitle}</p>
          {activeItem.displayDescription ? <p className="share-preview-copy">{activeItem.displayDescription}</p> : null}
          {activeItem.meta ? <p className="muted">{activeItem.meta}</p> : null}
        </div>
      </section>
    </>
  );
}
