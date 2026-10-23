export const currentReleaseNotes = {
  "date": "2026-10-23",
  "highlights": {
    "zh": [
      "数据板块采用总览、趋势、结构、明细四页签和统一收藏范围，支持关键词搜索、条件移除、精确档案下钻与完整问题清单。",
      "仅保留固定快照，支持查看、重命名、删除及历史比较；比较差额为对象减基准，冻结结果和核算依据不随重命名变化。",
      "财务与活动趋势独立选择期限，金额与数量并排切换，数量图不包含费用；结构统计全部档案，按持仓估值计算占比，显示已售归档和 Top 1／3／5。",
      "首页三栏与数值对齐，卡片列表整行可点击；简化视图切换和筛选箭头，保留原有条件。结构列表展开后在末尾收起。",
      "寻卡搜索加入防抖、数据库分页与关联索引复用，损坏的滚动缓存可安全恢复；没有新增商品、价格记录或后台抓取。",
      "修复 start-desktop 的 Electron 运行程序准备及失败重试，使用 Next.js 16.4.1 和 Electron 42.11.9。",
      "统一页面参数与快照异常处理，汇总页只保留汇总和前五项；删除旧拖拽布局、动态视图操作、失效样式与重复发布入口，保留财务独立对照测试和现有数据格式。"
    ],
    "en": [
      "Data uses Overview, Trends, Structure and Details with one collection scope, keyword search, removable conditions, exact archive drill-through and complete issue lists.",
      "Only fixed snapshots remain, with viewing, renaming, deletion and historical comparison. Differences are target minus baseline; renaming never changes frozen results or accounting evidence.",
      "Financial and activity charts have independent ranges and adjacent amount/quantity controls. Quantities exclude expenses. Structure counts all archives, uses held values for shares and shows sold archives and Top 1/3/5.",
      "Home panels and numbers align, and card list rows are clickable throughout. View and filter controls are compact while all filter conditions remain. Expanded structure lists collapse from the end.",
      "Scout adds debounced queries, database pagination, shared relationship indexes and safe recovery from damaged scroll caches. No item/price records or background scraping are added.",
      "Desktop startup prepares the Electron runtime separately and supports retry. Dependencies use Next.js 16.4.1 and Electron 42.11.9.",
      "Page state and snapshot recovery are shared; summary tabs retain aggregates and five positions only. Old drag layouts, live-view actions, stale styles and a duplicate release entry are removed. Independent financial reference tests and the existing data format remain."
    ]
  }
} as const;
