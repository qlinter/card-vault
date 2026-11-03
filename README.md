# Card Vault

简体中文 | [English](./README.en.md)

Card Vault 是本地优先的 Windows 球星卡收藏管理应用，基于 Next.js、React、Prisma、SQLite 和 Electron。收藏档案、图片和财务历史保存在本机；AI 和分享托管为可选外部服务。

## 当前状态

源码版本：`1.5.1`（2026-11-02；2026-11-03 整理与验收）。本版包含 AI 默认与代理配置调整、单卡图片导出、统计入口命名，以及保存可靠性和代码结构整理。详见 [v1.5.1 发布说明](./docs/release-v1.5.1.md)。

本次交付为源码升级，尚未生成或发布 v1.5.1 Windows 分发包。预期文件名为 `card-vault-1.5.1-setup.exe` 和 `card-vault-1.5.1-portable.zip`；历史分发与验证事实保留在 [v1.5.0 发布说明](./docs/release-v1.5.0.md)。

2026-11-03 完整源码发布验收通过：384 项模块测试、177 项界面回归、生产构建及全部本地业务流程。依赖审计无高危或严重告警，31 项中等级告警及处理依据见[审查记录](./docs/assessment-2026-11-03.md)。

## 最新版本：v1.5.1

1. AI 默认服务改为 OpenAI 官方配置，预填官方 Endpoint 与 gpt-5.4-mini；MiniMax、DeepSeek 保持不变，已有 Azure 设置保留为自定义配置。
2. 收藏与展示的单卡页面新增图片导出：单张原图、多张 ZIP；入口使用图标，展示页导出位于查看大图图标右侧。
3. 主导航“数据”更名为“统计”，首页组合入口统一为“查看组合统计”和“查看筛选组合统计”。
4. 同一次录入的重试、双击及并发提交只生成一份卡片、图片和初始财务记录；独立录入仍可收藏同款卡。
5. 卡片、财务及分享编辑检查来源版本，旧表单冲突时保留输入；财务删除与分享草稿同样受保护。草稿同步失败停止入库，失败请求清理自身暂存上传。
6. AI 支持按设备保存的自动、直连及手动 HTTP/HTTPS/SOCKS5 代理、认证、网段绕过与系统候选规则；测试显示脱敏线路。无法解密时保留原凭据；设置各模块操作按钮统一为灰色。

## 功能概览

- 主题：设置中可切换经典、极简展厅、午夜典藏、暖纸档案，保留原有字体设计并记忆选择；分享集主题独立。见[应用主题](./docs/app-themes.md)。
- 首页：搜索、筛选、全局财务排序、分页加载与可记忆的卡片/列表视图（统一图标切换）。
- 卡片：最多 5 张图片、旋转、草稿、连续录入、模板、重复提示、批量图片队列及需人工确认的 AI 候选。
- 财务：统一实物数量、每笔交易一种币种、移动平均成本、交易/费用/估值历史、人工汇率及明确的缺失数据提示。
- 展示与统计：完整卡图展墙、紧凑列表与单卡大图，见[收藏展示](./docs/showcase-guide.md)；统计使用总览、趋势、结构、明细四页签，共享范围并支持实物数量、完整问题清单、当前收藏范围分析，见[数据分析](./docs/data-analysis-guide.md)。
- 分享：可编辑展馆、主题/章节/单卡故事、统一预览与静态导出、现有人工 Drop 发布流程。
- 寻卡：心愿单位于上方，独立跨站查询在下方；提供心愿录入、编辑、删除、搜索和草稿，关键词管理、入藏及卡片绑定已移除。
- 设置：主列表为主题、数据、AI、财务，页尾提供帮助与版本。数据先显示备份恢复，导入导出与维护按需展开；AI 的 Endpoint、模型、密钥及自定义服务入口直接展示。
- 数据：CSV/XLSX 映射预演、档案更新、逐行重试及冲突保护撤销；完整备份包含数据库、媒体与管理状态。

本项目没有独立手机应用。390px 等窄视口检查覆盖分享网页阅读与展示页窄窗口兜底。长期在线发布管理、多设备同步和系统摘要通知均不属于当前交付范围。

## 本地开发

使用 Node.js 24 和锁文件指定依赖：

```powershell
npm ci
npm run db:init
npm run build
npm run electron
```

也可通过 `start-desktop.bat` 启动桌面开发版。启动器会检查项目依赖，单独准备 Electron 运行程序，并在构建缺失或过期时自动构建。首次下载需要联网；若使用 npmmirror 的 npm 源，将自动使用对应 Electron 镜像，也可通过 `ELECTRON_MIRROR` 自定义。下载失败后重新运行启动器即可重试，无需删除全部依赖。

本地服务优先使用 3000–3019；端口被占用或被 Windows 保留时，由系统分配可用回环端口，无需修改系统端口保留规则。开发配置位于 `%APPDATA%\Card Vault Development`；收藏存储位置以“设置 → 数据 → 维护 → 存储”的实际显示为准。更换路径请使用应用提供的迁移入口。

API Key 保存在本机用户配置目录，并通过 Windows safeStorage 加密，不写入收藏数据库。可选 AI 默认支持 OpenAI、MiniMax、DeepSeek 和 OpenAI Chat Completions 兼容服务；调用时相关图片或内容会发送给所选服务。手动录入无需 AI。

## 验证与分发

