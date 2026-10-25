export const currentReleaseNotes = {
  "date": "2026-10-25",
  "highlights": {
    "zh": [
      "v1.5.0 三个阶段已交付：精简收藏、录入、详情、分享与寻卡；数据移除重复搜索、分析快照及比较；设置收拢为四项及底部帮助，AI 配置集中展示。",
      "主导航归并为收藏、展示、数据；统一整理收藏入口，收藏筛选直接用于选卡导出，设置保留导出全部数据。AI 组合分析保留。",
      "图片提前展示，财务和 AI 工具按需展开；自动草稿保留，模板与批量队列集中到录入工具。",
      "单卡隐藏空档案字段，财务统一从新增财务记录进入，依次选择买入、卖出、费用、估值；历史记录与图表按需查看。",
      "分享改为选卡、预览保存两步；AI 文案辅助、自定义设计和视觉微调按需使用，保留已有内容与设置。",
      "数据库表、字段和备份及导入导出格式保持兼容；按本轮授权一次性清理旧寻卡、心愿及分析历史，其他卡片、财务与分享数据保留。",
      "清理失效组件与样式，分离数据导航、聚合及说明内容，共用历史清理安全流程和发布脚本白名单；更新 Electron 与间接依赖的安全修复版本。"
    ],
    "en": [
      "v1.5.0 completes all three stages: simpler Collection, entry, details, sharing and Scout; no duplicate Data search, snapshots or comparison; four Settings groups with footer help and directly visible AI configuration.",
      "Navigation is Collection, Showcase and Data. Review collection has one workspace; export uses Collection filters and selection. Settings retains Export all data. AI portfolio analysis remains.",
      "Images appear earlier. Finance and AI tools expand on demand; automatic drafts remain, with templates and batch queues grouped under Entry tools.",
      "Card details omit empty archive fields. Add Financial Record offers Purchase, Sale, Expense and Valuation in order; history and charts appear on demand.",
      "Sharing uses two steps: select cards and preview/save. AI writing, custom design and visual fine-tuning are optional; existing content and settings remain.",
      "Tables, fields and backup/import/export formats remain compatible. The authorized one-time resets remove old Scout, wish and analysis history; other card, financial and share data remains.",
      "Remove unused components and styles; separate Data navigation, aggregation and guide content; share reset safeguards and the release-script allowlist; update Electron and transitive dependencies to patched versions."
    ]
  }
} as const;
