import { useState } from "react";

export type ShareGalleryEditorPanel = "content" | "visual" | "sections" | "cards";

export function useShareGalleryEditorState() {
  const [activePanel, setActivePanel] = useState<ShareGalleryEditorPanel>("content");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  function previewFile(file: File | undefined, setUrl: (value: string) => void) {
    if (!file) {
      setUrl("");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => setUrl(typeof reader.result === "string" ? reader.result : ""), { once: true });
    reader.readAsDataURL(file);
  }

  return {
    activePanel,
    setActivePanel,
    coverPreviewUrl,
    setCoverPreviewUrl,
    backgroundPreviewUrl,
    setBackgroundPreviewUrl,
    draggedCardId,
    setDraggedCardId,
    previewFile
  };
}
