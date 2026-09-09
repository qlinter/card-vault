# Card Vault v1.3.1

源码整理日期：2026-09-08。本版基于 v1.3.0（`ea19951`），将后续可靠性修复、当前格式清理与代码优化作为统一版本。产品及应用“关于”版本为 `1.3.1`；**经用户确认，已于 2026-09-08 生成并验证 Windows x64 安装包和便携包，尚未上传**。旧 v1.3.0 产物不包含本页修改。

## 修复与行为

1. **启动端口**：保留 3000–3019 的优先顺序，全部不可用时由系统分配回环端口；启动竞争最多尝试三次，保留真实绑定错误。本机原 Windows 保留区间导致这些端口全部返回 EACCES，现已解决 `No available local port found for Card Vault`。备份、AI 设置后的服务重启仍保持原地址与会话保护。
2. **活动趋势**：缺失汇率只使对应月份、币种的金额不可用，买入/出售数量及其它月份仍显示；部分金额不会被当作完整合计。图表与 AI 输入共用缺失标记。
3. **提醒准确性**：独立记录状态开始日期，普通档案修改不重置送评/挂牌计时；估算日期有明确标记，再次切换状态后记录准确日期。图片、购买、估值证据的持久版本使条件再次出现时重新打开提醒；存在未知购买成本时仍提示补充。
4. **导出范围**：有勾选时导出搜索范围内选中的卡片，支持跨页；无勾选时导出搜索结果。公开过滤始终生效，空选择被拒绝，已删除或被过滤卡片不会扩大导出范围。下载用 POST 传递 ID，避免长 URL。
5. **恢复保护**：原数据保留到替换后的最终检查成功；失败时恢复原目录。清理临时旧目录失败会保留路径，不再误报整个恢复失败。

## 代码优化

| 路径 | 原问题 | 本版实现与边界 |
| --- | --- | --- |
| 财务索引 | 每次财务变化触发全量重算，读取不需要的卡片文字与图片 | 持久待更新队列每批 250 张提交；单卡、汇率和跨日变化仅处理受影响卡片，普通档案/图片编辑不重算。专用查询仅选取财务字段。版本一致且队列完成后提供结果，中断后继续处理。 |
| 估值历史投影 | 每个估值日期重新扫描全部报价，记录增加时接近平方增长 | 一次稳定排序后逐日遍历，复杂度降为 O(n log n)；保留主币种直接估值优先、同日创建时间优先、完全同时间取输入首条及不可用标记。 |
| 人工汇率查询 | 每次换算复制、过滤并排序汇率 | O(r) 单次扫描，保留生效日期、最高修订号及同优先级首条规则；不增加可能过期的全局缓存。 |
| 历史趋势起点 | 为找到最早日期，合并并排序全组合的业务日期数组 | 单次遍历取最小有效日期，不创建全量日期数组；未来记录不提前进入图表，逐月覆盖和部分估值计算不变。 |
| 单条提醒操作 | 完成、忽略或延后一个提醒时，加载所有卡片、计划及摘要 | 只读取该卡并重新验证提醒类型和证据指纹；无效 ID、已删除卡片、过期指纹仍拒绝。计划页完整列表的读取方式不变。 |

财务查询字段在共享查询定义中复用，避免首页、索引和组合付款字段分叉。修改未改变整数金额、移动平均成本、实物数量、汇率日期或已确认的页面布局，也未引入历史数据转换路径。

### 函数性能对照

Windows / Node 24.15.0，相同合成历史与 24 条人工汇率；每组一次预热、五轮交替测量，取中位数。对照修改前后的 `reportingHistory` 完整返回结果一致。

| 单卡估值记录 | 调用次数 | 优化前 | 优化后 | 耗时降低 |
| --- | ---: | ---: | ---: | ---: |
| 24 | 10000 | 442 ms | 332 ms | 约 25% |
| 240 | 1000 | 1033 ms | 314 ms | 约 70% |

以上只测财务投影函数，不包含数据库、历史逐月持仓计算或页面渲染，不能当作整页提速比例。原始本机数据：`logs/v131-financial-performance.json`；完整页面容量测量统一放在[数据与计划](./data-center-guide.md)。

发布配置同时排除 `prisma` 下的本地数据库、日志伴随文件与数据库快照；加入禁入文件测试、解包目录检查和最终 ZIP 检查。在隔离构建目录放置数据库与快照测试文件，确认它们未进入产物，应用仍在首次启动时创建当前格式数据库。

