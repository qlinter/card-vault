export const shareLayouts = [
  {
    id: "stage",
    label: "沉浸舞台",
    description: "大幅标题、核心封面和立体卡组，适合少量精品卡与明星主题。"
  },
  {
    id: "archive",
    label: "典藏档案",
    description: "以章节、档案标签和卡片墙组织收藏，适合生涯与系列叙事。"
  },
  {
    id: "arena",
    label: "竞技主场",
    description: "以数据看板、横向阵容和强节奏章节呈现 Team 与运动收藏。"
  }
] as const;

export type ShareLayoutId = (typeof shareLayouts)[number]["id"];

export const shareTypographyOptions = [
  { id: "modern", label: "现代无衬线" },
  { id: "editorial", label: "典藏衬线" }
] as const;

export const shareDensityOptions = [
  { id: "comfortable", label: "舒展" },
  { id: "compact", label: "紧凑" }
] as const;

export const shareImageFitOptions = [
  { id: "cover", label: "铺满画面" },
  { id: "contain", label: "完整显示" }
] as const;

export const shareTextScaleOptions = [
  { id: "small", label: "小" },
  { id: "standard", label: "标准" },
  { id: "large", label: "大" }
] as const;

export type ShareTypography = (typeof shareTypographyOptions)[number]["id"];
export type ShareDensity = (typeof shareDensityOptions)[number]["id"];
export type ShareImageFit = (typeof shareImageFitOptions)[number]["id"];
export type ShareTextScale = (typeof shareTextScaleOptions)[number]["id"];

export type SharePresentation = {
  version: 1;
  layout: ShareLayoutId;
  backgroundPosition: {
    x: number;
    y: number;
  };
  panelOpacity: number;
  typography: ShareTypography;
  density: ShareDensity;
  imageFit: ShareImageFit;
  textScale: ShareTextScale;
};

export const defaultSharePresentation: SharePresentation = {
  version: 1,
  layout: "stage",
  backgroundPosition: { x: 50, y: 50 },
  panelOpacity: 14,
  typography: "modern",
  density: "comfortable",
  imageFit: "cover",
  textScale: "standard"
};

const layoutIds = new Set<string>(shareLayouts.map((layout) => layout.id));
const typographyIds = new Set<string>(shareTypographyOptions.map((option) => option.id));
const densityIds = new Set<string>(shareDensityOptions.map((option) => option.id));
const imageFitIds = new Set<string>(shareImageFitOptions.map((option) => option.id));
const textScaleIds = new Set<string>(shareTextScaleOptions.map((option) => option.id));

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

export function normalizeShareLayout(value: unknown): ShareLayoutId {
  return typeof value === "string" && layoutIds.has(value) ? (value as ShareLayoutId) : "stage";
}

function normalizeChoice<T extends string>(value: unknown, choices: Set<string>, fallback: T): T {
  return typeof value === "string" && choices.has(value) ? (value as T) : fallback;
}

export function parseSharePresentation(value: unknown): SharePresentation {
  let parsed: unknown = value;
  if (typeof value === "string" && value.trim()) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }

  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const position = record.backgroundPosition && typeof record.backgroundPosition === "object"
    ? (record.backgroundPosition as Record<string, unknown>)
    : {};

  return {
    version: 1,
    layout: normalizeShareLayout(record.layout),
    backgroundPosition: {
      x: boundedNumber(position.x, defaultSharePresentation.backgroundPosition.x, 0, 100),
      y: boundedNumber(position.y, defaultSharePresentation.backgroundPosition.y, 0, 100)
    },
    panelOpacity: boundedNumber(record.panelOpacity, defaultSharePresentation.panelOpacity, 4, 55),
    typography: normalizeChoice(record.typography, typographyIds, defaultSharePresentation.typography),
    density: normalizeChoice(record.density, densityIds, defaultSharePresentation.density),
    imageFit: normalizeChoice(record.imageFit, imageFitIds, defaultSharePresentation.imageFit),
    textScale: normalizeChoice(record.textScale, textScaleIds, defaultSharePresentation.textScale)
  };
}

export function createSharePresentation(input: {
  layout: unknown;
  backgroundPositionX: unknown;
  backgroundPositionY: unknown;
  panelOpacity: unknown;
  typography?: unknown;
  density?: unknown;
  imageFit?: unknown;
  textScale?: unknown;
}): SharePresentation {
  return parseSharePresentation({
    layout: input.layout,
    backgroundPosition: {
      x: input.backgroundPositionX,
      y: input.backgroundPositionY
    },
    panelOpacity: input.panelOpacity,
    typography: input.typography,
    density: input.density,
    imageFit: input.imageFit,
    textScale: input.textScale
  });
}

export function serializeSharePresentation(presentation: SharePresentation): string {
  return JSON.stringify(parseSharePresentation(presentation));
}
