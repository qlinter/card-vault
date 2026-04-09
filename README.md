# Card Vault App

一个本地优先的球星卡管理项目，支持录入、筛选、展示和桌面端运行。

这个项目使用 `Next.js + React + Prisma + SQLite + Electron` 搭建，定位是个人收藏管理工具。卡片数据和图片都保存在本地，适合离线使用，也支持在桌面端切换数据存储路径。

## 主要功能

- 新增、编辑、删除球星卡
- 每张卡最多上传 5 张图片
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
  Next.js App Router 页面、展示页、详情页、Server Actions
- `components/`
  表单、筛选栏、展示图库、桌面存储设置等组件
- `lib/`
  Prisma 访问、筛选逻辑、展示页逻辑、图片路径和存储解析
- `electron/`
  Electron 主进程、预加载脚本、本地存储迁移逻辑
- `scripts/`
  初始化数据库、准备本地构建、图标生成等脚本
- `prisma/`
  Prisma schema 和本地 SQLite 数据库定义
- `public/`
  静态资源

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
  构建 Windows 桌面发布目录

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
