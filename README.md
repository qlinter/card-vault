# Card Vault

简体中文 | [English](./README.en.md)

Card Vault 是本地优先的 Windows 球星卡收藏管理应用，基于 Next.js、React、Prisma、SQLite 和 Electron。收藏档案、图片和财务历史保存在本机；AI 与分享托管是可选外部服务。

## 当前版本

源码版本：`1.5.2`，已完成源码定版。收藏回顾、沉浸式赏卡、AI 删除修复及验证结果统一见 [v1.5.2 版本说明](./docs/release-v1.5.2.md)。

Windows x64 安装包 `card-vault-1.5.2-setup.exe` 与便携包 `card-vault-1.5.2-portable.zip` 已生成并通过完整发布验证。[下载入口](https://github.com/qlinter/card-vault/releases/tag/v1.5.2)同时提供 SHA-256 校验清单与构建记录。文件未进行代码签名，Windows 可能显示“未知发布者”或 SmartScreen 提示。

## 主要能力

- 收藏管理：搜索筛选、卡片与列表视图、最多五张图片、草稿、模板、批量录入和人工确认的 AI 候选。
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

也可运行 `start-desktop.bat`。开发环境、检查命令与代码职责见[开发维护](./docs/development.md)；打包和签名见[Windows 分发](./docs/windows-code-signing.md)。执行数据库初始化前请确认使用的是预期的数据路径。

## 文档

[文档总入口](./docs/README.md)按功能提供当前规则。应用内的日常说明位于“设置 → 帮助与版本 → 使用说明”。

完整历史的中英文摘要、逐版发布结果与开发记录集中在[版本历史](./docs/history/README.md)，不再在两份 README 中重复维护。升级、换机和数据恢复请先阅读[数据管理与备份](./docs/data-guide.md)。
