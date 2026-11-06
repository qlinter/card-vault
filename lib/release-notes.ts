export const currentReleaseNotes = {
  "date": "2026-11-07",
  "highlights": {
    "zh": [
      "新增收藏回顾：从统计页进入，按年或月查看购入数量与录入档案，保留当前筛选范围。",
      "回顾随期间与口径自动切换，支持临时调整代表卡片和标题并生成 PNG；不再保存历史，私密内容通过紧凑开关控制。",
      "新增沉浸式赏卡：四种展馆风格与构图使用下拉选择，支持顺序/随机、1–3600 秒自定义间隔、首图/全部模式、缩放、旋转和展馆独立全屏；退出保留原页面。",
      "修复删除自定义 AI 配置后输入和选项失效的问题，改用页面内确认并恢复焦点。",
      "统一界面设计与回顾统计实现；沿用 v1.5.1 完整数据格式，移除早期结构升级、来源转换和历史自动清理。",
      "删除卡片前核对档案、图片、财务和关联记录；旧确认页遇到后续修改时保留数据，核对最新内容后可重新确认。",
      "证书号精确匹配独立查询并优先显示，避免被最近 40 张同主体卡片挤出候选。",
      "上传图片执行有像素上限的完整解码校验，拒绝损坏文件并保留合法原图。",
      "备份状态读取成功且尚无记录时，明确显示当前收藏库尚无成功备份记录。"
    ],
    "en": [
      "Collection Recaps open from Statistics, with yearly or monthly purchase quantities and entry records within the current filters.",
      "Recaps update automatically with period and basis filters. Adjust representatives and titles temporarily, then generate a PNG. Saved history is removed; a compact switch controls private content.",
      "Immersive Viewing offers dropdowns for four gallery styles and compositions, sequential/random order, custom 1–3600-second intervals, First/All image modes, zoom, rotation and gallery-only fullscreen. Exiting preserves the original page.",
      "Custom AI profile deletion uses inline confirmation and restores focus, avoiding unresponsive inputs and selectors.",
      "Unified interface design and recap calculations. Complete v1.5.1 data works directly; earlier schema upgrades, source conversions and automatic history resets are removed.",
      "Card deletion checks the archive, images, financial history and related records. Stale confirmations preserve data so the latest content can be reviewed before confirming again.",
      "Exact certificate matches are queried independently and shown first, so older matches are not displaced by the 40 most recent cards with the same subject.",
      "Image uploads are fully decoded within a pixel limit. Damaged files are rejected while valid original bytes are preserved.",
      "After backup settings load successfully, collections without a backup show an explicit no-successful-backup status."
    ]
  }
};
