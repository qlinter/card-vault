# Card Vault 文档索引

当前版本 v1.3.0。经用户确认，Windows x64 安装包与便携包已在本地生成并通过包内验证；文件大小与 SHA-256 见[发布说明](./release-v1.3.0.md)。

## 状态与规划

- [开发进度与验收](./v1.3.0-implementation.md)：当前完成状态、实际验证和待确认事项的唯一记录。
- [项目代码审核](./project-assessment-2026-09-07.md)：审核范围、发现与处理、兼容保留及未验证边界。
- [产品路线图](./product-roadmap.md) / [Product Roadmap](./product-roadmap.en.md)：能力状态与后续优先级。
- [v1.3.0 更新说明](./release-v1.3.0.md)：最终版本变化、兼容和分发状态。

## 现行规范

- [数据与计划](./data-center-guide.md)：导入预演、撤销、导出、提醒、心愿单及规模基准。
- [分享展馆](./share-gallery.md)：制作、设计协议、兼容、预览与导出。
- [财务历史与持仓模型](./financial-history-model.md)：交易、费用、估值、实物数量、人工汇率和收益。
- [数据备份](./data-backup-guide.md)：存储、清单校验、恢复、换机及数据健康。
- [Cloudflare Drop 临时发布](./cloudflare-drop-publishing.md)：人工发布、包内文件与隐私边界。
- [Windows 代码签名](./windows-code-signing.md)：经确认后的打包流程、可选签名与产物验证。

应用内操作说明统一从“设置 → 使用说明”展开，覆盖全部栏目；由 [UserGuide](../components/user-guide.tsx) 维护中英文内容。工程规范负责数据约束与实现边界，避免将全部开发细节塞入操作界面。

## 历史版本

以下文档保留各自发布时的事实，不代表当前行为或当前可用下载：

- [v1.2.1](./release-v1.2.1.md)、[v1.2.0](./release-v1.2.0.md)
- [v1.1.1](./release-v1.1.1.md)、[v1.1.0](./release-v1.1.0.md)
- [v1.0.19](./release-v1.0.19.md)、[v1.0.18](./release-v1.0.18.md)、[v1.0.17](./release-v1.0.17.md)
- [v1.0.16](./release-v1.0.16.md)、[v1.0.15](./release-v1.0.15.md)、[v1.0.14](./release-v1.0.14.md)

## 维护规则

README 提供启动入口；功能规范描述最终行为；开发进度记录当前验收；路线图只记录下一步；版本说明概括变化。已撤回设计不继续追加为当前规格，旧测试结果不能冒充当前源码验收。功能变更同步应用内使用说明和对应规范，中英文 README/路线图保持同范围。数据库结构版本与产品版本分开维护，保留明确的兼容边界。
