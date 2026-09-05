"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function FinanceRulesPage() {
  const { locale } = useLanguage();
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const metrics = [
    ["累计买入金额", "Total purchases", "所有购买交易的付款总额，不含单独录入的费用。", "All purchase payments, excluding separately recorded expenses."],
    ["累计出售金额", "Total sales", "所有出售交易的收款总额，尚未扣除出售费用。", "All sale proceeds before sale expenses."],
    ["净现金投入", "Net cash invested", "累计买入金额 + 累计费用 − 累计出售金额。负数表示累计收回现金超过投入。", "Purchases + all expenses − sales. A negative amount means more cash has been recovered than paid out."],
    ["累计费用", "Total expenses", "买入、评级、出售费用的合计；出售费用只抵减出售收入，不加入剩余持仓成本。", "Purchase, grading and sale expenses combined. Sale expenses reduce sale proceeds and do not increase remaining inventory cost."],
    ["剩余成本", "Remaining cost", "尚未出售卡片分摊的购买金额、买入费用和评级费用。", "Purchase payments and purchase/grading expenses allocated to unsold cards."],
    ["已实现盈亏", "Realized profit", "出售金额 − 出售费用 − 卖出卡片结转的成本。", "Sale proceeds − sale expenses − the cost allocated to sold cards."],
    ["未实现盈亏", "Unrealized profit", "持仓估值 − 对应的剩余成本。", "Holding value − the corresponding remaining cost."],
    ["总盈亏", "Total profit", "已实现盈亏 + 未实现盈亏。全部售出时，仅保留已实现盈亏。", "Realized + unrealized profit. Once fully sold, only realized profit remains."],
    ["未实现回报率", "Unrealized return", "未实现盈亏 ÷ 对应剩余成本 × 100%；成本为零或资料不完整时显示“—”。", "Unrealized profit ÷ corresponding remaining cost × 100%. Shown as unavailable when the cost is zero or data are incomplete."]
  ];
  return <div className="page finance-rules-page" data-i18n-skip>
    <div className="title-row"><h1 className="h1">{t("财务计算规则", "Financial calculation rules")}</h1><Link className="btn btn-secondary" href="/settings#financial-settings">{t("返回财务", "Back to Finance")}</Link></div>
    <p className="muted">{t("先保留原币记录，再按主币种汇总。交易决定数量与成本，估值用于衡量尚未出售的持仓。", "Original-currency records are retained and aggregated in the primary currency. Transactions determine quantities and costs; valuations measure unsold holdings.")}</p>
    <section className="panel"><h2>{t("1. 单卡：数量与成本", "1. Individual cards: quantities and costs")}</h2>
      <p>{t("当前持有 = 累计买入张数 − 累计出售张数。一笔交易同时用 CNY 和 USD 付款时，两部分金额都计入，卡片数量只计算一次。交易金额是整笔总额；估值金额是单张价格。", "Holding quantity = cards purchased − cards sold. A mixed CNY/USD payment includes both amounts but counts physical cards only once. Transaction amounts are totals; valuation amounts are per card.")}</p>
      <p>{t("成本采用移动平均法：新增购买和持仓费用先加入成本池；出售时，按出售前的平均单张成本分摊卖出部分，剩余成本留给未售卡片。已关联的出售费用跟随对应出售记录；其他费用按业务日期进入核算。", "Moving-average costing adds purchases and inventory expenses to the cost pool. A sale takes its share using the average unit cost immediately before sale; the rest remains with unsold cards. Linked sale expenses follow their sale; other expenses enter by business date.")}</p>
    </section>
    <section className="panel"><h2>{t("2. 投入、成本与盈亏", "2. Investment, costs and profit")}</h2><dl className="finance-rules-metrics">{metrics.map(([zh, en, zhRule, enRule]) => <div key={en}><dt>{t(zh, en)}</dt><dd>{t(zhRule, enRule)}</dd></div>)}</dl></section>
    <section className="panel"><h2>{t("3. 双币估值怎么选", "3. Choosing between currency quotes")}</h2>
      <p>{t("优先使用主币种最新的直接估值，即使另一币种报价更晚。没有主币种报价时，才折算另一币种的最新报价。相同估值日期按录入时间取较新记录。CNY 与 USD 报价是同一资产的两种价格，不能相加。", "The latest direct quote in the primary currency takes priority, even if another currency has a newer quote. Only when no direct quote exists is the latest alternative quote converted. Ties use the later entry time. CNY and USD quotes price the same asset and are never added together.")}</p>
      <p>{t("持仓估值 = 选定的单张估值 × 剩余张数。已全部售出或列为目标的卡片不计入当前持仓估值。", "Holding value = selected unit quote × remaining quantity. Fully sold cards and collection targets do not contribute to current holding value.")}</p>
    </section>
    <section className="panel"><h2>{t("4. 主币种与人工汇率", "4. Primary currency and manual exchange rates")}</h2>
      <p>{t("主币种可选 CNY 或 USD。人工汇率固定填写“1 USD = 多少 CNY”：美元转人民币乘以该汇率，人民币转美元除以该汇率。系统不自动获取汇率；来源说明可留空。", "Choose CNY or USD as the primary currency. Enter rates as 1 USD = an amount of CNY: multiply to convert USD to CNY, divide for CNY to USD. Rates are entered manually; source notes are optional.")}</p>
      <p>{t("每条汇率从生效日期起使用，直到下一生效日期之前；同日有多条时使用最新修订。购买、费用和出售按各自业务日期折算，估值按报价日期折算。历史成本不会随今天的新汇率重算。", "A rate applies from its effective date until the next effective date; the latest revision wins within a date. Purchases, expenses and sales use their business dates; valuations use their quote dates. A new rate today does not reprice older costs.")}</p>
      <p>{t("编辑或删除旧汇率会重新计算受影响日期区间；切换主币种会重新生成当前报表，原币金额不变。金额逐项折算并四舍五入到分后汇总；汇率最多保留六位小数。", "Editing or deleting an older rate recalculates its affected period. Changing the primary currency regenerates live reports while preserving original amounts. Each component is converted and rounded to cents before aggregation; rates allow up to six decimal places.")}</p>
    </section>
    <section className="panel"><h2>{t("5. 整体汇总与历史趋势", "5. Portfolio totals and historical trends")}</h2>
      <p>{t("整体数据仅统计当前筛选范围。首页与持仓财务的估值合计已有报价的持仓，并显示覆盖数；完整的成本与盈亏需要对应资料齐全，缺失时显示“—”。", "Totals cover the current filter scope. Home and holding values sum quoted holdings and show coverage. Complete costs and returns require the corresponding data; otherwise they are unavailable.")}</p>
      <p>{t("财务历史按每个月月末重建，本月截至当前时间，不用之后的报价倒填过去。只要当月部分持仓有估值，就显示这些持仓的估值合计；未实现盈亏只减去这些已估值持仓的剩余成本，其中缺少成本时显示“—”。完全没有报价时保留空值。", "History is reconstructed at each month-end, or now for the current month. Later quotes never fill earlier months. Any quoted holdings can contribute to historical value. Historical unrealized profit subtracts only those holdings’ remaining costs; missing costs make that return unavailable. With no quotes, values remain missing.")}</p>
      <p>{t("“估值覆盖 X/Y”表示当月有估值的持仓卡片条目数 / 全部持仓条目数；“成本完整 X/Y”同理。部分覆盖期间的曲线不代表全部组合收益。30/90/180 天估值变化包含数量与报价覆盖变化，不等于投资回报。", "Valuation coverage X/Y counts quoted holding entries out of all holding entries; cost coverage works similarly. Partially covered periods do not represent full portfolio returns. The 30/90/180-day value changes include quantity and coverage changes and are not investment returns.")}</p>
    </section>
    <section className="panel"><h2>{t("6. 活动趋势的金额与数量", "6. Activity amounts and quantities")}</h2>
      <p>{t("按业务月份汇总：买入金额包含购买付款和买入费用；出售金额为出售收款减出售费用。买入、出售数量是交易张数之和，费用不会重复增加张数。活动图表仅展示买入和出售；评级费用仍计入持仓成本。点击、悬停或用键盘聚焦月份数据点，可查看该月金额和数量。", "By business month: purchases include purchase payments and purchase expenses; sales show proceeds minus sale expenses. Purchase and sale quantities sum physical cards; fees do not add cards. The activity chart shows purchases and sales only; grading expenses still contribute to holding costs. Click, hover or focus a month to inspect its amounts and quantities.")}</p>
    </section>
    <section className="panel"><h2>{t("7. 缺失数据与已保存快照", "7. Missing data and saved snapshots")}</h2>
      <p>{t("没有填写成本不同于明确填写 0 元；没有可用历史汇率也不能当成零成本。单卡与整体完整收益不推测缺失金额。已保存的组合快照保留保存时的数值、币种和汇率依据，之后改汇率不会改写快照。", "An absent cost differs from an explicitly entered zero. A missing historical rate never means zero cost. Complete card and portfolio returns do not invent missing amounts. Saved snapshots retain their original values, currency and rate evidence when live rates change.")}</p>
    </section>
    <section className="panel"><h2>{t("8. 一个例子", "8. An example")}</h2><p>{t("以 CNY 100 + USD 100 买入 2 张，汇率为 7，再付 USD 20 评级费：总成本 CNY 940，每张成本 CNY 470。卖出 1 张收 CNY 600，出售费用 CNY 72：已实现盈亏为 600 − 72 − 470 = CNY 58。剩余一张直接估值 CNY 650：未实现盈亏为 CNY 180，总盈亏为 CNY 238。", "Buy two cards for CNY 100 + USD 100 at a rate of 7, then pay USD 20 for grading: total cost is CNY 940, or CNY 470 per card. Sell one for CNY 600 with CNY 72 in sale expenses: realized profit is 600 − 72 − 470 = CNY 58. A direct CNY 650 quote for the remaining card gives CNY 180 unrealized profit and CNY 238 total profit.")}</p></section>
  </div>;
}
