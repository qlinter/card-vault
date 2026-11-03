# Card Vault 文档

当前源码版本为 v1.5.1（2026-11-02；2026-11-03 整理与验收）。本版包含 AI 默认与代理、图片导出、保存可靠性和结构整理。交付与验证边界见 [v1.5.1 发布说明](./release-v1.5.1.md)。

## 入口与规划

- [2026-11-03 项目审查与验收](./assessment-2026-11-03.md)：可靠性整改、结构整理、依赖审计及完整源码发布验收；功能扩展暂缓。

- [AI 网络与代理](./ai-proxy-guide.md)：自动、直连、HTTP/HTTPS/SOCKS5 手动代理、认证及按设备保存。

- [v1.5.1 发布说明](./release-v1.5.1.md)：新增功能、可靠性修复、配置迁移与验证。

- [2026-11-02 开发状态评估](./assessment-2026-11-02.md)：升级前源码复核、问题复现、修复记录与下一阶段准备建议。
- [v1.5.0 发布说明](./release-v1.5.0.md)：第一、二阶段交付、分阶段确认及数据兼容边界。
- [v1.5.0 开发记录](./development-v1.5.0.md)：实施范围与针对性验证。

- [v1.4.2 发布说明](./release-v1.4.2.md)：展示升级、评估修复与本版交付范围。
- [v1.4.2 开发记录](./development-v1.4.2.md)：此前改进迁入、展示实施及针对性验证。
- [收藏展示规范](./showcase-guide.md)：展墙、展签、单卡大图及图片适配规则。

- [v1.4.1 发布说明](./release-v1.4.1.md)：本版功能、结构整理、财务规则及源码验收。
- [v1.4.1 开发记录](./development-v1.4.1.md)：原始版本的分阶段验收与后续版本归属。
- [v1.4.1 Git 更新说明](./git-update-v1.4.1.md)：提交范围、版本标签和 GitHub 同步。

- [应用主题与扩展方式](./app-themes.md)：四种主题风格、持久化与颜色适配。
- [中文 README](../README.md) / [English README](../README.en.md)：功能、启动、最新版本详细更新和全部历史版本摘要。
- [v1.4.0 发布说明](./release-v1.4.0.md)：功能、数据扩展、隔离验收与版本边界。
- [v1.4.0 Git 更新说明](./git-update-v1.4.0.md)：提交内容、结构整理、验证及版本交付。
- [寻卡使用与数据规则](./scout-guide.md)：独立跨站查询、简化心愿、草稿及授权历史清理。
- [数据分析板块](./data-analysis-guide.md)：四页签、共享范围、数量口径、结构下钻及独立趋势范围。
- [v1.3.6 发布说明](./release-v1.3.6.md)：历史更新、结构审查、源码与包内验收、分发校验值和 Git 更新介绍。
- [版本历史资料说明](./version-history-sources.md)：Git 来源及早期独立文档缺失范围。
- [产品路线图](./product-roadmap.md) / [Product Roadmap](./product-roadmap.en.md)：能力状态与后续优先级。

## 现行规范

- [数据管理](./data-center-guide.md)：导入预演、撤销、导出、提醒、心愿单与规模基准。
- [分享展馆](./share-gallery.md)：制作、展示协议、预览及导出。
- [财务与持仓模型](./financial-history-model.md)：实物数量、付款、费用、估值、人工汇率及收益。
- [数据备份](./data-backup-guide.md)：当前格式、存储、清单校验、恢复、换机及数据健康。
- [Cloudflare Drop 临时发布](./cloudflare-drop-publishing.md)：人工发布流程、文件及隐私边界。
- [Windows 代码签名](./windows-code-signing.md)：打包流程、可选签名及产物校验。

应用内操作说明从“设置 → 帮助与版本 → 使用说明”进入，中英文内容统一在[说明内容](../lib/user-guide-content.ts)维护，[UserGuide](../components/user-guide.tsx)负责渲染；工程约束保留在规范中。

## 历史版本

以下保留各版本发布时事实，不表示当前行为、兼容范围或下载状态：

- [v1.3.5](./release-v1.3.5.md)
- [v1.3.4](./release-v1.3.4.md)、[v1.3.3](./release-v1.3.3.md)
- [v1.3.2](./release-v1.3.2.md)
- [v1.3.1](./release-v1.3.1.md)
- [v1.3.0](./release-v1.3.0.md)
- [v1.2.1](./release-v1.2.1.md)、[v1.2.0](./release-v1.2.0.md)
- [v1.1.1](./release-v1.1.1.md)、[v1.1.0](./release-v1.1.0.md)
- [v1.0.19](./release-v1.0.19.md)、[v1.0.18](./release-v1.0.18.md)、[v1.0.17](./release-v1.0.17.md)
- [v1.0.16](./release-v1.0.16.md)、[v1.0.15](./release-v1.0.15.md)、[v1.0.14](./release-v1.0.14.md)
- v1.0.0–v1.0.13：独立发布说明未找到，Git 恢复简史保留在两份 README 中，见[资料出处](./version-history-sources.md)。

## 维护规则

组合聚合由 `lib/portfolio-batch.ts` 编排，分组、财务汇总和月度历史分别放在对应模块。`financial-reporting.ts` 为统一核算入口，币种换算与历史估值投影独立维护。数据页的导航与展示辅助集中在 `portfolio-navigation.ts`，类型在 `portfolio-workspace-types.ts`，`portfolio-workspace.ts` 只负责聚合，`portfolio-data-rows.ts` 负责明细选择；服务缓存以数据修订号与有效期为边界。冻结参考实现只供测试与基准使用，不作为运行时代码依赖。

授权的一次性历史清理由 `scripts/reset-history.js` 统一事务、安全副本及回滚边界，两个业务入口分别定义清理范围与版本顺序。`history-readiness.ts` 按数据库文件身份和已完成版本复用就绪状态，恢复或替换文件后失效，避免每次刷新与写入争用 SQLite。Windows 运行脚本白名单统一在 `scripts/release-runtime-files.js`，打包配置及产物检查共用；测试脚本从源码侧启动包内运行时，不随安装包交付。

项目按职责维护：`app` 负责路由及操作入口，`components` 负责界面，`lib` 负责领域规则和服务，`electron` 负责桌面、存储与 IPC，`scripts` 负责初始化、验收和发布，`tests` 保留回归用例及视觉基线。录入与详情的交易、费用和估值共用 `FinancialRecordFields`；录入与导入的初始财务写入统一由 `lib/card-entry-finance-service.ts` 编排，卡片图片处理保留在卡片录入服务；表单解析与财务核算各自共享，不复制整套页面流程。组合统计在一次计算内复用数量、最新报价和金额，覆盖分母使用统一规则。

`.next`、日志、测试输出和依赖属于可重建内容，不是源码模块；按需使用 `npm run clean:cache` 清理缓存（也会清除日志，请先保存需要留档的验收记录）。`.env`、收藏数据、媒体、备份、桌面配置及历史分发文件不作为冗余源码删除。

中英文 README 保持同结构与版本范围：最新版本详细介绍，全部旧版本逐项简述。发布新版时将上一版细节保存在对应发布说明并新增历史摘要，不删除旧版本条目。功能规范描述当前规则，路线图记录后续优先级，发布说明汇总版本变化、验收与分发事实，不再平行维护重复的审核、进度和维护日志。

功能变更同步对应规范、应用内说明和双语文档。源码验收、打包验证与真实环境测试分开记录；未打包代码不能使用旧包验证结果。历史资料缺失明确注明，不推测补全。数据库结构标记与产品版本独立维护，兼容范围以完整格式校验为准。
