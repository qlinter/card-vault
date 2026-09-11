# Card Vault

简体中文 | [English](./README.en.md)

Card Vault 是本地优先的 Windows 球星卡收藏管理应用，基于 Next.js、React、Prisma、SQLite 和 Electron。收藏档案、图片和财务历史保存在本机；AI 和分享托管为可选外部服务。

## 当前状态

源码版本：`1.3.3`（2026-09-11），汇总 DeepSeek 接入、页面改进与架构整理。范围和验证记录见 [v1.3.3 发布说明](./docs/release-v1.3.3.md)。

经用户确认，已于 2026-09-11 生成 Windows x64 未签名安装包 `dist/card-vault-1.3.3-setup.exe`、便携包 `dist/card-vault-1.3.3-portable.zip` 和 `dist/SHA256SUMS.txt`。完整发布检查、包内业务运行、版本、文件内容及 SHA-256 验证通过；尚未上传发布。旧版产物事实保留在历史发布说明中。

## 最新版本：v1.3.3

1. **DeepSeek**：新增独立配置，默认官方 `deepseek-flash` 模型，支持原生图像输入、连接测试与模型列表，沿用 Windows 加密存储。
2. **财务布局**：对齐每张卡片的财务历史金额和编辑入口；持仓指标采用统一的文字、金额列，编辑展开后按钮位置稳定。
3. **组合与筛选**：简化成本/估值排序及组合栏目名称，修复集中度对齐、长产品线换行和售出复盘日期列，减少重复文案与结构卡片空白。
4. **AI 配置收敛**：Electron、服务端和界面共用默认值、类型、公开配置与草稿合并规则；未修改的密钥保留，明确清空时删除，配置之间按 ID 隔离。
5. **代码架构**：删除 6 个过时财务提交入口，拆分分享 HTML、CSS 和浏览器脚本，消除两组类型循环引用；保持原有渲染入口和导出内容。
6. **维护门槛**：新增循环依赖与客户端/服务端边界检查，纳入发布门槛，并补充配置兼容性和财务/组合界面回归。

数据库结构、财务核算规则及备份格式保持不变。新增 DeepSeek 配置兼容旧版 v5 设置；真实服务识别效果需使用用户自己的密钥验证。本版源码验收和包内验证已分别完成；真实 Windows 安装升级验证仍暂缓。

## 功能概览

- 首页：搜索、筛选、全局财务排序、分页加载与可记忆的卡片/列表视图。
- 卡片：最多 5 张图片、旋转、草稿、连续录入、模板、重复提示、批量图片队列及需人工确认的 AI 候选。
- 财务：统一实物数量、CNY/USD 混合付款、移动平均成本、交易/费用/估值历史、人工汇率及明确的缺失数据提示。
- 展示与组合：收藏浏览、结构与历史趋势、质量清单、收藏视图、冻结快照和比较。
- 分享：可编辑展馆、主题/章节/单卡故事、统一预览与静态导出、现有人工 Drop 发布流程。
- 计划：180 天整理提醒、7/30 天摘要、心愿单与分币种预算。
- 设置：依次提供数据、AI、财务、使用说明、关于；数据向下展开，集中管理存储、备份与恢复、导入、导出。
- 数据：CSV/XLSX 映射预演、档案更新、逐行重试及冲突保护撤销；完整备份包含数据库、媒体与管理状态。

本项目没有独立手机应用。390px 等窄视口仅验证分享网页在手机浏览器中的阅读效果。长期在线发布管理、多设备同步和系统摘要通知均不属于当前交付范围。

## 本地开发

使用 Node.js 24 和锁文件指定依赖：

```powershell
npm ci
npm run db:init
npm run build
npm run electron
```

也可通过 `start-desktop.bat` 启动桌面开发版。启动器优先使用 3000–3019；端口被占用或被 Windows 保留时，由系统分配可用回环端口，无需修改系统端口保留规则。开发配置位于 `%APPDATA%\Card Vault Development`；收藏存储位置以“设置 → 数据 → 存储”的实际显示为准。更换路径请使用应用提供的迁移入口。