## 当前数据格式

- 空数据库直接创建完整结构；已有数据库只读检查表、字段、索引、触发器、状态记录以及 SQLite 和关联完整性。删除历史结构识别、补表/回填、旧浮点汇总回灌和升级前快照功能。
- 恢复仅接受带有效 `backup-manifest.json` 的当前格式备份，保留来源、暂存、最终验证与失败回滚，输出 `restore-report.json`。存储路径移动仍可用，并在切换前验证当前格式。
- 删除旧桌面配置目录继承、旧明文/单服务 AI 配置转换、嵌套 uploads 展平及错位数据库搬移。当前加密配置保存、密钥解密失败提示及正常目录创建保留。
- 仅支持当前文件导入批次；退役档案修改/估值批次不可读取、执行、撤销或重新预演。分享展示只接受 v3 配置，不再转换旧协议或从旧文案生成章节。
- 产品版本与结构标记独立维护：本版产品为 `1.3.1`，数据库结构标记仍为 `1.3.0`，校验要求包含本版使用的完整表和触发器；只看该标记不能判断兼容。核算版本仍为 `physical-position-v2`，AI 配置为 v5，分享展示配置为 v3。

此前经用户授权，先完整备份，再一次性整理现有工作数据和 `I:\card-vault\data` 存档；该操作没有加入产品代码。工作数据除获准修正的一个分享展示配置外，28 张表与备份一致；存档保留原卡片、财务、计划及媒体，新增当前跟踪/索引状态并修正一个分享配置。备份和逐表/文件核对日志留在本机，不作为产品自动升级能力。当前恢复规则见[数据备份](./data-backup-guide.md)。

## 文档整理

中英文 README 同步为“最新版本详细说明、全部历史版本简述”，历史表保留 v1.0.0–v1.3.0 共 25 项。应用“关于”包含本版修复和代码优化摘要。

四份重复的 v1.3.0 开发进度、9 月 7 日项目审核、9 月 8 日维护和当前格式清理记录归并：旧发布事实进入 [v1.3.0 发布说明](./release-v1.3.0.md)，本批变化与验收进入本页，长期规则进入对应规范，规模基准统一在数据指南。删除重复文件，更新引用与索引；历史版本发布说明全部保留。文档检查新增双语历史一致性、历史发布文件覆盖和文档索引完整性检查。

v1.0.0–v1.0.13 的独立发布文档仍未找到，简史已从 Git 中恢复；不补写没有来源的详细记录。出处及缺失范围见[版本历史资料](./version-history-sources.md)。

## 2026-09-09 启动诊断修正（尚未打包）

Git 同步不包含个人数据库。若本机仍缺少本版的 `CardTracking`、`CardReportDirty` 和配套触发器，启动准备会在数据库校验阶段失败；这不是依赖安装失败。已有库只读校验和不自动升级的规则保持不变，本次本机数据已在备份、副本验证后单独补齐辅助结构，原有业务表数据保持不变。

源码启动错误现保留最近的标准错误输出，并给出实际日志文件路径；等待子进程输出流关闭后再报告失败，避免只显示 `prepare-local.js exited with code 1`。新增启动诊断回归测试；启动诊断、日志、数据库和跟踪模块共 21 项测试通过，生产构建（含编码、ESLint、TypeScript）及文档检查通过，并实际运行 `start-desktop.bat` 确认桌面启动完成。本次源码修改不包含在 9 月 8 日已生成的分发文件中。

## 本版验收

2026-09-08，Windows / Node 24.15.0，在 `logs/v131-release` 隔离源码副本执行完整 `npm run release:win`。独立构建不覆盖正在运行的桌面构建或用户数据。

