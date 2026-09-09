# Card Vault 文档

当前版本 v1.3.2；Windows x64 未签名安装包与便携包已于 2026-09-09 生成，包内运行、版本、内容及 SHA-256 检查通过；尚未上传发布。版本范围、代码优化及本批验收统一见 [v1.3.2 发布说明](./release-v1.3.2.md)，旧产物事实保留在各版发布文档。

## 入口与规划

- [中文 README](../README.md) / [English README](../README.en.md)：功能、启动、最新版本详细更新和全部历史版本摘要。
- [v1.3.2 发布说明](./release-v1.3.2.md)：当前修复、代码优化、格式边界、性能与发布验收。
- [版本历史资料说明](./version-history-sources.md)：Git 来源及早期独立文档缺失范围。
- [产品路线图](./product-roadmap.md) / [Product Roadmap](./product-roadmap.en.md)：能力状态与后续优先级。

## 现行规范

- [数据与计划](./data-center-guide.md)：导入预演、撤销、导出、提醒、心愿单与规模基准。
- [分享展馆](./share-gallery.md)：制作、展示协议、预览及导出。
- [财务历史与持仓模型](./financial-history-model.md)：实物数量、付款、费用、估值、人工汇率及收益。
- [数据备份](./data-backup-guide.md)：当前格式、存储、清单校验、恢复、换机及数据健康。
- [Cloudflare Drop 临时发布](./cloudflare-drop-publishing.md)：人工发布流程、文件及隐私边界。
- [Windows 代码签名](./windows-code-signing.md)：打包流程、可选签名及产物校验。

应用内操作说明从“设置 → 使用说明”展开，由 [UserGuide](../components/user-guide.tsx) 维护中英文；工程约束保留在规范中。

## 历史版本

以下保留各版本发布时事实，不表示当前行为、兼容范围或下载状态：

- [v1.3.1](./release-v1.3.1.md)
- [v1.3.0](./release-v1.3.0.md)
- [v1.2.1](./release-v1.2.1.md)、[v1.2.0](./release-v1.2.0.md)
- [v1.1.1](./release-v1.1.1.md)、[v1.1.0](./release-v1.1.0.md)
- [v1.0.19](./release-v1.0.19.md)、[v1.0.18](./release-v1.0.18.md)、[v1.0.17](./release-v1.0.17.md)
- [v1.0.16](./release-v1.0.16.md)、[v1.0.15](./release-v1.0.15.md)、[v1.0.14](./release-v1.0.14.md)
- v1.0.0–v1.0.13：独立发布说明未找到，Git 恢复简史保留在两份 README 中，见[资料出处](./version-history-sources.md)。

## 维护规则

中英文 README 保持同结构与版本范围：最新版本详细介绍，全部旧版本逐项简述。发布新版时将上一版细节保存在对应发布说明并新增历史摘要，不删除旧版本条目。功能规范描述当前规则，路线图记录后续优先级，发布说明汇总版本变化、验收与分发事实，不再平行维护重复的审核、进度和维护日志。

功能变更同步对应规范、应用内说明和双语文档。源码验收、打包验证与真实环境测试分开记录；未打包代码不能使用旧包验证结果。历史资料缺失明确注明，不推测补全。数据库结构标记与产品版本独立维护，兼容范围以完整格式校验为准。
