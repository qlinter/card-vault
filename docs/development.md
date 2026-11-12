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

录入字段的控件判断、展开、焦点和错误关联统一放在 `card-form-display.ts`；清理校验提示只移除自身的关联，不覆盖字段原有的辅助说明。草稿保存与切换继续由录入页面编排，删除失败须保留列表并允许重试。

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

源码定版、用户确认、打包验证和 GitHub 发布是独立步骤。获得用户确认后，按[Windows 分发流程](development.md#windows-distribution)生成并验证安装包、便携包，再执行获准的 Git/GitHub 更新。检查通过本身不提供打包或发布授权。

功能范围以用户本轮确认和当前版本说明为准。历史路线图中的候选项只是当时建议；下一步依用户实际反馈确定，不维护多份“已完成能力”清单。

<a id="documentation"></a>
## 文档维护

1. **当前规则只维护一份。** 按[文档索引](./README.md)确定归属；其他页面链接到对应章节，不复制整段规则、限制或兼容说明。界面字号／主题归设计规范，财务口径归财务模型，数据库与恢复边界归数据管理。
2. **README 保持简短且中英文对齐。** 只提供产品概览、版本入口和启动方式；完整双语历史只在 `history/README.md` 维护。功能指南不逐篇写产品版本号。
3. **每个版本只维护一份版本说明。** 使用 `release-vX.Y.Z.md` 汇总变化、审查发现、验证及交付事实；不再并列创建 review、assessment、git-update 或滚动进度文档。详细日志保留在本机日志目录，文档写必要结论与证据位置。
4. **历史归档只记录事实。** `history/releases.md` 保留逐版发布记录，`history/development.md` 保留旧开发过程；不回填当前测试数字，不把曾尝试的方案写成现有功能。缺失资料明确标注，不推测。
5. **发版后再归档。** 新版本开始时将已发布版本说明移入发布归档，保留独立版本锚点，在唯一双语历史表追加一行，并更新两份 README 和文档入口。源码未发布时不能把它写成已发布版本。
6. **用检查约束新增文档。** 运行 `npm run check:docs` 和 `check:metadata`，校验所有递归文档、引用锚点、当前入口、历史版本覆盖及链接。新增文件必须有明确职责并进入索引，不能通过再加一份摘要来解决查找问题。

<a id="windows-distribution"></a>
## Windows 分发与签名

Card Vault 的 Windows 代码签名是可选增强。`npm run release:win` 在配置受信任的 Authenticode 身份时会自动签名并验证 `Card Vault.exe` 和 NSIS 安装器；没有签名凭据时仍会生成经过结构、版本、运行时和 SHA-256 检查的未签名安装包与便携 ZIP。

未签名产物不能证明发布者身份，Windows 很可能显示“未知发布者”或 SmartScreen 提示；SHA-256 清单只能验证下载文件是否与发布文件一致，不能替代发布者身份认证。代码签名可以证明发布者身份和文件完整性，并消除“未知发布者”身份提示。SmartScreen 还会结合证书与下载信誉判断风险，因此任何签名方案都不能保证新文件第一次下载时绝对不显示 SmartScreen 提醒。

<a id="windows-执行前提"></a>
### 执行前提

Electron 版本以锁文件为准。`package:win` 会先准备并校验 Electron 二进制，再执行打包。

安装包、便携包、Git 更新与 GitHub 同步须先由用户明确确认。当前交付状态以[版本说明](README.md#current-release)为准。`npm run check:release` 本身不生成安装文件；完整发布流程由 `npm run release:win` 执行。

运行脚本白名单由 `scripts/release-runtime-files.js` 统一维护，构建配置与产物检查共用。安装包只包含初始化、存储、缩略图所需的脚本；测试、基准、发布工具、固定测试时钟及源码映射全部排除。业务冒烟脚本从源码侧使用包内 Electron 的 Node 运行时启动，服务与初始化路径明确指向包内应用，避免为测试交付整套开发工具。

<a id="windows-无证书发布"></a>
### 无证书发布

无需设置任何签名环境变量，直接运行：

```powershell
npm.cmd run release:win
```

流程会明确输出 `unsigned`，并要求安装器与便携包中的主程序均保持未签名状态，避免混用签名异常或部分签名的文件。发布时应同时提供 `SHA256SUMS.txt`，并在下载说明中明确提示 Windows 可能出现安全提醒。

<a id="windows-方案一pfx-代码签名证书"></a>
### 方案一：PFX 代码签名证书

从受 Windows 信任的代码签名 CA 获取 Authenticode 证书，并在当前 PowerShell 会话或 CI Secret 中设置：

```powershell
$env:WIN_CSC_LINK = 'D:\secure\card-vault-signing.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<PFX password>'
npm.cmd run release:win
```

`WIN_CSC_LINK` 也可以是 electron-builder 支持的安全 URL 或 Base64 内容。不要把 PFX 和密码写进项目 `.env`；证书应保存在工作区之外。

<a id="windows-方案二证书存储或-ev-证书"></a>
### 方案二：证书存储或 EV 证书

证书已安装在 Windows 个人证书存储，或 EV 私钥位于硬件令牌时，可按证书主题或 SHA-1 指纹选择身份：

```powershell
$env:CARD_VAULT_SIGNING_SUBJECT = '<certificate Subject/CN>'
$env:CARD_VAULT_SIGNING_SHA1 = '<certificate thumbprint>'
npm.cmd run release:win
```

文件摘要和时间戳摘要仍使用 SHA-256。

<a id="windows-方案三microsoft-artifact-signing"></a>
### 方案三：Microsoft Artifact Signing

在 Microsoft Artifact Signing 中创建账户与证书配置文件，并为发布应用注册授予签名权限：

```powershell
$env:CARD_VAULT_AZURE_SIGN_ENDPOINT = 'https://<region>.codesigning.azure.net'
$env:CARD_VAULT_AZURE_SIGN_ACCOUNT = '<signing account>'
$env:CARD_VAULT_AZURE_SIGN_PROFILE = '<certificate profile>'
$env:CARD_VAULT_AZURE_SIGN_PUBLISHER = '<certificate publisher CN>'
$env:AZURE_TENANT_ID = '<tenant id>'
$env:AZURE_CLIENT_ID = '<application client id>'
$env:AZURE_CLIENT_SECRET = '<client secret>'
npm.cmd run release:win
```

一旦开始配置 Microsoft Artifact Signing，所有 `CARD_VAULT_AZURE_SIGN_*` 与 `AZURE_*` 变量必须完整提供；部分配置会在清理旧发布文件之前中止，避免误以为已经签名。

<a id="windows-发布流程"></a>
### 发布流程

`npm run release:win` 会依次：

1. 检查签名配置；没有凭据时选择未签名模式，有完整凭据时选择对应签名模式。
2. 执行完整测试、编码检查和生产构建；CI 额外执行全部依赖审计，本地发布前运行 `npm run audit:all`。
3. 使用 electron-builder 生成 Windows 安装版。
4. 签名模式验证安装器和主程序的签名者与 RFC 3161 时间戳；未签名模式验证两者均为 `NotSigned`。
5. 验证打包文件，运行卡片、分享、数据管理、流式导出 HTTP 流程及包内健康端点冒烟测试；启动实际桌面，检查安全设置和编辑返回筛选结果。
6. 生成便携 ZIP 和 SHA-256 校验值，并再次验证 ZIP 内主程序与本次签名模式一致。

`npm run package:win` 只执行基础 electron-builder 打包，适合本机快速检查。对外发布应使用 `npm run release:win`，即使没有证书，也能获得完整门禁、冒烟测试、便携 ZIP 和 SHA-256 清单。

已完成源码验收、仅需重新生成分发文件时，可显式执行 `npm run release:win:package`。该模式校对已安装依赖与锁文件，生成 Prisma 客户端和新的生产构建，跳过完整源码检查及包内运行测试，保留结构、版本、签名状态、大小和 SHA-256 校验。`node scripts/release-win.js --package-only --plan` 只显示执行计划，不构建或修改分发文件。默认完整流程不受影响。

成功发布会写入 `dist/release-<版本>.json`，记录源码提交及是否有未提交改动、实际工作区源码树哈希（含未跟踪源码）、锁文件哈希、构建 ID、Node 与直接依赖版本、签名模式、产物大小和哈希，以及各项检查的通过／跳过状态。仅打包记录不能替代完整发布验收。

<a id="windows-github-actions"></a>
### GitHub Actions

经确认后手动运行 `.github/workflows/release-windows.yml` 可在 GitHub Windows Runner 上生成 Windows 产物。不配置签名 Secrets 时生成未签名产物；需要签名时任选一种方式配置仓库 Secrets：

- PFX：`WINDOWS_CERTIFICATE_BASE64`、`WINDOWS_CERTIFICATE_PASSWORD`
- Microsoft Artifact Signing：`CARD_VAULT_AZURE_SIGN_ENDPOINT`、`CARD_VAULT_AZURE_SIGN_ACCOUNT`、`CARD_VAULT_AZURE_SIGN_PROFILE`、`CARD_VAULT_AZURE_SIGN_PUBLISHER`、`AZURE_TENANT_ID`、`AZURE_CLIENT_ID`、`AZURE_CLIENT_SECRET`

仅保留 `.github/workflows/release-windows.yml` 作为手动及复用发布入口，移除重复的候选工作流；质量工作流只执行检查，不打包。

工作流上传通过完整发布检查的安装包、便携包、SHA-256 清单与 `release-*.json` 构建清单；配置签名时额外要求 Authenticode 与时间戳复核通过。

<a id="windows-手工复核"></a>
### 手工复核

发布后可再次检查安装包签名：

```powershell
$releaseVersion = (Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json).version
Get-AuthenticodeSignature -LiteralPath ".\dist\card-vault-$releaseVersion-setup.exe" |
  Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

签名发布预期 `Status` 为 `Valid`，并同时显示签名者和时间戳证书；未签名发布预期为 `NotSigned`。两种模式都应在一台干净 Windows 设备上检查安装体验，未签名模式应预期出现“未知发布者”或 SmartScreen 提示。

<a id="windows-官方参考"></a>
### 官方参考

- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Microsoft：Time Stamping Authenticode Signatures](https://learn.microsoft.com/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [electron-builder：Windows Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-win/)