| 检查 | 正式发布结果 |
| --- | --- |
| 单元/模块与覆盖率 | 253 项全部通过；实际加载模块行 93.37%、分支 81.85%、函数 92.35%。包含财务边界对照及分发包数据库排除测试。 |
| 静态与生产构建 | Prisma 生成、编码、文档、版本元数据、ESLint、TypeScript、生产构建通过。 |
| HTTP 与桌面 | 本地会话安全、卡片、分享、数据管理及端口回退/竞争/重启全部通过。 |
| UI | 正式流程完整 66 项全部通过，包含 16 张视觉比较，未更新基线或放宽阈值。 |
| 包内业务运行 | 使用包内 Electron/Node 环境通过卡片、分享、数据管理及 Next 服务健康检查。 |
| 产物检查 | 安装器和 ZIP 内主程序版本均为 1.3.1；未签名模式、必需文件、体积和 SHA-256 一致。无开发数据库、数据库快照或禁入生成文件。 |
| 依赖审计 | 本版此前经授权完成 npm 官方全部依赖审计，0 项已知漏洞；打包没有调整依赖版本。 |
| 性能 | 函数及 1k/5k/10k 密集历史前后基准已完成；1 万张索引及首页 5257 → 4023 ms，组合页 6130 → 5950 ms，详见数据指南。 |

正式发布日志为 `logs/v131-windows-release.log`，最终文件记录为 `logs/v131-artifacts.json`；先前源码和性能证据保留在 `logs/v131-release-check.log`、`logs/v131-ui-version-retest.log`、`logs/v131-audit.log` 及各基准日志中。覆盖率不等同于全部界面和 Electron 执行路径的覆盖率。

## 分发文件与剩余验证

以下产物已复制到项目根目录 `dist`，复制前后哈希一致，并再次验证交付目录中的版本、签名模式及 SHA-256。现有旧版本文件及其校验清单保留，未执行线上上传。

| 文件 | 大小（字节） | SHA-256 |
| --- | ---: | --- |
| `card-vault-1.3.1-setup.exe` | 180499258 | `DFA122811B311AEF822E64B29F89E613D354000BC4C4BAFFB5ADAD32744FFEA8` |
| `card-vault-1.3.1-portable.zip` | 250652302 | `8E11E958074627331FFE8D851353276790451DA46F5E5273FBD3F8184B0F73E1` |

`SHA256SUMS.txt` 保存本版两项校验值。便携版须完整解压，再运行同目录的 `Card Vault.exe`；目标电脑无需安装 Node.js。当前为未签名构建，Windows 可能显示未知发布者或 SmartScreen 提示。

全新 Windows 安装/覆盖安装、受限安装目录、真实大照片全集、磁盘耗尽/断电和真实 AI 服务仍需要后续实机验证；本机隔离测试不等于已覆盖这些环境。组合历史仍在进程内按月重建，大规模密集历史是后续优化方向。未增加托管、同步或独立手机应用。

## English release summary

v1.3.1 combines Windows port fallback/retries, month-specific incomplete-FX handling, accurate recurring reminders, cross-page selected exports, restore rollback through final validation, and current-format-only data handling. Current backup/restore and storage moves remain available; historical database, AI/desktop and gallery conversion paths are removed.

Code optimization covers incremental financial indexes with financial-only database projections, one sorted pass for historical quotes, linear date-effective FX lookup, earliest-date discovery without a collection-wide date array, and card-specific reminder mutations. Direct-currency priority, exact-date ties, missing values and accounting rules are preserved. Five alternating benchmark rounds after warmup reduced median financial-projection function time from 442 to 332 ms for 10,000 calls with 24 quotes, and from 1,033 to 314 ms for 1,000 calls with 240 quotes. These synthetic function results are not page-performance claims.

Both READMEs retain all 25 earlier versions and detailed v1.3.1 notes. Four overlapping audit/progress records were consolidated into release notes and current guides, with all historical release documents preserved. Standalone notes for v1.0.0–v1.0.13 were not found; Git-recovered summaries remain. The complete release workflow passed 253 unit/module tests, all 66 UI cases (including 16 visual comparisons), production build, static checks, HTTP flows and desktop startup. Packaged card/share/management flows and health checks passed using the bundled Electron/Node runtime. Local databases and database snapshots are excluded and verified absent. Full dependency audit found zero known vulnerabilities; packaging did not change dependency versions. A single-run 10,000-card comparison measured index/Home at 5,257 → 4,023 ms and Portfolio at 6,130 → 5,950 ms, without implying a guaranteed user-data speedup. Following explicit confirmation, unsigned Windows x64 installer and portable packages were generated, copied to root dist and verified for version, signing mode and SHA-256. Sizes and checksums appear above. Artifacts remain local; no upload was performed. Real-photo scale, fresh Windows installation, power loss and live AI-provider testing remain outside this round.
