# 开发与维护

源码版本和依赖版本以 [package.json](../package.json) 与 [package-lock.json](../package-lock.json) 为准；当前交付状态见[版本入口](./README.md#current-release)。本文件只维护可复用流程，不记录每轮测试数字。

## 开发环境

使用 Node.js 24、`package.json` 指定的 npm 版本及项目锁文件，按根目录 [README](../README.md#本地启动) 启动。`start-desktop.bat` 会检查依赖、准备 Electron，并在构建缺失或过期时重新构建。首次下载需要网络；npmmirror 环境可使用对应 Electron 镜像，也可通过 `ELECTRON_MIRROR` 配置。

本地服务优先使用 3000–3019，端口占用或被 Windows 保留时由系统分配回环端口。开发配置位于 `%APPDATA%\Card Vault Development`；实际收藏路径以设置中的存储信息为准。路径迁移必须使用应用入口，规则见[数据管理](./data-guide.md#backup)。

`.next`、日志和测试输出是可重建文件；`npm run clean:cache` 会清除缓存和日志，执行前保存需要留档的证据。`.env`、收藏、媒体、备份、桌面配置和分发文件不是冗余源码，不应在结构整理中删除。

## 代码职责

| 位置 | 职责 |
| --- | --- |
| `app` | 页面路由与 HTTP／表单操作入口 |
| `components` | 界面和交互状态；同类控件遵循设计规范 |
| `lib` | 领域规则、校验、服务和共享类型 |
| `electron` | 桌面窗口、IPC、设备配置与存储流程 |
| `scripts` | 初始化、检查、基准与发布工具 |
| `tests` | 模块、业务、界面回归，冻结核算对照与截图基线 |

财务计算统一由 `financial-reporting.ts` 编排，币种和历史投影独立维护。组合统计由 `portfolio-batch.ts` 分批聚合，导航、类型和明细选择各在相应模块；服务缓存受资料修订号与有效期约束。冻结参考实现仅用于测试，不成为运行时依赖。

录入与详情复用 `FinancialRecordFields`，录入与导入的初始财务写入复用 `card-entry-finance-service.ts`。回顾分为页面编排、统计展示、卡片调整，屏幕和 PNG 共用统计定义。导出工作区统一限制并发、超时和清理；运行脚本白名单由 `release-runtime-files.js` 维护。避免因页面相似而复制整套校验、统计或导出流程。

<a id="checks"></a>
## 检查与基准

| 命令 | 用途 |
| --- | --- |
| `npm run check:encoding` / `check:docs` / `check:metadata` | 编码、递归文档链接／锚点／索引和版本元数据 |
| `npm run check:architecture` / `lint` / `typecheck` | 本地模块存在性、循环依赖、客户端边界、静态检查 |
| `npm run test:coverage` | 模块测试与覆盖率门槛 |
| `npm run build` | 生成 Prisma 客户端、前置检查与生产构建 |
| `npm run test:security` / `test:card` / `test:share` / `test:showcase` / `test:management` / `test:scout` / `test:export` | 隔离数据与模拟服务下的业务、安全及导出验证 |
| `npm run test:ui` | 中英文、主题、窗口尺寸与严格截图比较 |
| `npm run test:desktop` / `test:desktop:ai` / `test:desktop:collection` / `test:proxy:pac` | 桌面启动、AI 删除、回顾／展馆和真实 PAC 规则 |
| `npm run test:desktop:launcher` / `test:desktop:runtime` | 隔离启动器及 Electron 沙箱、预加载和页面返回；会重建本地构建 |
| `npm run check:release` | 完整源码门槛；不生成分发文件 |
| `npm run audit:all` / `audit:prod` | 向 npm registry 查询全部／生产依赖安全公告 |
| `npm run benchmark` / `benchmark:dense` / `benchmark:data` / `benchmark:export` | 合成收藏、密集财务与图片、数据工作区、流式导出基准 |
| `npm run benchmark:portfolio-history` / `benchmark:portfolio-workload` | 与冻结实现对照结果、耗时和内存 |

先完成生产构建再启动界面测试；UI 使用一个工作进程及隔离数据库，避免同时启动两套 UI 测试。使用锁文件对应的 Playwright Chromium；已有浏览器缓存时配置 `PLAYWRIGHT_BROWSERS_PATH`。截图须逐张核对有意变化后再更新，不能用放宽阈值或仅截图代替比较。

测试不得依赖个人收藏或真实 API Key。合成数据的规模、机器条件和测量方式须随结果记录，不能把函数速度当作整页速度，也不能将一次采样当作通用性能保证。既有观测保存在[历史基准](./history/development.md#data-benchmarks)。

## 分发与后续范围

源码定版、用户确认、打包验证和 GitHub 发布是独立步骤。获得用户确认后，按[Windows 分发流程](./windows-code-signing.md)生成并验证安装包、便携包，再执行获准的 Git/GitHub 更新。检查通过本身不提供打包或发布授权。

功能范围以用户本轮确认和当前版本说明为准。历史路线图中的候选项只是当时建议；下一步依用户实际反馈确定，不维护多份“已完成能力”清单。

<a id="documentation"></a>
## 文档维护

1. **当前规则只维护一份。** 按[文档索引](./README.md)确定归属；其他页面链接到对应章节，不复制整段规则、限制或兼容说明。界面字号／主题归设计规范，财务口径归财务模型，数据库与恢复边界归数据管理。
2. **README 保持简短且中英文对齐。** 只提供产品概览、版本入口和启动方式；完整双语历史只在 `history/README.md` 维护。功能指南不逐篇写产品版本号。
3. **每个版本只维护一份版本说明。** 使用 `release-vX.Y.Z.md` 汇总变化、审查发现、验证及交付事实；不再并列创建 review、assessment、git-update 或滚动进度文档。详细日志保留在本机日志目录，文档写必要结论与证据位置。
4. **历史归档只记录事实。** `history/releases.md` 保留逐版发布记录，`history/development.md` 保留旧开发过程；不回填当前测试数字，不把曾尝试的方案写成现有功能。缺失资料明确标注，不推测。
5. **发版后再归档。** 新版本开始时将已发布版本说明移入发布归档，保留独立版本锚点，在唯一双语历史表追加一行，并更新两份 README 和文档入口。源码未发布时不能把它写成已发布版本。
6. **用检查约束新增文档。** 运行 `npm run check:docs` 和 `check:metadata`，校验所有递归文档、引用锚点、当前入口、历史版本覆盖及链接。新增文件必须有明确职责并进入索引，不能通过再加一份摘要来解决查找问题。
