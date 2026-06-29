"use client";

import { useState } from "react";
import { normalizeImagePath } from "@/lib/image-path";

type ShowcaseGalleryProps = {
  cardTitle: string;
  images: Array<{ id: string; path: string }>;
};

export function ShowcaseGallery({ cardTitle, images }: ShowcaseGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  if (!activeImage) {
    return <div className="showcase-detail-main-image showcase-placeholder" />;
  }

  const goPrevious = () => {
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  };

  const goNext = () => {
    setActiveIndex((current) => (current === images.length - 1 ? 0 : current + 1));
  };

  return (
    <>
      <div className="showcase-detail-main">
        <img
          src={normalizeImagePath(activeImage.path)}
          alt={`${cardTitle} - ${activeIndex + 1}`}
          className="showcase-detail-main-image"
        />
        {images.length > 1 ? (
          <div className="showcase-image-controls">
            <button type="button" className="btn btn-secondary showcase-image-nav" onClick={goPrevious}>
              Previous
            </button>
            <span className="showcase-image-counter">
              {activeIndex + 1} / {images.length}
            </span>
            <button type="button" className="btn btn-secondary showcase-image-nav" onClick={goNext}>
              Next
            </button>
          </div>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="showcase-detail-thumbs">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={`showcase-thumb-button${index === activeIndex ? " active" : ""}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`查看第 ${index + 1} 张图片`}
            >
              <img src={normalizeImagePath(image.path)} alt={`${cardTitle} thumbnail ${index + 1}`} className="showcase-thumb" />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
