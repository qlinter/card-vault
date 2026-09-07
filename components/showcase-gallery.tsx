"use client";

import { UiElement } from "@/components/ui-text";
import { useState } from "react";
import { cardImageRotationStyle, rotateCardImageDegrees } from "@/lib/card-image-rotation";
import { normalizeImagePath } from "@/lib/image-path";

type ShowcaseGalleryProps = {
  cardTitle: string;
  images: Array<{ id: string; path: string; rotation: number }>;
};

export function ShowcaseGallery({ cardTitle, images }: ShowcaseGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewRotation, setViewRotation] = useState(0);
  const activeImage = images[activeIndex];

  if (!activeImage) {
    return <div className="showcase-detail-main-image showcase-placeholder" />;
  }

  const goPrevious = () => {
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
    setViewRotation(0);
  };

  const goNext = () => {
    setActiveIndex((current) => (current === images.length - 1 ? 0 : current + 1));
    setViewRotation(0);
  };

  const displayedRotation = activeImage.rotation + viewRotation;

  return (
    <>
      <div className="showcase-detail-main">
        <div className="showcase-detail-main-frame">
          <img
            src={normalizeImagePath(activeImage.path)}
            alt={`${cardTitle} - ${activeIndex + 1}`}
            className="showcase-detail-main-image"
            style={cardImageRotationStyle(displayedRotation, { continuous: true })}
          />
        </div>
        <div className="showcase-image-controls">
          {images.length > 1 ? (
            <button type="button" className="btn btn-secondary showcase-image-nav" onClick={goPrevious}>
              Previous
            </button>
          ) : <span aria-hidden="true" />}
          <UiElement as="div" uiAttributes={["aria-label"]} className="showcase-image-rotation" role="group" aria-label="旋转当前图片">
            <UiElement as="button" uiAttributes={["aria-label","title"]} type="button" className="btn btn-secondary" onClick={() => setViewRotation((current) => rotateCardImageDegrees(current, -1))} aria-label="向左旋转图片" title="向左旋转">↺</UiElement>
            {images.length > 1 ? (
              <span className="showcase-image-counter">
                {activeIndex + 1} / {images.length}
              </span>
            ) : null}
            <UiElement as="button" uiAttributes={["aria-label","title"]} type="button" className="btn btn-secondary" onClick={() => setViewRotation((current) => rotateCardImageDegrees(current, 1))} aria-label="向右旋转图片" title="向右旋转">↻</UiElement>
          </UiElement>
          {images.length > 1 ? (
            <button type="button" className="btn btn-secondary showcase-image-nav" onClick={goNext}>
              Next
            </button>
          ) : <span aria-hidden="true" />}
        </div>
      </div>
      {images.length > 1 ? (
        <div className="showcase-detail-thumbs">
          {images.map((image, index) => (
            <UiElement as="button" uiMessages={{"aria-label": {text:"查看第 {0} 张图片",values:[index + 1],translateValues:[]}}}
              key={image.id}
              type="button"
              className={`showcase-thumb-button${index === activeIndex ? " active" : ""}`}
              onClick={() => {
                setActiveIndex(index);
                setViewRotation(0);
              }}

            >
              <img src={normalizeImagePath(image.path)} alt={`${cardTitle} thumbnail ${index + 1}`} className="showcase-thumb" style={cardImageRotationStyle(image.rotation)} />
            </UiElement>
          ))}
        </div>
      ) : null}
    </>
  );
}
