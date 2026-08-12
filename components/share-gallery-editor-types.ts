import type { ShareCardDraft, SharePickerCard } from "@/components/share-card-picker";
import type { ShareThemeField, ShareThemeValues } from "@/components/share-theme-generator";
import type { SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionDraft } from "@/lib/share-sections";
import type { ShareThemeId } from "@/lib/share-themes";

export type ShareGalleryEditorProps = {
  theme: ShareThemeId;
  presentation: SharePresentation;
  values: ShareThemeValues;
  sections: ShareSectionDraft[];
  cards: SharePickerCard[];
  drafts: Record<string, ShareCardDraft>;
  coverMode: "auto" | "custom";
  initialCoverImagePath: string;
  initialBackgroundImagePath: string;
  canUndo: boolean;
  canRedo: boolean;
  draftStatus: string;
  onUndo: () => void;
  onRedo: () => void;
  onThemeChange: (theme: ShareThemeId) => void;
  onPresentationChange: (updater: (current: SharePresentation) => SharePresentation) => void;
  onThemeFieldChange: (field: ShareThemeField, value: string) => void;
  onCoverModeChange: (mode: "auto" | "custom") => void;
  onAddSection: () => void;
  onUpdateSection: (sectionId: string, patch: Partial<ShareSectionDraft>) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onReorderSection: (activeId: string, targetId: string) => void;
  onAssignSectionCard: (sectionId: string, cardId: string, assigned: boolean) => void;
  onDraftChange: (cardId: string, patch: Partial<ShareCardDraft>) => void;
  onMoveCard: (cardId: string, direction: -1 | 1) => void;
  onReorderCard: (activeId: string, targetId: string) => void;
};

export type ShareGalleryContentPanelProps = Pick<ShareGalleryEditorProps, "values" | "onThemeFieldChange">;

export type ShareGalleryVisualPanelProps = Pick<
  ShareGalleryEditorProps,
  | "theme"
  | "presentation"
  | "coverMode"
  | "initialCoverImagePath"
  | "initialBackgroundImagePath"
  | "onThemeChange"
  | "onPresentationChange"
  | "onCoverModeChange"
> & {
  setCoverPreviewUrl: (value: string) => void;
  setBackgroundPreviewUrl: (value: string) => void;
  previewFile: (file: File | undefined, setUrl: (value: string) => void) => void;
};

export type ShareGallerySectionsPanelProps = Pick<
  ShareGalleryEditorProps,
  | "sections"
  | "cards"
  | "onAddSection"
  | "onUpdateSection"
  | "onRemoveSection"
  | "onMoveSection"
  | "onReorderSection"
  | "onAssignSectionCard"
>;

export type ShareGalleryCardsPanelProps = Pick<
  ShareGalleryEditorProps,
  | "cards"
  | "drafts"
  | "onDraftChange"
  | "onMoveCard"
  | "onReorderCard"
> & {
  draggedCardId: string | null;
  setDraggedCardId: (value: string | null) => void;
};
