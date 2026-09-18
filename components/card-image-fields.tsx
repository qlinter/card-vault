"use client";

import { UiElement, UiText } from "@/components/ui-text";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  cardImageRotationStyle,
  normalizeCardImageRotation,
  rotateCardImageDegrees,
  toPersistedCardImageRotation
} from "@/lib/card-image-rotation";

type ExistingImage = {
  id: string;
  url: string;
  rotation: number;
};

type QueuedImage = {
  id: string;
  url: string;
  side: "front" | "back";
  originalName: string;
};

type NewImagePreview = {
  id: string;
  name: string;
  url: string;
  rotation: number;
};

type CardImageFieldsProps = {
  mode: "create" | "edit";
  cardTitle: string;
  existingImages: ExistingImage[];
  queuedImages: QueuedImage[];
};

function RotationButtons({ label, onLeft, onRight }: { label: string; onLeft: () => void; onRight: () => void }) {
  return (
    <div className="card-image-rotation-actions">
      <UiElement uiMessages={{"aria-label": {text:"{0}向左旋转",values:[label],translateValues:[0]}}} as="button" uiAttributes={["title"]} type="button" className="btn btn-secondary" onClick={onLeft}  title="向左旋转">↺</UiElement>
      <UiElement uiMessages={{"aria-label": {text:"{0}向右旋转",values:[label],translateValues:[0]}}} as="button" uiAttributes={["title"]} type="button" className="btn btn-secondary" onClick={onRight}  title="向右旋转">↻</UiElement>
    </div>
  );
}

export function CardImageFields({ mode, cardTitle, existingImages, queuedImages }: CardImageFieldsProps) {
  const [existingRotations, setExistingRotations] = useState<Record<string, number>>(() => Object.fromEntries(
    existingImages.map((image) => [image.id, normalizeCardImageRotation(image.rotation)])
  ));
  const [queuedRotations, setQueuedRotations] = useState<Record<string, number>>(() => Object.fromEntries(
    queuedImages.map((image) => [image.id, 0])
  ));
  const [newImages, setNewImages] = useState<NewImagePreview[]>([]);
  const objectUrls = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedFiles = useRef<File[]>([]);
  useEffect(() => {
    const form = fileInput.current?.form;
    const restore = () => queueMicrotask(() => {
      if (!fileInput.current || !selectedFiles.current.length) return;
      const transfer = new DataTransfer();
      selectedFiles.current.forEach(file => transfer.items.add(file));
      fileInput.current.files = transfer.files;
    });
    form?.addEventListener("reset", restore);
    return () => form?.removeEventListener("reset", restore);
  }, []);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function selectNewImages(event: ChangeEvent<HTMLInputElement>) {
    selectedFiles.current = Array.from(event.target.files ?? []);
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    const next = Array.from(event.target.files ?? []).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      rotation: 0
    }));
    objectUrls.current = next.map((image) => image.url);
    setNewImages(next);
  }

  function rotateExisting(id: string, direction: -1 | 1) {
    setExistingRotations((current) => ({ ...current, [id]: rotateCardImageDegrees(current[id] ?? 0, direction) }));
  }

  function rotateQueued(id: string, direction: -1 | 1) {
    setQueuedRotations((current) => ({ ...current, [id]: rotateCardImageDegrees(current[id] ?? 0, direction) }));
  }

  function rotateNew(id: string, direction: -1 | 1) {
    setNewImages((current) => current.map((image) => image.id === id
      ? { ...image, rotation: rotateCardImageDegrees(image.rotation, direction) }
      : image));
  }

  return (
    <>
      <label className="field full card-image-upload">
        <span>
          {mode === "create" ? queuedImages.length > 0 ? <UiText text={"队列已有 {0} 张图片，可追加至总计 5 张"} values={[queuedImages.length]} /> : <UiText text={"上传图片（1-5 张）*"} /> : <UiText text={"新增图片（可选，单张卡总计最多 5 张）"} />}
        </span>
        <input ref={fileInput} name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectNewImages} />
      </label>

      <input type="hidden" name="existingImageRotations" value={JSON.stringify(Object.fromEntries(
        Object.entries(existingRotations).map(([id, rotation]) => [id, toPersistedCardImageRotation(rotation)])
      ))} />
      <input type="hidden" name="queuedImageRotations" value={JSON.stringify(Object.fromEntries(
        Object.entries(queuedRotations).map(([id, rotation]) => [id, toPersistedCardImageRotation(rotation)])
      ))} />
      <input type="hidden" name="newImageRotations" value={JSON.stringify(
        newImages.map((image) => toPersistedCardImageRotation(image.rotation))
      )} />

      {newImages.length > 0 ? (
        <section className="card-image-editor full">
          <h3><UiText text={"新增图片"} /></h3>
          <div className="gallery">
            {newImages.map((image, index) => (
              <figure className="card-image-edit-item" key={image.id}>
                <div className="card-image-preview-frame">
                  <img src={image.url} alt={`${cardTitle || "卡片"} 新增图片 ${index + 1}`} style={cardImageRotationStyle(image.rotation, { continuous: true })} />
                </div>
                <figcaption>{image.name}</figcaption>
                <RotationButtons label={`第 ${index + 1} 张新增图片`} onLeft={() => rotateNew(image.id, -1)} onRight={() => rotateNew(image.id, 1)} />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "create" && queuedImages.length > 0 ? (
        <section className="card-image-editor full">
          <h3><UiText text={"队列预处理图片"} /></h3>
          <div className="gallery">
            {queuedImages.map((image, index) => (
              <figure className="card-image-edit-item" key={image.id}>
                <div className="card-image-preview-frame">
                  <img src={image.url} alt={`${image.side === "front" ? "正面" : "背面"}：${image.originalName}`} style={cardImageRotationStyle(queuedRotations[image.id], { continuous: true })} />
                </div>
                <figcaption>{image.side === "front" ? <UiText text={"正面"} /> : <UiText text={"背面"} />}</figcaption>
                <RotationButtons label={`队列第 ${index + 1} 张图片`} onLeft={() => rotateQueued(image.id, -1)} onRight={() => rotateQueued(image.id, 1)} />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "edit" && existingImages.length > 0 ? (
        <section className="card-image-editor full">
          <h3><UiText text={"现有图片"} /></h3>
          <div className="gallery">
            {existingImages.map((image, index) => (
              <figure className="card-image-edit-item" key={image.id}>
                <div className="card-image-preview-frame">
                  <img src={image.url} alt={`${cardTitle} 图片 ${index + 1}`} style={cardImageRotationStyle(existingRotations[image.id], { continuous: true })} />
                </div>
                <RotationButtons label={`第 ${index + 1} 张现有图片`} onLeft={() => rotateExisting(image.id, -1)} onRight={() => rotateExisting(image.id, 1)} />
                <label>
                  <input type="checkbox" name="removeImageIds" value={image.id} /><UiText text={"删除此图"} /></label>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
