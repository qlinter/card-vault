"use client";

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
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  if (!activeItem) {
    return null;
  }

  return (
    <>
      <section className="share-preview-grid" aria-label="分享集卡片列表">
        {items.map((item) => {
          const image = item.images[0];
          const active = item.id === activeItem.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`share-preview-card${active ? " active" : ""}`}
              onClick={() => setActiveId(item.id)}
            >
              {image ? (
                <img src={normalizeImagePath(image.path)} alt={item.cardTitle} />
              ) : (
                <div className="share-card-placeholder" />
              )}
              <div>
                <h2>{item.playerName}</h2>
                <p>{item.displayTitle}</p>
                {item.meta ? <p className="muted">{item.meta}</p> : null}
              </div>
            </button>
          );
        })}
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
