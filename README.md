# Card Vault

简体中文 | [English](./README.en.md)

Card Vault 是本地优先的 Windows 球星卡收藏管理应用，基于 Next.js、React、Prisma、SQLite 和 Electron。收藏档案、图片和财务历史保存在本机；AI 和分享托管为可选外部服务。

## 当前状态

源码版本：`1.3.0`。累计更新已完成审核、源码验证及经用户确认后的本地打包，最新进度以[开发进度](./docs/v1.3.0-implementation.md)为准。

2026-09-07 已经用户确认，生成 Windows x64 安装包 `dist/card-vault-1.3.0-setup.exe`、便携包 `dist/card-vault-1.3.0-portable.zip` 和 `dist/SHA256SUMS.txt`。包内运行、版本、签名模式和校验值均通过验证。本次为未签名构建，Windows 可能显示未知发布者或 SmartScreen 提示；文件与校验值见[发布说明](./docs/release-v1.3.0.md)。尚未上传到线上发布渠道。

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

也可通过 `start-desktop.bat` 启动桌面开发版。开发配置位于 `%APPDATA%\Card Vault Development`；收藏存储位置以“设置 → 数据 → 存储”的实际显示为准。更换路径请使用应用提供的迁移入口。

API Key 保存在本机用户配置目录，并通过 Windows safeStorage 加密，不写入收藏数据库。可选 AI 支持 Azure OpenAI、MiniMax 和 OpenAI Chat Completions 兼容服务；调用时相关图片或内容会发送给所选服务。手动录入无需 AI。

## 验证与分发

| 命令 | 用途 |
| --- | --- |
| `npm run check:release` | 编码、文档、版本、Lint、类型、覆盖率、生产构建及全部 HTTP/UI 验证；不打包。 |
| `npm test` | 单元与模块测试。 |
| `npm run test:card` / `test:share` / `test:security` / `test:management` | 隔离数据下的业务与安全 HTTP 流程。 |
| `npm run test:ui` | 桌面界面、最小窗口、分享窄视口与严格截图比较。 |
| `npm run benchmark` | 1k/5k/10k 合成收藏的隔离性能基准。 |
| `npm run audit:all` / `audit:prod` | 联网检查全部依赖或仅生产依赖；CI 使用全部依赖审计，覆盖打包工具。 |
| `npm run release:win` | 经确认后执行：完整门槛、安装包、便携 ZIP、包内冒烟和 SHA-256 校验。 |
| `npm run verify:release-artifacts` | 对已生成产物核对版本、结构、签名模式与校验值。 |

安装版使用向导，可选择安装目录。便携版需完整解压，再运行同目录的 `Card Vault.exe`；不能只移动 EXE。目标电脑不需要安装 Node.js。签名配置与发布步骤见[Windows 代码签名](./docs/windows-code-signing.md)。

升级、换机或重装前应保存完整备份。CSV/XLSX 不含恢复所需的全部媒体和应用状态，不能替代备份。受支持旧库的升级边界见[数据备份说明](./docs/data-backup-guide.md)。

## 项目文档

- [文档索引](./docs/README.md)：现行规范和版本历史。
- [v1.3.0 更新说明](./docs/release-v1.3.0.md)：最终版本变化和产物状态。
- [开发进度与验收](./docs/v1.3.0-implementation.md)：已完成、待验证与待确认事项。
- [代码审核](./docs/project-assessment-2026-09-07.md)：模块范围、清理内容、风险及证据边界。
- [路线图](./docs/product-roadmap.md)：后续优先级；[English](./docs/product-roadmap.en.md)。

源码主要位于 `app`、`components`、`lib`、`electron`；`scripts` 负责初始化、测试和发布，`tests` 保存回归及视觉基线。个人数据、密钥、`node_modules`、`.next`、`logs`、`dist` 和测试临时文件均被 Git 忽略。版本历史统一维护在文档目录，不再在 README 重复逐版堆叠。
