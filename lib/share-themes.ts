type ShareTheme = {
  id: string;
  label: string;
  description: string;
  category: string;
  backgroundImagePath: string;
};

export const shareThemes = [
  {
    id: "spotlight",
    label: "聚光灯展馆",
    description: "深色舞台、金色细节和强对比，突出稀有卡与明星卡。",
    category: "通用主题",
    backgroundImagePath: "/share-themes/spotlight-gallery.webp"
  },
  {
    id: "archive",
    label: "经典档案馆",
    description: "浅色纸张、海军蓝和暖金色，强调生涯记录与收藏历史。",
    category: "通用主题",
    backgroundImagePath: "/share-themes/archive-gallery.webp"
  },
  {
    id: "football",
    label: "足球赛场",
    description: "草坪绿、白色场线和球场节奏，适合俱乐部与国家队收藏。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/football-pitch.webp"
  },
  {
    id: "basketball",
    label: "篮球主场",
    description: "木地板橙、球馆蓝和环形灯光，突出球星、号码与比赛记忆。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/basketball-home-court.webp"
  },
  {
    id: "tennis",
    label: "网球中心",
    description: "硬地蓝、荧光黄与利落斜线，呈现大满贯和竞技速度感。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/tennis-center.webp"
  },
  {
    id: "f1",
    label: "F1 维修区",
    description: "碳纤维黑、竞速红和仪表盘细节，强调车手、车队与赛道。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/f1-pit-lane.webp"
  },
  {
    id: "nerazzurri",
    label: "蓝黑军团-1",
    description: "明亮典藏感的蓝黑球队背景，适合突出传奇球星、经典赛季和荣誉叙事。",
    category: "球队主题",
    backgroundImagePath: "/share-themes/nerazzurri-1.webp"
  },
  {
    id: "nerazzurri-2",
    label: "蓝黑军团-2",
    description: "深色主场氛围的蓝黑球队背景，适合更有冲击力的核心球星和冠军主题收藏。",
    category: "球队主题",
    backgroundImagePath: "/share-themes/nerazzurri-2.webp"
  }
] as const satisfies readonly ShareTheme[];

export type ShareThemeId = (typeof shareThemes)[number]["id"];

const shareThemeById = new Map<string, (typeof shareThemes)[number]>(shareThemes.map((theme) => [theme.id, theme]));

export function normalizeShareTheme(value: unknown): ShareThemeId {
  return typeof value === "string" && shareThemeById.has(value) ? (value as ShareThemeId) : "spotlight";
}

export function shareThemeBackgroundPath(value: unknown): string {
  return shareThemeById.get(normalizeShareTheme(value))?.backgroundImagePath ?? shareThemes[0].backgroundImagePath;
}
