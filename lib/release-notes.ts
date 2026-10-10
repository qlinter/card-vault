export const currentReleaseNotes = {
  date: "2026-10-10",
  highlights: {
    zh: [
      "组合按批次读取财务历史，降低大收藏量的峰值内存，保持持仓、收益与历史曲线一致。",
      "备份恢复增加磁盘操作记录，进程中断后自动恢复正确目录，失败保留原数据。",
      "返回上一页跳过编辑状态，保存或取消编辑后可回到原筛选结果。",
      "每笔交易录入一种币种，移除另一币种金额和金额不完整选项；估值来源统一为个人估值、卡淘成交、eBay成交和 Others。",
      "历史近期成交转为卡淘，恢复时只转换暂存副本，保留备份原件和金额事实。",
      "合并财务表单与发布检查，移除冗余投入小计状态，拆分全局样式并同步项目文档。"
    ],
    en: [
      "Portfolio reads financial history in batches to reduce peak memory while preserving quantities, returns and historical charts.",
      "Restore journals recover the correct storage directory after process interruption and retain original data on failure.",
      "Back skips editing states and returns to the original filtered results after saving or cancelling.",
      "Each transaction uses one currency. Extra-currency and incomplete-amount controls are removed; valuation sources are Personal Valuation, KaTao Sale, eBay Sale and Others.",
      "Historical recent-sale sources become KaTao. Restore converts only the staging copy and retains original backups and financial facts.",
      "Shared financial forms and package checks replace duplicated code; subtotal state is removed, global styles are split and documentation is synchronized."
    ]
  }
} as const;
