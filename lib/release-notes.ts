export const currentReleaseNotes = {
  date: "2026-10-04",
  highlights: {
    zh: [
      "新增经典、极简展厅、午夜典藏、暖纸档案四种应用主题，记忆用户选择并保留原有字体设计。",
      "经典主题各页面统一使用首页背景，主题设置仅保留预览、名称和选中状态。",
      "详情页统一使用“财务”，精简卡片编辑页标题、说明及重复财务入口。",
      "首页、展示及数据导出的视图切换统一使用图标。",
      "AI 设置统一 Endpoint 和 API Key 名称，调整新增自定义 AI 入口并移除冗余提示。",
      "移除旧目标卡、旧图片路径及旧快照的兼容分支，合并更新项目文档。",
      "更新依赖安全补丁，补充主题和当前格式校验的回归验证。"
    ],
    en: [
      "Added Classic, Minimal Gallery, Midnight Collection and Warm Archive application themes, preserving typography and remembering the selected theme.",
      "Classic uses the Home background throughout the application. Theme settings show only previews, names and selection state.",
      "Renamed the detail section to Finance and removed redundant finance links, edit-page headings and helper text.",
      "Unified view-switch icons across Home, Showcase and data export.",
      "Standardized Endpoint and API Key labels, moved Add Custom AI beside service selection and removed redundant messages.",
      "Removed compatibility branches for retired target cards, old media paths and old snapshots, and consolidated project documentation.",
      "Updated dependency security patches and regression checks for themes and current data formats."
    ]
  }
} as const;
