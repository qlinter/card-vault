import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import {
  addExpenseAction,
  addTransactionAction,
  addValuationAction,
  deleteFinancialRecordAction,
  updateExpenseAction,
  updateTransactionAction,
  updateValuationAction
} from "@/app/actions/financial-history";
import { HistoryCurrencySelect, ValuationSourceSelect } from "@/components/financial-history-selects";
import { formatMinorMoney, selectLatestValuation } from "@/lib/financial-history";

type FinancialHistoryProps = {
  cardId: string;
  transactions: CardTransaction[];
  expenses: CardExpense[];
  valuations: CardValuation[];
};

type TimelineItem =
  | { type: "transaction"; date: Date; record: CardTransaction }
  | { type: "expense"; date: Date; record: CardExpense }
  | { type: "valuation"; date: Date; record: CardValuation };

const transactionLabels: Record<string, string> = { purchase: "购入", sale: "售出", refund: "退款" };
const expenseLabels: Record<string, string> = {
  grading: "评级",
  shipping: "运费",
  tax: "税费",
  insurance: "保险",
  storage: "存储",
  marketplace_fee: "平台费用",
  other: "其他"
};

function dateInput(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function amountInput(amountMinor: bigint, currency: string): string {
  return formatMinorMoney(amountMinor, currency).replace(`${currency} `, "");
}

function CurrencyField({ value = "CNY" }: { value?: string }) {
  return (
    <label className="field">
      <span>币种</span>
      <HistoryCurrencySelect name="currency" defaultValue={value} />
    </label>
  );
}

function ValuationSourceField({ value = "个人估计" }: { value?: string }) {
  return (
    <label className="field">
      <span>估值来源 *</span>
      <ValuationSourceSelect name="source" defaultValue={value} required />
    </label>
  );
}

function Summary({ transactions, expenses, valuations }: Omit<FinancialHistoryProps, "cardId">) {
  const currencies = [...new Set([
    ...transactions.map((row) => row.currency),
    ...expenses.map((row) => row.currency),
    ...valuations.map((row) => row.currency)
  ])].sort();

  if (currencies.length === 0) return <p className="muted">尚无财务记录。可从下方新增第一条记录。</p>;

  return (
    <div className="financial-summary-grid">
      {currencies.map((currency) => {
        const purchase = transactions
          .filter((row) => row.currency === currency && row.kind === "purchase")
          .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
        const sale = transactions
          .filter((row) => row.currency === currency && row.kind === "sale")
          .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
        const refund = transactions
          .filter((row) => row.currency === currency && row.kind === "refund")
          .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
        const expense = expenses
          .filter((row) => row.currency === currency)
          .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
        const latest = selectLatestValuation(valuations, currency);
        return (
          <div className="financial-summary-card" key={currency}>
            <strong>{currency}</strong>
            <span>购入 {formatMinorMoney(purchase, currency)}</span>
            <span>费用 {formatMinorMoney(expense, currency)}</span>
            <span>售出 {formatMinorMoney(sale, currency)}</span>
            <span>退款 {formatMinorMoney(refund, currency)}</span>
            <span>最新估值 {latest ? formatMinorMoney(latest.amountMinor, currency) : "-"}</span>
          </div>
        );
      })}
    </div>
  );
}

function AddForms({ cardId }: { cardId: string }) {
  const addTransaction = addTransactionAction.bind(null, cardId);
  const addExpense = addExpenseAction.bind(null, cardId);
  const addValuation = addValuationAction.bind(null, cardId);
  return (
    <div className="financial-entry-grid">
      <details className="financial-entry-card">
        <summary>新增交易</summary>
        <form action={addTransaction} className="financial-form">
          <label className="field"><span>类型</span><select name="kind"><option value="purchase">购入</option><option value="sale">售出</option><option value="refund">退款</option></select></label>
          <label className="field"><span>金额</span><input name="amount" inputMode="decimal" required /></label>
          <CurrencyField />
          <label className="field"><span>数量</span><input name="quantity" type="number" min="1" defaultValue="1" required /></label>
          <label className="field"><span>日期</span><input name="occurredAt" type="date" defaultValue={dateInput()} required /></label>
          <label className="field"><span>渠道 / 来源</span><input name="source" /></label>
          <label className="field full"><span>备注</span><textarea name="notes" /></label>
          <button className="btn btn-primary" type="submit">保存交易</button>
        </form>
      </details>

      <details className="financial-entry-card">
        <summary>新增费用</summary>
        <form action={addExpense} className="financial-form">
          <label className="field"><span>类型</span><select name="kind"><option value="grading">评级</option><option value="shipping">运费</option><option value="tax">税费</option><option value="insurance">保险</option><option value="storage">存储</option><option value="marketplace_fee">平台费用</option><option value="other">其他</option></select></label>
          <label className="field"><span>金额</span><input name="amount" inputMode="decimal" required /></label>
          <CurrencyField />
          <label className="field"><span>日期</span><input name="occurredAt" type="date" defaultValue={dateInput()} required /></label>
          <label className="field"><span>服务方</span><input name="vendor" /></label>
          <label className="field full"><span>备注</span><textarea name="notes" /></label>
          <button className="btn btn-primary" type="submit">保存费用</button>
        </form>
      </details>

      <details className="financial-entry-card">
        <summary>新增估值</summary>
        <form action={addValuation} className="financial-form">
          <label className="field"><span>金额</span><input name="amount" inputMode="decimal" required /></label>
          <CurrencyField />
          <label className="field"><span>估值日期</span><input name="valuedAt" type="date" defaultValue={dateInput()} required /></label>
          <ValuationSourceField />
          <label className="field full"><span>备注</span><textarea name="notes" /></label>
          <button className="btn btn-primary" type="submit">保存估值</button>
        </form>
      </details>
    </div>
  );
}

function TimelineRecord({ cardId, item }: { cardId: string; item: TimelineItem }) {
  const record = item.record;
  const isTransaction = item.type === "transaction";
  const isExpense = item.type === "expense";
  const label = isTransaction
    ? transactionLabels[(record as CardTransaction).kind] ?? (record as CardTransaction).kind
    : isExpense
      ? expenseLabels[(record as CardExpense).kind] ?? (record as CardExpense).kind
      : "估值";
  const source = isTransaction
    ? (record as CardTransaction).source
    : isExpense
      ? (record as CardExpense).vendor
      : (record as CardValuation).source;
  const supportedCurrency = record.currency === "CNY" || record.currency === "USD";
  const updateAction = isTransaction
    ? updateTransactionAction.bind(null, cardId, record.id)
    : isExpense
      ? updateExpenseAction.bind(null, cardId, record.id)
      : updateValuationAction.bind(null, cardId, record.id);
  const deleteAction = deleteFinancialRecordAction.bind(null, cardId, item.type, record.id);

  return (
    <article className="financial-timeline-item">
      <div className="financial-record-main">
        <span className={`financial-kind financial-kind-${item.type}`}>{label}</span>
        <div>
          <strong>{formatMinorMoney(record.amountMinor, record.currency)}</strong>
          <small>{item.date.toLocaleDateString("zh-CN", { timeZone: "UTC" })}{source ? ` · ${source}` : ""}</small>
        </div>
        <span className="financial-provenance">{!supportedCurrency ? "旧币种待纠正" : record.provenance === "manual_correction" ? "已纠错" : record.provenance === "legacy_card_snapshot" ? "旧数据迁移" : record.provenance === "initial_card_entry" ? "初始录入" : "手动录入"}</span>
      </div>
      {record.notes ? <p>{record.notes}</p> : null}
      <details className="financial-correction">
        <summary>纠错与删除</summary>
        <form action={updateAction} className="financial-form compact">
          <input type="hidden" name="recordMarker" value={`${item.type}-${record.id}`} />
          {isTransaction ? (
            <>
              <label className="field"><span>类型</span><select name="kind" defaultValue={(record as CardTransaction).kind}><option value="purchase">购入</option><option value="sale">售出</option><option value="refund">退款</option></select></label>
              <label className="field"><span>数量</span><input name="quantity" type="number" min="1" defaultValue={(record as CardTransaction).quantity} required /></label>
            </>
          ) : null}
          {isExpense ? <label className="field"><span>类型</span><select name="kind" defaultValue={(record as CardExpense).kind}><option value="grading">评级</option><option value="shipping">运费</option><option value="tax">税费</option><option value="insurance">保险</option><option value="storage">存储</option><option value="marketplace_fee">平台费用</option><option value="other">其他</option></select></label> : null}
          <label className="field"><span>金额</span><input name="amount" inputMode="decimal" defaultValue={amountInput(record.amountMinor, record.currency)} required /></label>
          <CurrencyField value={supportedCurrency ? record.currency : "CNY"} />
          <label className="field"><span>日期</span><input name={item.type === "valuation" ? "valuedAt" : "occurredAt"} type="date" defaultValue={dateInput(item.date)} required /></label>
          {item.type === "valuation" ? (
            <ValuationSourceField value={source ?? "个人估计"} />
          ) : (
            <label className="field"><span>{isExpense ? "服务方" : "渠道 / 来源"}</span><input name={isExpense ? "vendor" : "source"} defaultValue={source ?? ""} /></label>
          )}
          <label className="field full"><span>备注</span><textarea name="notes" defaultValue={record.notes ?? ""} /></label>
          <button className="btn btn-secondary" type="submit">保存纠错</button>
        </form>
        <form action={deleteAction} className="financial-delete-form">
          <button className="btn btn-danger" type="submit">删除这条记录</button>
          <small>删除后将重新计算兼容快照，此操作无法撤销。</small>
        </form>
      </details>
    </article>
  );
}

export function CardFinancialHistory(props: FinancialHistoryProps) {
  const timeline: TimelineItem[] = [
    ...props.transactions.map((record) => ({ type: "transaction" as const, date: record.occurredAt, record })),
    ...props.expenses.map((record) => ({ type: "expense" as const, date: record.occurredAt, record })),
    ...props.valuations.map((record) => ({ type: "valuation" as const, date: record.valuedAt, record }))
  ].sort((left, right) => right.date.getTime() - left.date.getTime());

  return (
    <section className="panel financial-history" id="financial-history">
      <div className="financial-history-heading">
        <div><h2>财务历史</h2><p className="muted">交易、费用和估值按时间独立保存；不同币种不会被混合计算。</p></div>
        <span>{timeline.length} 条记录</span>
      </div>
      <Summary transactions={props.transactions} expenses={props.expenses} valuations={props.valuations} />
      <AddForms cardId={props.cardId} />
      <div className="financial-timeline">
        <h3>时间线</h3>
        {timeline.length ? timeline.map((item) => <TimelineRecord key={`${item.type}-${item.record.id}`} cardId={props.cardId} item={item} />) : <p className="muted">暂无历史记录。</p>}
      </div>
    </section>
  );
}
