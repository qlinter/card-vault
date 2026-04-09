# Card Vault App

一个本地优先的球星卡管理项目，支持录入、筛选、展示和桌面端运行。

项目使用 `Next.js + React + Prisma + SQLite + Electron` 搭建，定位是个人收藏管理工具。卡片数据和图片都保存在本地，适合离线使用，也支持在桌面端切换数据存储路径。

## 主要功能

- 新增、编辑、删除球星卡
- 单张卡片最多上传 5 张图片
- 支持自由输入年份，例如 `2016-17`
- 支持自由输入评级，例如 `9.5`、`Auto Auth`、`Authentic`
- 首页筛选、排序、搜索
- 展示页浏览球员分组和单卡详情
- 本地 SQLite 数据库存储
- Electron 桌面端运行
- 支持迁移和备份本地数据目录

## 技术栈

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Prisma`
- `SQLite`
- `Electron`
- `Tailwind CSS`

## 项目结构

- `app/`
  Next.js App Router 页面、详情页、展示页、Server Actions
- `components/`
  表单、筛选栏、展示图库、桌面端存储设置等组件
- `lib/`
  Prisma 访问、筛选逻辑、展示逻辑、图片路径和存储解析
- `electron/`
  Electron 主进程、预加载脚本、本地存储迁移逻辑
- `scripts/`
  初始化数据库、准备本地构建、图标生成等脚本
- `prisma/`
  Prisma schema 和本地 SQLite 数据库定义
- `public/`
  静态资源
- `dist/`
  Windows 发布包输出目录

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 生成 Prisma Client

```bash
npm run prisma:generate
```

### 3. 初始化本地数据库

```bash
npm run db:init
```

### 4. 构建 Next.js 应用

```bash
npm run build
```

### 5. 启动桌面端

```bash
npm run electron
```

也可以在 Windows 下直接运行：

```bat
start-desktop.bat
```

## 发布包说明

项目支持两种 Windows 发布形式，均可在第三方电脑上直接使用。

### 安装版

文件：

- `dist/card-vault-1.0.0-setup.exe`

特点：

- 通过安装向导完成安装
- 可选择安装目录
- 更适合长期在同一台电脑上使用
- 安装完成后可像普通 Windows 软件一样启动

适合场景：

- 发给普通用户正式使用
- 希望有安装流程、快捷方式和固定安装位置

### 便携版

文件：

- `dist/card-vault-1.0.0-portable.zip`

使用方式：

1. 解压压缩包
2. 进入解压后的目录
3. 运行 `card vault.exe`

特点：

- 不需要安装
- 可放在任意文件夹、移动硬盘或 U 盘中运行
- 更适合测试、临时使用或快速分发

适合场景：

- 自己多台电脑临时使用
- 快速发给别人试用
- 不希望执行安装流程

### 安装版和便携版的区别

- 安装版适合长期正式使用，便携版适合免安装运行
- 安装版通过 `setup.exe` 安装，便携版通过解压后直接运行
- 两者都可以独立运行，不需要目标电脑再执行 `npm install`

说明：

- 当前发布包未进行代码签名，部分 Windows 电脑首次运行时可能出现安全提示
- 这是未签名桌面应用的常见现象，不影响程序本身运行

## 常用脚本

- `npm run build`
  构建 Next.js 应用
- `npm run start`
  启动 Next.js 生产服务
- `npm run electron`
  启动 Electron 桌面端
- `npm run prepare:local`
  准备本地桌面运行所需构建
- `npm run db:init`
  初始化或迁移本地数据库
- `npm run prisma:generate`
  生成 Prisma Client
- `npm run dist:win`
  构建 Windows 安装版和发布目录

## 数据存储

项目是本地优先设计。

- 卡片元数据保存在 SQLite 数据库中
- 图片保存在本地 `uploads` 目录中
- 桌面端支持切换“存储路径”

开发态默认数据库位置：

```text
prisma/dev.db
```

桌面端实际运行时，数据通常会使用独立的数据目录，而不是项目根目录里的数据库文件。

详细说明见：

- [数据备份说明](./数据备份说明.md)

## GitHub 仓库与本地运行说明

以下目录或文件通常不建议提交到 GitHub：

- `.env`
- `node_modules`
- `.next`
- `dist`
- 本地数据库文件

原因是它们属于本地配置、依赖安装结果、构建产物或个人数据，不适合作为源码仓库的一部分。

但要注意：

- 这些文件虽然通常不提交到 GitHub
- 对“当前这份本地可直接运行的工作目录”来说，其中一部分是运行必需项
- 例如 `node_modules` 和 `.next` 如果被删除，本地桌面端就无法直接启动，必须重新安装依赖并重新构建

因此建议区分两种使用方式：

- GitHub 仓库用于保存源码、文档和配置
- 安装版/便携版用于给第三方电脑直接运行

## 说明

这是一个偏本地使用场景的项目，桌面端和本地数据目录的逻辑比普通 Web 项目更多。如果后续要公开到 GitHub，建议保留本 README 和 [数据备份说明](./数据备份说明.md)，方便他人理解项目定位与使用方式。
