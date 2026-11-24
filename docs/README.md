# Card Vault 文档

本页是文档总入口。当前规则按领域维护，具体版本的变化、验证和交付状态只记录在对应版本说明中。

<a id="current-release"></a>
## 当前版本

[v1.7.0 版本说明](./release-v1.7.0.md)汇总访客、财务图表与 AI 展馆图更新。Windows 下载见 [v1.7.0](https://github.com/qlinter/card-vault/releases/tag/v1.7.0)，以前版本见[历史资料](./history/README.md)。

## 当前规则

| 需要了解的内容 | 维护入口 |
| --- | --- |
| 展墙、浏览展馆、回顾、目标与寻卡，以及分享编辑、静态导出和人工发布 | [收藏、展示与分享](./collection-guide.md) |
| 本地账户、导入导出、备份恢复、存储维护，以及 AI 网络与代理 | [数据与本机配置](./data-guide.md) |
| 交易、持仓、估值、汇率、统计四页签与整理提醒 | [统计与财务模型](./financial-history-model.md) |
| 字体、字级、控件、主题与扩展 | [设计规范](./design-system.md) |
| 开发环境、代码职责、检查、文档维护及 Windows 分发 | [开发维护](./development.md) |

应用内日常说明位于“设置 → 帮助与版本 → 使用说明”，中英文内容集中在 [user-guide-content.ts](../lib/user-guide-content.ts)，由 [UserGuide](../components/user-guide.tsx) 渲染。应用内只保留操作指引；这里维护统计口径、数据边界和工程约束。

## 历史资料

[版本历史](./history/README.md)保存完整的中英文摘要、资料来源和缺失范围，链接[逐版发布记录](./history/releases.md)及[开发与审查记录](./history/development.md)。历史内容记录当时事实，不随新版本重写，也不作为当前功能或授权的依据。

## 更新原则

一次功能变更只更新所属领域文档；界面操作改变时再同步应用内说明。版本变化和测试数字只写入对应版本说明，README 与本页链接过去。没有新的已确认工作时不另建路线图、评估报告或进度日志。具体流程见[文档维护](./development.md#documentation)。
