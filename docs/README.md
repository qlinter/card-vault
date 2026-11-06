# Card Vault 文档

本页是文档总入口。当前规则按领域维护，具体版本的变化、验证和交付状态只记录在对应版本说明中。

<a id="current-release"></a>
## 当前版本

[v1.5.2 版本说明](./release-v1.5.2.md)包含最终功能、结构审查、数据边界、依赖审计、定版验证及分发校验值。经用户确认，安装包和便携包已生成并通过完整发布验证；[下载入口](https://github.com/qlinter/card-vault/releases/tag/v1.5.2)提供分发文件与构建记录。

## 当前规则

| 需要了解的内容 | 维护入口 |
| --- | --- |
| 展墙、单卡图片、浏览展馆、收藏回顾、目标与寻卡 | [收藏、展示与回顾](./collection-guide.md) |
| 统计四页签、筛选范围、数量口径、活动与整理提醒 | [数据分析](./data-analysis-guide.md) |
| 导入、导出、备份恢复、路径迁移、数据健康、当前数据格式 | [数据管理与备份](./data-guide.md) |
| 交易、费用、持仓、估值、汇率与收益计算 | [财务与持仓模型](./financial-history-model.md) |
| 分享集编辑、展示协议、静态导出与 Cloudflare Drop 人工发布 | [分享展馆](./share-gallery.md) |
| 字体、字级、控件、主题与扩展 | [设计规范](./design-system.md) |
| 自动／直连／手动代理、认证及设备配置 | [AI 网络与代理](./ai-proxy-guide.md) |
| 开发环境、代码职责、验证命令、文档维护规则 | [开发维护](./development.md) |
| Windows 打包、签名、产物检查与工作流 | [Windows 分发](./windows-code-signing.md) |

应用内日常说明位于“设置 → 帮助与版本 → 使用说明”，中英文内容集中在 [user-guide-content.ts](../lib/user-guide-content.ts)，由 [UserGuide](../components/user-guide.tsx) 渲染。应用内只保留操作指引；这里维护统计口径、数据边界和工程约束。

## 历史资料

[版本历史](./history/README.md)保存完整的中英文摘要、资料来源和缺失范围，链接[逐版发布记录](./history/releases.md)及[开发与审查记录](./history/development.md)。历史内容记录当时事实，不随新版本重写，也不作为当前功能或授权的依据。

## 更新原则

一次功能变更只更新所属领域文档；界面操作改变时再同步应用内说明。版本变化和测试数字只写入对应版本说明，README 与本页链接过去。没有新的已确认工作时不另建路线图、评估报告或进度日志。具体流程见[文档维护](./development.md#documentation)。
