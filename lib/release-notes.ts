export const currentReleaseNotes = {
  "date": "2026-11-02",
  "highlights": {
    "zh": [
      "AI 默认服务改为 OpenAI 官方配置，预填官方 Endpoint 与 gpt-5.4-mini；MiniMax、DeepSeek 保持不变，已有 Azure 设置保留为自定义配置。",
      "收藏与展示的单卡页面新增图片导出：单张原图、多张 ZIP；入口使用图标，展示页导出位于查看大图图标右侧。",
      "主导航“数据”更名为“统计”，首页组合入口统一为“查看组合统计”和“查看筛选组合统计”。",
      "同一次录入的重试、双击及并发提交只生成一份卡片、图片和初始财务记录；独立录入仍可收藏同款卡。",
      "卡片、财务和分享编辑检查来源版本，冲突保留输入；财务删除和分享草稿同样受保护，草稿同步失败停止入库。",
      "AI 支持按设备保存的自动、直连及手动 HTTP/HTTPS/SOCKS5 代理、认证、网段绕过与系统规则；无法解密时保留原凭据，设置操作按钮统一为灰色。"
    ],
    "en": [
      "OpenAI is the default built-in provider, with the official endpoint and gpt-5.4-mini prefilled. MiniMax and DeepSeek are unchanged; saved Azure settings remain as custom profiles.",
      "Card pages export one original image or a ZIP of multiple images. Both actions use icons; Showcase export sits beside the full-image icon.",
      "The Data navigation label becomes Statistics. Home links use View portfolio statistics and View filtered portfolio statistics.",
      "Retries, double clicks and concurrent submissions of one entry create one card, image set and initial financial history. Separate entries still support identical cards.",
      "Card, financial and share edits check their source version and retain input on conflict. Financial deletion and restored share drafts are protected; failed draft synchronization stops entry.",
      "AI supports device-local Automatic, Direct and manual HTTP/HTTPS/SOCKS5 proxies, authentication, subnet bypass and system rules. Undecryptable credentials are preserved; Settings action buttons use gray."
    ]
  }
};
