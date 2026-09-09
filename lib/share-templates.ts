import {
  parseSharePresentation,
  type SharePresentation,
  type ShareTemplateId
} from "./share-presentation.ts";

export type ShareGalleryTemplateId = Exclude<ShareTemplateId, "custom">;

export type ShareGalleryTemplate = {
  id: ShareGalleryTemplateId;
  label: string;
  description: string;
  presentation: Omit<SharePresentation, "version" | "templateId" | "featuredCardIds">;
};

export const shareGalleryTemplates = [
  {
    id: "collector-spotlight",
    label: "藏家聚光",
    description: "大幅封面，突出少量核心卡。",
    presentation: {
      layout: "stage",
      backgroundPosition: { x: 50, y: 42 },
      panelOpacity: 48,
      typography: "modern",
      density: "comfortable",
      imageFit: "cover",
      textScale: "large"
    }
  },
  {
    id: "archive-journal",
    label: "典藏志",
    description: "章节清晰，适合生涯与系列叙事。",
    presentation: {
      layout: "archive",
      backgroundPosition: { x: 50, y: 50 },
      panelOpacity: 64,
      typography: "editorial",
      density: "comfortable",
      imageFit: "contain",
      textScale: "standard"
    }
  },
  {
    id: "arena-lineup",
    label: "主场阵容",
    description: "紧凑阵容，适合球队与多卡展示。",
    presentation: {
      layout: "arena",
      backgroundPosition: { x: 50, y: 36 },
      panelOpacity: 56,
      typography: "modern",
      density: "compact",
      imageFit: "cover",
      textScale: "standard"
    }
  }
] as const satisfies readonly ShareGalleryTemplate[];

const shareGalleryTemplateById = new Map<ShareGalleryTemplateId, ShareGalleryTemplate>(
  shareGalleryTemplates.map((template) => [template.id, template])
);

function getShareGalleryTemplate(value: unknown): ShareGalleryTemplate | null {
  return typeof value === "string"
    ? shareGalleryTemplateById.get(value as ShareGalleryTemplateId) ?? null
    : null;
}

export function applyShareGalleryTemplate(
  current: SharePresentation,
  templateId: ShareGalleryTemplateId
): SharePresentation {
  const template = getShareGalleryTemplate(templateId);
  if (!template) {
    return current;
  }
  return parseSharePresentation({
    ...template.presentation,
    version: 3,
    backgroundPosition: { ...template.presentation.backgroundPosition },
    templateId: template.id,
    featuredCardIds: current.featuredCardIds
  });
}