API Key 保存在本机用户配置目录，并通过 Windows safeStorage 加密，不写入收藏数据库。可选 AI 支持 Azure OpenAI、MiniMax、DeepSeek 和 OpenAI Chat Completions 兼容服务；调用时相关图片或内容会发送给所选服务。手动录入无需 AI。

## 验证与分发

| 命令 | 用途 |
| --- | --- |
| `npm run check:release` | 编码、文档、版本、架构、Lint、类型、覆盖率、生产构建、桌面启动及全部 HTTP/UI 验证；不打包。 |
| `npm run check:architecture` | 检查源码循环依赖及客户端误用 Node.js/数据库模块。 |
| `npm test` | 单元与模块测试。 |
| `npm run test:card` / `test:share` / `test:security` / `test:management` / `test:export` | 隔离数据下的业务与安全 HTTP 流程。 |
| `npm run test:ui` | 桌面界面、最小窗口、分享窄视口与严格截图比较。 |
| `npm run test:desktop` | 使用真实服务验证端口竞争、会话保护与服务重启。 |
| `npm run benchmark` | 1k/5k/10k 合成收藏的隔离性能基准。 |
| `npm run benchmark:dense` | 1k/5k/10k 卡片的密集财务历史与合成图片基准。 |
| `npm run benchmark:portfolio-history` | 与冻结旧实现对照每月完整输出及计算耗时。 |
| `npm run benchmark:export` | 1k/10k 卡片流式导出的完整性、耗时和服务进程内存。 |
| `npm run audit:all` / `audit:prod` | 联网检查全部依赖或仅生产依赖；CI 使用全部依赖审计，覆盖打包工具。 |
| `npm run release:win` | 经确认后执行：完整门槛、安装包、便携 ZIP、包内冒烟和 SHA-256 校验。 |
| `npm run verify:release-artifacts` | 对已生成产物核对版本、结构、签名模式与校验值。 |

安装版使用向导，可选择安装目录。便携版需完整解压，再运行同目录的 `Card Vault.exe`；不能只移动 EXE。目标电脑不需要安装 Node.js。签名配置与发布步骤见[Windows 代码签名](./docs/windows-code-signing.md)。

升级、换机或重装前应保存完整备份。CSV/XLSX 不含恢复所需的全部媒体和应用状态，不能替代备份。仅支持完整的当前数据库格式；恢复要求有效备份清单，不再升级旧数据，详见[数据备份说明](./docs/data-backup-guide.md)。

## 历史版本更新记录

以下保留全部 27 个历史版本，按新到旧排列；摘要描述各版本发布时的变化，当前行为与兼容范围以最新规范为准。中英文摘要从 v1.2.1 的历史 README 恢复；早期未找到独立发布说明，出处与缺失情况见[版本历史资料说明](./docs/version-history-sources.md)。