| 命令 | 用途 |
| --- | --- |
| `npm run check:release` | 编码、文档、版本、架构、Lint、类型、覆盖率、生产构建、桌面启动及全部 HTTP/UI 验证；不打包。 |
| `npm run check:architecture` | 检查源码循环依赖及客户端误用 Node.js/数据库模块。 |
| `npm test` | 单元与模块测试。 |
| `npm run test:card` / `test:share` / `test:security` / `test:management` / `test:scout` / `test:export` | 隔离数据下的业务与安全 HTTP 流程。 |
| `npm run test:ui` | 桌面界面、最小窗口、分享窄视口与严格截图比较。 |
| `npm run test:desktop` | 使用真实服务验证端口竞争、会话保护与服务重启。 |
| `npm run test:proxy:pac` | 真实 Electron 隔离会话验证本机 PAC 的代理、直连及候选顺序；已纳入源码发布验收。 |
| `npm run test:desktop:launcher` | 使用隔离配置运行真实 Windows 启动器，验证自动构建及复用构建；会重建本地 `.next`。 |
| `npm run test:desktop:runtime` | 使用独立测试收藏启动当前 Electron，验证桌面沙箱、预加载与编辑返回。 |
| `npm run benchmark` | 1k/5k/10k 合成收藏的隔离性能基准。 |
| `npm run benchmark:dense` | 1k/5k/10k 卡片的密集财务历史与合成图片基准。 |
| `npm run benchmark:portfolio-history` | 与冻结旧实现对照每月完整输出及计算耗时。 |
| `npm run benchmark:portfolio-workload` | 对照冻结旧实现、完整组合与仅汇总路径，验证结果一致并记录内存计算耗时（不含数据库与渲染）。 |
| `npm run benchmark:export` | 1k/10k 卡片流式导出的完整性、耗时和服务进程内存。 |
| `npm run audit:all` / `audit:prod` | 联网检查全部依赖或仅生产依赖；CI 使用全部依赖审计，覆盖打包工具。 |
| `npm run release:win` | 经确认后执行：完整门槛、安装包、便携 ZIP、包内冒烟和 SHA-256 校验。 |
| `npm run verify:release-artifacts` | 对已生成产物核对版本、结构、签名模式与校验值。 |

安装版使用向导，可选择安装目录。便携版需完整解压，再运行同目录的 `Card Vault.exe`；不能只移动 EXE。目标电脑不需要安装 Node.js。签名配置与发布步骤见[Windows 代码签名](./docs/windows-code-signing.md)。

升级、换机或重装前应保存完整备份。CSV/XLSX 不含恢复所需的全部媒体和应用状态，不能替代备份。仅接受完整且受支持的数据库格式和有效备份清单；完整 v1.3 基础格式可在暂存副本中新增寻卡结构，不转换任意更早的旧格式，详见[数据备份说明](./docs/data-backup-guide.md)。

## 历史版本更新记录

以下保留全部 35 个历史版本，按新到旧排列；摘要描述各版本发布时的变化，当前行为与兼容范围以最新规范为准。中英文摘要从 v1.2.1 的历史 README 恢复；早期未找到独立发布说明，出处与缺失情况见[版本历史资料说明](./docs/version-history-sources.md)。

| 版本 | 主要变化 | 资料 |
| --- | --- | --- |
| `1.5.0` | 完成三个阶段轻量化，精简收藏、录入、详情、分享、统计与设置，整理代码结构。 | [发布说明](./docs/release-v1.5.0.md) |
| `1.4.2` | 展墙、展签与单卡观赏升级，录入、导入、数据复用及备份改进。 | [发布说明](./docs/release-v1.4.2.md) |
| `1.4.1` | 数据四页签、当前收藏范围分析、寻卡查询优化和桌面启动修复。 | [发布说明](./docs/release-v1.4.1.md) |
| `1.4.0` | 寻卡跨站查询、关键词管理、心愿多卡入藏与紧凑收藏概览。 | [发布说明](./docs/release-v1.4.0.md) |
| `1.3.6` | 组合分批聚合、恢复加固、编辑返回、单币种交易与结构整理。 | [发布说明](./docs/release-v1.3.6.md) |
| `1.3.5` | 新增四种应用主题，精简财务、编辑和 AI 设置，统一图标，更新依赖并清理过期兼容代码。 | [发布说明](./docs/release-v1.3.5.md) |
| `1.3.4` | 统一收藏状态与持仓覆盖，补充录入财务记录，改进首页、心愿与导航，整理结构和检查流程。 | [发布说明](./docs/release-v1.3.4.md) |
| `1.3.3` | 新增 DeepSeek、改进财务与组合布局，统一 AI 配置并整理架构。 | [发布说明](./docs/release-v1.3.3.md) |
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
- [v1.3.6 发布说明](./docs/release-v1.3.6.md)：规模与恢复优化、导航与财务改进、结构整理、源码与分发验收、校验值及 Git 更新介绍。
- [路线图](./docs/product-roadmap.md)：后续优先级；[English](./docs/product-roadmap.en.md)。

源码主要位于 `app`、`components`、`lib`、`electron`；`scripts` 负责初始化、测试和发布，`tests` 保存回归及视觉基线。个人数据、密钥、`node_modules`、`.next`、`logs`、`dist` 和测试临时文件均被 Git 忽略。中英文 README 同步保留最新版本的详细说明及所有历史版本的简要记录；完整发布说明和资料出处保存在 `docs`，后续发版不得删除旧版本条目。
