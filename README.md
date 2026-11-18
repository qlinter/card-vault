# Card Vault

简体中文 | [English](./README.en.md)

Card Vault 是本地优先的 Windows 球星卡收藏管理应用，基于 Next.js、React、Prisma、SQLite 和 Electron。收藏档案、图片和财务历史保存在本机；AI 与分享托管是可选外部服务。

## 当前版本

当前源码版本为 `1.6.1`。本轮录入、分享、财务、统计和展馆更新见 [v1.6.1 版本说明](./docs/release-v1.6.1.md)。

在 [v1.6.1 下载页](https://github.com/qlinter/card-vault/releases/tag/v1.6.1) 获取 Windows x64 安装包 `card-vault-1.6.1-setup.exe`、便携包 `card-vault-1.6.1-portable.zip` 及 SHA-256 校验清单。本版未签名。

## 主要能力

- 本地账户：离线登录、退出登录、Windows 锁屏保护及恢复码；账户独立于收藏备份，应用访问保护不等于文件加密。
- 收藏管理：搜索筛选、卡牌与列表视图、最多五张图片、草稿、模板、批量录入和人工确认的 AI 候选。
- 财务与统计：交易、费用、估值、实物数量、人工汇率，总览／趋势／结构／明细及收藏回顾。
- 展示与分享：完整卡图展墙、单卡大图、四种浏览展馆风格、可编辑分享集和静态网页导出。
- 数据与设置：CSV/XLSX 导入预演和冲突保护撤销、完整备份恢复、目标与寻卡、四种应用主题及按设备保存的 AI 代理配置。

本项目没有独立手机应用；窄视口检查主要覆盖分享网页与桌面窄窗口。

## 本地启动

使用 Node.js 24 和项目锁文件：

```powershell
npm ci
npm run db:init
npm run build
npm run electron
```

也可运行 `start-desktop.bat`。开发环境、检查命令与代码职责见[开发维护](./docs/development.md)；打包和签名见[Windows 分发](docs/development.md#windows-distribution)。执行数据库初始化前请确认使用的是预期的数据路径。

## 文档

[文档总入口](./docs/README.md)按功能提供当前规则。应用内的日常说明位于“设置 → 帮助与版本 → 使用说明”。

完整历史的中英文摘要、逐版发布结果与开发记录集中在[版本历史](./docs/history/README.md)，不再在两份 README 中重复维护。升级、换机和数据恢复请先阅读[数据管理与备份](./docs/data-guide.md)。
