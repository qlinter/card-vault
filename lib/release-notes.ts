export const currentReleaseNotes = {
  date: "2026-10-13",
  highlights: {
    zh: [
      "首页依次展示估值、卡片和收藏概览，估值金额与卡片总数同字号放大、内容对齐；概览以淡线区分活动数量及待整理，统计周期静默保存。",
      "寻卡提供跨站查询和心愿单，卡淘、eBay 与 130 Point 采用官方 Logo 和整块可点击的外站入口；复制关键词位于保存按钮之后。",
      "已保存关键词采用对齐的分隔列表，支持分页及箭头折叠，删除操作统一收至顶部；仅保留搜索文本及心愿关联，不提供编辑、商品、价格与研究功能。",
      "心愿支持搜索、排序、多个关联关键词及可选目标数量，保留部分入藏进度，达到目标后实现；多卡选择支持跨页勾选、仅看已选和增减摘要，最多绑定 500 张。",
      "查看入藏卡片进入首页展示关联收藏；卡片详情可返回心愿。重新计划与取消提供影响说明及 30 秒撤销；首页支持状态筛选和整理撤销。",
      "心愿草稿按收藏在本机恢复，筛选、分页与展开位置在窗口会话中恢复；关键词和心愿可分别导出 CSV，绑定详情按需加载。",
      "合并导出快照与清理流程，移除旧计划接口和无用样式；改善页面等待、异常恢复与组合财务聚合，保留独立对照测试和完整备份。本版无自动更新或到价提示。"
    ],
    en: [
      "Home shows Valuation, Cards and Collection overview in that order, with matching larger numbers and aligned content. A subtle divider separates activity and review counts; period changes save quietly.",
      "Scout provides Cross-site search and Wishlist with official logos and whole clickable entries for Cardhobby, eBay and 130 Point, and Copy keywords after Save keywords.",
      "Saved keywords use aligned divider rows, pagination, an arrow to collapse the list and one Delete action above it. Only search text and wish links remain; editing and research features are removed.",
      "Wishes support search, sorting, linked keywords and optional targets, retaining partial progress until completion. Multi-card selection supports multiple pages, selected-only views and change summaries, up to 500 cards.",
      "View acquired cards opens their filtered collection on Home; card details return to wishes. Replanning and cancellation explain their impact and offer 30-second undo. Home adds status filters and review undo.",
      "Wish drafts recover locally per collection; filters, pages and expanded context recover within the window session. Keywords and wishes export separate CSV lists; binding details load on demand.",
      "Export snapshots and cleanup are shared, obsolete planning endpoints and styles are removed. Navigation, recovery and aggregation improve with independent reference tests and full backups. No automatic refresh or price alerts."
    ]
  }
} as const;
