"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

const sections = [
  { id: "home", zh: "首页", en: "Home", items: [
    ["首页汇总当前筛选范围的卡片数量和估值。使用搜索、筛选和排序定位收藏，继续加载可查看更多卡片；筛选操作栏右侧切换卡片/列表视图，点击卡片进入详情。", "Home summarizes card counts and valuations in the current filter scope. Search, filter and sort to find cards, load more to continue browsing, switch Cards/List beside Add card, and open a card for details."],
    ["右上角语言菜单切换中文或英文，仅改变界面文字，不改写卡名、主体、标签或备注。", "The language menu switches interface text between Chinese and English without changing card titles, subjects, tags or notes."]
  ] },
  { id: "cards", zh: "卡片录入与维护", en: "Card entry & maintenance", items: [
    ["从首页新增卡片，填写主体、名称、运动、年份、品牌、版本和评级等档案资料，并上传卡图。模板和录入队列用于连续录入；保存前核对重复提示，同款不同实物应按实际情况单独保存。", "Add a card from Home, enter its subject, title, sport, year, brand, variant and grading details, and upload images. Templates and the entry queue support repeated entry. Review duplicate hints before saving; separate physical copies can have separate archives."],
    ["在详情页编辑档案、管理图片，录入购买、出售、费用和估值历史。购买和出售决定持有数量；金额、日期、数量及币种应按实际记录填写。删除卡片会影响其关联资料，请先核对确认页面。", "Use card details to edit archives, manage images and record purchases, sales, expenses and valuations. Purchases and sales determine holdings. Enter actual amounts, dates, quantities and currencies. Review the confirmation page before deleting a card and its related data."],
    ["档案或财务表单提交失败时，先根据错误提示修正再提交；页面内保留已输入内容和新选图片，重新加载后图片需要重新选择。", "When an archive or financial form fails, correct the reported error and submit again. Entered values and selected images remain on the page; images must be selected again after reloading."]
  ] },
  { id: "showcase", zh: "展示", en: "Showcase", items: [
    ["展示页可按分组浏览收藏，在卡片区域右上角切换卡片/列表视图并打开卡片大图。卡片的公开状态控制展示范围；展示页与分享集独立，修改分享集不会改动收藏档案。", "Showcase lets you browse cards by group, switch Cards/List views above the cards on the right and open larger images. Card visibility controls inclusion. Showcase and share collections are independent; editing a share does not change the archive."]
  ] },
  { id: "portfolio", zh: "组合", en: "Portfolio", items: [
    ["组合页集中查看持仓、成本、估值、收益、收藏结构和数据质量。统计以当前筛选范围为准；查看覆盖数，避免把部分估值误认为全部收藏的价值。展开“财务待完善”可查看缺失项，并点击卡片名称补齐资料。", "Portfolio brings together holdings, costs, valuations, returns, collection structure and data quality within the current filter scope. Check coverage before interpreting partial valuations as the value of the entire collection. Expand Financial data incomplete to see missing items and open the affected cards."],
    ["可使用收藏视图和时间点快照保存观察范围与结果，查看历史趋势或进行对比。快照保留生成时的数据和汇率依据，后续编辑不会自动重写已保存快照。", "Use collection views and dated snapshots to retain a scope and its results, inspect history or compare periods. Saved snapshots retain their original data and exchange-rate evidence and are not automatically rewritten by later edits."]
  ] },
  { id: "finance", zh: "财务口径", en: "Financial rules", items: [
    ["交易金额填写整笔总额，估值填写单张价格。持有数量等于累计购买减累计出售；CNY/USD 混合付款只计算一次实物数量。", "Transaction amounts are totals; valuations are per-card prices. Holdings equal purchases minus sales. Mixed CNY/USD payments count physical quantity only once."],
    ["成本使用移动平均法。出售费用抵减出售收入；未实现盈亏比较尚未出售持仓的估值与剩余成本。缺失成本、估值或汇率时，相关完整指标显示不可用，不按零计算。", "Costs use the moving-average method. Sale expenses reduce sale proceeds; unrealized profit compares unsold holdings' value with remaining cost. Missing costs, valuations or exchange rates make the affected complete metrics unavailable rather than zero."],
    ["设置中选择报表币种并维护人工汇率，报价方向为 1 USD 对应多少 CNY。业务按各自日期使用有效汇率；编辑旧汇率可能影响对应历史区间的当前报表。", "Choose the reporting currency and maintain manual rates in Settings, quoted as CNY per 1 USD. Each event uses the rate effective on its own date; editing an old rate may change current reports for that historical period."]
  ] },
  { id: "shares", zh: "分享", en: "Shares", items: [
    ["分享列表中可直接预览、编辑、导出或删除分享集。创建分享集后选择卡片，编辑标题、介绍和章节，选择展馆模板、主题、背景及卡图构图。完整卡图模式保留卡片边缘，裁切模式用于填满画面。发布前先检查预览。", "Preview, edit, export or delete a share collection directly from the share list. Create a share collection, choose cards, edit its title, introduction and sections, then select a gallery template, theme, background and image fit. Contain mode preserves card edges; cover mode fills the frame. Review the preview before publishing."],
    ["导出静态包后沿用现有静态托管或 Drop 流程发布。导出使用公开字段白名单，不含成本、价格、私人备注、密钥或本地路径；仍应自行检查主动填写的公开介绍和所选图片。在线发布管理与多设备同步暂未提供。", "Export a static package and publish through the existing static-hosting or Drop workflow. Exports use a public-field allowlist, excluding costs, prices, private notes, keys and local paths. Review your public descriptions and selected images. Managed online publishing and multi-device sync are not available."]
  ] },
  { id: "data", zh: "数据", en: "Data", items: [
    ["从设置进入数据。导入支持 UTF-8 CSV 和 XLSX 的首个工作表，每批最多 10 MB、10000 行、80 列。先把公式转为数值，编号保存为文本以保留前导零；上传后映射字段并检查样例。", "Open Data from Settings. Import UTF-8 CSV or the first XLSX worksheet, up to 10 MB, 10,000 rows and 80 columns per batch. Convert formulas to values and keep identifiers as text to preserve leading zeros. Map fields and review the sample after uploading."],
    ["重复策略包括跳过、更新档案字段、作为独立实物新增。先预演并检查每行结果，再执行；预演本身不修改卡片。新卡可暂不带图片，已有卡片的财务历史不会被档案导入覆盖。", "Choose to skip duplicates, update archive fields or create separate physical cards. Preview and inspect every row before applying; previewing does not modify cards. New cards may omit images. Archive imports do not overwrite existing financial history."],
    ["当前批次保留执行结果，可继续执行或重试失败行。撤销需要确认，会恢复原值或删除本批次新增卡片；已有后续修改时保留数据并报告冲突。修改后的文件需要重新导入。", "The current batch retains results so you can continue or retry failed rows. Confirmed undo restores previous values or removes cards created by the batch. Later edits are preserved and reported as conflicts. Upload corrected files again."],
    ["导出支持搜索和列表/表格切换，右侧分段按钮选择视图。点击卡片信息进入详情，返回上一页会恢复数据展开状态、搜索、页码、视图和勾选。CSV/XLSX 有勾选时仅导出搜索范围内选中的卡片，无勾选时导出当前搜索结果；私密 XLSX 另含财务流水，仅公开导出排除私人备注和财务流水。图片及完整恢复请使用备份。", "Export supports search and list/table views, selected with the segmented control on the right. Open card details from the card information. Going back restores the expanded Data section, search, page, view and selection. CSV/XLSX exports include checked cards within the search scope, or all search results when no cards are checked. Private XLSX includes financial history; public-only exports exclude private notes and financial history. Use backups for images and full restoration."]
  ] },
  { id: "plans", zh: "计划", en: "Plans", items: [
    ["计划页左侧集中展示摘要和待整理，右侧维护心愿单。摘要右上角选择最近 7 天或 30 天，统计新增卡片、购买、出售和估值记录数。", "Plans groups the digest and review queue on the left, with the wishlist on the right. Select the last 7 or 30 days at the top of the digest to count new cards and purchase, sale and valuation records."],
    ["缺图、缺购买成本和缺估值会进入待整理。估值、送评和在售均满 180 天提醒：估值从最近估值日计算，送评和在售从进入状态的日期计算，修改普通资料不重置计时；旧记录没有准确日期时标为估算；已售和目标卡不产生持仓估值提醒。", "Missing images, purchase costs or valuations enter the review queue. Valuation, grading and listing reminders all start at 180 days. Valuations age from the latest valuation date; grading and listings age from their status start dates, which ordinary edits do not reset. Older records without an exact date are marked as estimated. Sold and target cards do not receive holding valuation reminders."],
    ["每项可完成、忽略、延后 7 天或重新打开；勾选“显示已处理”可查看已处理项目。条件消失后提醒移除，缺失条件再次出现时重新进入待整理。摘要和提醒只在计划页查看，不发送系统通知。", "Mark a reminder done, dismiss it, snooze it for 7 days or reopen it. Show handled reminders includes handled items. Resolved conditions leave the queue; recurring missing conditions reopen reminders. Digests and reminders are viewed in Plans only; no system notifications are sent."],
    ["“新增”和“列表”可分别展开或收起。心愿可填写名称、主体、预算、币种、目标日期和备注；编辑已有心愿时自动展开输入区。待实现预算按币种独立汇总；已实现或取消的愿望不计入，可重新计划。", "New and List expand or collapse independently. Wishes include a title, subject, budget, currency, target date and notes; editing a wish opens its input section. Planned budgets are totaled separately by currency. Acquired or cancelled wishes are excluded and can be planned again."]
  ] },
  { id: "settings", zh: "设置、备份与 AI", en: "Settings, backups & AI", items: [
    ["设置页依次提供数据、AI、财务、使用说明和关于。数据和使用说明向下展开；数据内统一管理存储、备份与恢复、导入和导出。收起后保留当前输入。通过应用提供的迁移或恢复入口处理数据路径变更。", "Settings contains Data, AI, Finance, User guide and About. Expand Data or User guide in place. Data groups Storage, Backup & restore, Import and Export. Collapsing preserves current inputs. Use the application's migration or restore controls when changing data locations."],
    ["完整备份保存数据库、图片、分享、批次和计划状态；CSV/XLSX 不能替代备份。恢复前核对来源并保留当前数据，系统验证媒体和校验清单、保留安全备份并生成恢复报告。仅接受带有效清单的当前格式备份，不再自动升级旧数据。", "Full backups preserve the database, images, shares, batches and plan state. CSV/XLSX files cannot replace backups. Verify the source and preserve current data before restoring. The app checks media and manifests, retains a safety backup and creates a restore report. Only current-format backups with valid manifests are accepted; older data is not upgraded automatically."],
    ["数据健康检查用于发现资料或媒体问题。孤立媒体清理会保留恢复副本；有疑问时先做完整备份再处理。", "Data health checks identify archive or media issues. Orphan-media cleanup retains recovery copies. Make a full backup before resolving uncertain issues."],
    ["AI 为可选功能，在设置中配置服务地址、模型和密钥。调用所选服务时，相关图片或内容会发送给该服务；识别结果需核对后保存，服务异常不影响手动录入。", "AI is optional. Configure the service endpoint, model and key in Settings. Calling the selected service sends relevant images or content to it. Review recognition results before saving; service failures do not prevent manual entry."]
  ] }
];

export function UserGuide({ embedded = false }: { embedded?: boolean }) {
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  return <div className={embedded ? "user-guide-page" : "page user-guide-page"}>
    {!embedded ? <header className="title-row"><h1 className="h1">{l("使用说明", "User guide")}</h1><Link className="btn btn-secondary" href="/settings">{l("返回设置", "Back to Settings")}</Link></header> : null}
    <nav className="panel user-guide-index" aria-label={l("说明目录", "Guide contents")}>{sections.map(section => <a key={section.id} href={"#" + section.id}>{l(section.zh, section.en)}</a>)}</nav>
    {sections.map(section => <section className="panel user-guide-section" id={section.id} key={section.id}>
      <h2>{l(section.zh, section.en)}</h2>
      {section.items.map(([zh, en]) => <p key={en}>{l(zh, en)}</p>)}
      {section.id === "finance" ? <Link href="/settings/finance-rules">{l("详细财务计算规则", "Detailed financial calculation rules")}</Link> : null}
    </section>)}
  </div>;
}