| 版本 | 主要变化 | 资料 |
| --- | --- | --- |
| `1.3.2` | 修复依赖安全、启动诊断、配置与恢复保护，优化密集组合历史和流式导出，合并 ZIP 与性能采样。 | [发布说明](./docs/release-v1.3.2.md) |
| `1.3.1` | 修复启动端口、提醒复发、导出范围与恢复回滚，优化财务索引和历史查询，统一当前格式校验与文档。 | [发布说明](./docs/release-v1.3.1.md) |
| `1.3.0` | 统一双币财务与人工汇率，完成导入预演/撤销、整理提醒与计划、首页分页、组合与分享界面及本地安全加固。 | [发布说明](./docs/release-v1.3.0.md) |
| `1.2.1` | 增加中英文界面和可选 Windows 签名，完成分享展馆升级、响应式预览、导出质量检查及项目文档收敛。 | [发布说明](./docs/release-v1.2.1.md) |
| `1.2.0` | 完成组合中心、收藏视图、时间点快照、真实历史趋势与比较，并加入图片旋转、卡片主体术语及展示体验优化。 | [发布说明](./docs/release-v1.2.0.md) |
| `1.1.1` | 增加数量持仓与收益核算、应用内备份恢复、首页缩略图与分批渲染、1/1 筛选，并完成数据库和界面收口。 | [发布说明](./docs/release-v1.1.1.md) |
| `1.1.0` | 完成录入工作台 2.0：草稿恢复、连续录入、批量图片队列、WebP 预处理、模板、重复提示和需确认的 AI 候选。 | [发布说明](./docs/release-v1.1.0.md) |
| `1.0.19` | 修复限量编号卡数据，增加限量卡筛选及 CNY 成本/估值排序，并加固本地服务、Electron sandbox、IPC 与质量门槛。 | [发布说明](./docs/release-v1.0.19.md) |
| `1.0.18` | 优化首页与组合分析渲染性能，加固跨电脑依赖恢复，恢复默认硬件加速，并新增精简的应用版本入口。 | [发布说明](./docs/release-v1.0.18.md) |
| `1.0.17` | 支持多套自定义 AI，提升组合分析成功率并统一五维报告，修复筛选返回上下文，同时完成共享协议与冗余代码整理。 | [发布说明](./docs/release-v1.0.17.md) |
| `1.0.16` | 收敛首页历史查询，建立 Windows 干净环境质量检查、可重复发布候选流程、产物校验和版本元数据保护。 | [发布说明](./docs/release-v1.0.16.md) |
| `1.0.15` | 完成新版 AI 组合分析协议、Electron/存储/分享编辑器进一步拆分、反馈消息统一、路径规则收敛和 Tailwind 清理。 | [发布说明](./docs/release-v1.0.15.md) |
| `1.0.14` | 完成分享编辑器 2.0 与 Drop 导出收口，建立可靠财务历史、历史化组合分析、备份自动迁移及可选 Windows 发布签名。 | [发布说明](./docs/release-v1.0.14.md) |
| `1.0.13` | Azure OpenAI 统一迁移到 v1 API，支持统一资源 Endpoint 与 GPT-5.4 / 5.5 / 5.6 系列。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.12` | 升级核心依赖，加固存储迁移，完善安全导航、筛选上下文与分享展馆编辑器 2.0。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.11` | 完成迁移、恢复、密钥安全、数据健康、组合分析和发布验证基础。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.10` | 增加三套展馆布局、可排序章节、实时预览和统一渲染器。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.9` | 建立通用、运动与 Team 主题系统，统一预览和导出视觉资源。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.8` | 加固存储迁移、图片校验、SQLite 备份、桌面启动和自动化测试。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.7` | 增加分享背景、单卡展示覆盖、编辑能力和 3D 图片切换。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.6` | 将存储路径迁入设置页，增加独立备份路径与一键备份。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.5` | 增加分享集、四步创建向导、AI 展馆文案和静态导出。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.4` | 增加 Azure OpenAI / MiniMax AI 识图录入、统一设置与编码检查。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.3` | 扩展卡片字段、公开状态和高级搜索，并兼容旧数据库。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.2` | 增加评级费用与总投入，修复新增成功提示并完善桌面图标。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.1` | 增加多图上传、展示统计与分组收起，改善录入失败后的信息保留。 | [历史 README](./docs/version-history-sources.md) |
| `1.0.0` | 完成本地卡片管理、筛选、展示、SQLite 存储和 Electron 桌面运行。 | [历史 README](./docs/version-history-sources.md) |

## 项目文档

- [版本历史资料说明](./docs/version-history-sources.md)：历史 README 出处、缺失范围与维护方式。
- [文档索引](./docs/README.md)：现行规范和版本历史。
- [v1.3.3 发布说明](./docs/release-v1.3.3.md)：DeepSeek、页面改进、架构整理、验收与分发状态。
- [路线图](./docs/product-roadmap.md)：后续优先级；[English](./docs/product-roadmap.en.md)。

源码主要位于 `app`、`components`、`lib`、`electron`；`scripts` 负责初始化、测试和发布，`tests` 保存回归及视觉基线。个人数据、密钥、`node_modules`、`.next`、`logs`、`dist` 和测试临时文件均被 Git 忽略。中英文 README 同步保留最新版本的详细说明及所有历史版本的简要记录；完整发布说明和资料出处保存在 `docs`，后续发版不得删除旧版本条目。
