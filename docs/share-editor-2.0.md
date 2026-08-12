# 分享展馆编辑器 2.0

## 目标

编辑器 2.0 将分享集的内容组织、视觉配置和单卡展示从较长的单页表单调整为清晰的编辑工作台。它继续生成完全静态的展馆，不增加浏览器端框架依赖，也不改变公开字段白名单。

## v1.0.14 已完成

- 将编辑区拆分为“基本内容、视觉设计、展馆章节、单卡展示”四个工作区。
- 在编辑过程中持续保留最终展馆预览。
- 预览支持桌面和手机宽度切换。
- 新建与编辑分享集共用同一个编辑器组件。
- 保留现有主题、布局、章节、封面、背景和单卡覆盖能力。
- 修复应用内预览点击单卡后把完整 Card Vault 界面加载到预览框的问题；预览现在显示内嵌单卡详情并可返回展馆，静态导出仍使用独立单卡页面。
- 增加卡片与章节拖拽排序，并保留上移 / 下移键盘按钮。
- 增加最多 80 步撤销、重做以及按分享集隔离的本机自动草稿恢复。
- 新上传的封面与背景在保存前即可进入实时预览。
- 增加字体风格、内容密度和图片构图选项，旧分享集自动使用兼容默认值。
- 增加桌面与手机预览模式，并将预览单卡交互纳入自动化回归。

## 兼容边界

- 不修改 Prisma 分享集模型。
- 不修改保存用的 Server Action 字段契约。
- 编辑器不修改静态分享数据结构；Cloudflare Drop 模式只追加发布检查、清单和托管配套文件。
- 预览与两类导出继续调用同一个静态渲染器，避免三套页面出现视觉差异。

## 后续增强

1. 在 CI 环境接入稳定的浏览器截图基线，覆盖三种版式、桌面和手机视口。
2. 为超大型分享集增加章节与卡片搜索、批量分配和虚拟列表。
3. 评估跨设备草稿同步；当前草稿只保存在本机浏览器存储中。

## English Summary

Share Gallery Editor 2.0 turns the long gallery form into four focused workspaces while preserving the existing database, Server Action, public-data allowlist, and static export contract. It now includes accessible drag ordering, undo/redo, local draft recovery, pre-save cover/background preview, richer composition controls, and inline card details that cannot navigate the application preview iframe. A future CI enhancement can add stable browser screenshot baselines across every layout and viewport.
