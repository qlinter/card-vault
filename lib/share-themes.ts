type ShareTheme = {
  id: string;
  label: string;
  description: string;
  category: string;
  backgroundImagePath: string;
  tokens: {
    text: string;
    muted: string;
    accent: string;
    panelRgb: string;
    line: string;
  };
};

export const shareThemes = [
  {
    id: "spotlight",
    label: "聚光灯展馆",
    description: "深色舞台、金色细节和强对比，突出稀有卡与明星卡。",
    category: "通用主题",
    backgroundImagePath: "/share-themes/spotlight-gallery.webp",
    tokens: { text: "#f6f8fb", muted: "#c4ccd8", accent: "#d7bb7a", panelRgb: "8, 14, 24", line: "rgba(255,255,255,0.24)" }
  },
  {
    id: "archive",
    label: "经典档案馆",
    description: "浅色纸张、海军蓝和暖金色，强调生涯记录与收藏历史。",
    category: "通用主题",
    backgroundImagePath: "/share-themes/archive-gallery.webp",
    tokens: { text: "#1b2d49", muted: "#52627a", accent: "#a36f24", panelRgb: "255, 255, 255", line: "rgba(36,57,88,0.2)" }
  },
  {
    id: "football",
    label: "足球赛场",
    description: "草坪绿、白色场线和球场节奏，适合俱乐部与国家队收藏。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/football-pitch.webp",
    tokens: { text: "#f5fbf4", muted: "#d2e7d7", accent: "#cde83d", panelRgb: "3, 35, 24", line: "rgba(205,232,61,0.34)" }
  },
  {
    id: "basketball",
    label: "篮球主场",
    description: "木地板橙、球馆蓝和环形灯光，突出球星、号码与比赛记忆。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/basketball-home-court.webp",
    tokens: { text: "#fff8ee", muted: "#ead0b5", accent: "#ffc46d", panelRgb: "47, 24, 19", line: "rgba(255,196,109,0.38)" }
  },
  {
    id: "tennis",
    label: "网球中心",
    description: "硬地蓝、荧光黄与利落斜线，呈现大满贯和竞技速度感。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/tennis-center.webp",
    tokens: { text: "#f4fbff", muted: "#d2e5ef", accent: "#d8ef44", panelRgb: "4, 36, 61", line: "rgba(216,239,68,0.36)" }
  },
  {
    id: "f1",
    label: "F1 维修区",
    description: "碳纤维黑、竞速红和仪表盘细节，强调车手、车队与赛道。",
    category: "运动主题",
    backgroundImagePath: "/share-themes/f1-pit-lane.webp",
    tokens: { text: "#f7f8fa", muted: "#c7cbd3", accent: "#f0524e", panelRgb: "8, 10, 14", line: "rgba(240,82,78,0.4)" }
  },
  {
    id: "nerazzurri",
    label: "蓝黑军团-1",
    description: "明亮典藏感的蓝黑 Team 背景，适合突出传奇球星、经典赛季和荣誉叙事。",
    category: "Team 主题",
    backgroundImagePath: "/share-themes/nerazzurri-1.webp",
    tokens: { text: "#10233c", muted: "#3f5875", accent: "#004e9a", panelRgb: "255, 255, 255", line: "rgba(0,78,154,0.22)" }
  },
  {
    id: "nerazzurri-2",
    label: "蓝黑军团-2",
    description: "深色主场氛围的蓝黑 Team 背景，适合更有冲击力的核心球星和冠军主题收藏。",
    category: "Team 主题",
    backgroundImagePath: "/share-themes/nerazzurri-2.webp",
    tokens: { text: "#f2f7ff", muted: "#c1cee0", accent: "#d9ad54", panelRgb: "3, 12, 28", line: "rgba(217,173,84,0.36)" }
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

export function shareThemeCssVariables(value: unknown): Record<string, string> {
  const theme = shareThemeById.get(normalizeShareTheme(value)) ?? shareThemes[0];
  return {
    "--gallery-text": theme.tokens.text,
    "--gallery-muted": theme.tokens.muted,
    "--gallery-accent": theme.tokens.accent,
    "--gallery-panel-rgb": theme.tokens.panelRgb,
    "--gallery-line": theme.tokens.line
  };
}
