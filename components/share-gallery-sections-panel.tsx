"use client";

import { ShareSectionEditor } from "@/components/share-section-editor";
import type { ShareGallerySectionsPanelProps } from "@/components/share-gallery-editor-types";

export function ShareGallerySectionsPanel({
  sections,
  cards,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onMoveSection,
  onReorderSection,
  onAssignSectionCard
}: ShareGallerySectionsPanelProps) {
  return (
    <div className="share-editor-v2-panel">
      <ShareSectionEditor
        sections={sections}
        cards={cards}
        onAdd={onAddSection}
        onChange={onUpdateSection}
        onRemove={onRemoveSection}
        onMove={onMoveSection}
        onReorder={onReorderSection}
        onCardAssignment={onAssignSectionCard}
      />
    </div>
  );
}
