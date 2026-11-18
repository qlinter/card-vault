import { useState } from "react";

export function useShareGalleryEditorState() {
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");
  const [backgroundFileSelected, setBackgroundFileSelected] = useState(false);
  const [backgroundCleared, setBackgroundCleared] = useState(false);
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
    coverPreviewUrl,
    setCoverPreviewUrl,
    backgroundPreviewUrl,
    setBackgroundPreviewUrl,
    backgroundFileSelected,
    setBackgroundFileSelected,
    backgroundCleared,
    setBackgroundCleared,
    draggedCardId,
    setDraggedCardId,
    previewFile
  };
}
