# 分享展馆编辑器 2.0

## 目标

编辑器 2.0 将分享集的内容组织、视觉配置和单卡展示从较长的单页表单调整为清晰的编辑工作台。它继续生成完全静态的展馆，不增加浏览器端框架依赖，也不改变公开字段白名单。

## 第一阶段已完成

- 将编辑区拆分为“基本内容、视觉设计、展馆章节、单卡展示”四个工作区。
- 在编辑过程中持续保留最终展馆预览。
- 预览支持桌面和手机宽度切换。
- 新建与编辑分享集共用同一个编辑器组件。
- 保留现有主题、布局、章节、封面、背景和单卡覆盖能力。

## 兼容边界

- 不修改 Prisma 分享集模型。
- 不修改保存用的 Server Action 字段契约。
- 不修改静态分享包和云端发布包的数据结构。
- 预览与两类导出继续调用同一个静态渲染器，避免三套页面出现视觉差异。

## 下一阶段

1. 增加卡片与章节拖拽排序，同时保留键盘可操作方式。
2. 增加撤销、重做和本机草稿恢复，防止长时间编辑意外丢失。
3. 为刚上传的封面和背景提供保存前即时预览。
4. 扩充字号、内容密度和章节构图能力，但保持静态导出轻量。
5. 建立桌面与手机视口截图回归，重点检查文字可读性、图片构图和触控切换。

## English Summary

Share Gallery Editor 2.0 turns the long gallery form into four focused workspaces while preserving the existing database, Server Action, public-data allowlist, and static export contract. Phase one delivers Content, Visual, Sections, and Cards editing with desktop/mobile live preview. Future phases add accessible drag ordering, undo/redo, local draft recovery, pre-save image preview, richer composition controls, and viewport regression checks.
