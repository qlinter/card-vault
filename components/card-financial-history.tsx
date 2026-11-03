"use client";

import { UiText, UiElement } from "@/components/ui-text";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useState } from "react";
import { paymentComponents, type FinancialConfig } from "@/lib/financial-reporting";
import { saveFinancialRecordFormAction, deleteFinancialRecordAction } from "@/app/actions/financial-history";
import { recordVersion } from "@/lib/record-version";
import { ExpenseForm, TransactionForm, ValuationForm, type ExpenseSaleTransaction } from "@/components/financial-history-forms";
import { FinancialPositionOverview } from "@/components/financial-position-overview";
import { formatMinorMoney } from "@/lib/financial-history";
import {
  expenseContextLabels,
  expenseKindLabels,
  formatHistoryDateInput,
  formatHistoryDateLabel,
  transactionLabels,
  valuationSourceLabel
} from "@/lib/financial-history-presentation";

type FinancialHistoryProps = {
  config: FinancialConfig;
  holdingQuantity: number;
  collectionStatus: string;
  cardId: string;
  returnTo?: string;
  transactions: CardTransaction[];
  expenses: CardExpense[];
  valuations: CardValuation[];
  editorOnly?: false;
} | { editorOnly: true; cardId: string; returnTo?: string; transactions: ExpenseSaleTransaction[] };

type TimelineItem =
  | { type: "transaction"; date: Date; record: CardTransaction }
  | { type: "expense"; date: Date; record: CardExpense }
  | { type: "valuation"; date: Date; record: CardValuation };

type RecordType = TimelineItem["type"];
type NewRecordKind = "purchase" | "sale" | "expense" | "valuation";
const recordActions: Array<{ kind: NewRecordKind; label: string }> = [{ kind: "purchase", label: "买入" }, { kind: "sale", label: "卖出" }, { kind: "expense", label: "费用" }, { kind: "valuation", label: "估值" }];
type HistoryFilter = "all" | RecordType;

const filterLabels: Record<HistoryFilter, string> = {
  all: "全部",
  transaction: "交易",
  expense: "费用",
  valuation: "估值"
};

function recordTitle(item: TimelineItem): string {
  if (item.type === "transaction") return transactionLabels[item.record.kind] ?? item.record.kind;
  if (item.type === "expense") {
    const kind = expenseKindLabels[item.record.kind] ?? item.record.kind;
    const context = expenseContextLabels[item.record.context] ?? item.record.context;
    return `${kind} · ${context}`;
  }
  return "估值";
}

function recordAmount(item: TimelineItem): string {
  const amount = item.type === "transaction" ? paymentComponents(item.record).map((payment) => formatMinorMoney(payment.amountMinor, payment.currency)).join(" + ") : formatMinorMoney(item.record.amountMinor, item.record.currency);
  if (item.type === "valuation") return amount;
  if (item.type === "transaction" && item.record.kind === "sale") return `+${amount}`;
  return `−${amount}`;
}

function recordImpact(item: TimelineItem): string {
  const amount = item.type === "transaction" ? paymentComponents(item.record).map((payment) => formatMinorMoney(payment.amountMinor, payment.currency)).join(" + ") : formatMinorMoney(item.record.amountMinor, item.record.currency);
  if (item.type === "transaction") {
    return item.record.kind === "sale"
      ? `持仓 −${item.record.quantity} 张 · 出售收入 +${amount}`
      : `持仓 +${item.record.quantity} 张 · 持仓成本 +${amount}`;
  }
  if (item.type === "expense") {
    return item.record.context === "sale" ? `出售费用 · 净收入 −${amount}` : `计入持仓成本 +${amount}`;
  }
  return `单张估值更新为 ${amount}`;
}

function recordSource(item: TimelineItem): string | null {
  if (item.type === "transaction") return item.record.source;
  if (item.type === "expense") return item.record.vendor;
  return valuationSourceLabel(item.record.source);
}

function AddRecord({ cardId, returnTo, transactions, recordKind, open, onKindChange, onClose, stayOnPage, onSaved }: { cardId: string; returnTo?: string; transactions: ExpenseSaleTransaction[]; recordKind: NewRecordKind; open: boolean; onKindChange: (kind: NewRecordKind) => void; onClose: () => void; stayOnPage?: boolean; onSaved: () => void }) {
  const [versions, setVersions] = useState({ purchase: 0, sale: 0, expense: 0, valuation: 0 });
  const [pending, setPending] = useState(false);
  const action = (type: RecordType, kind: NewRecordKind) => {
    if (!stayOnPage) return saveFinancialRecordFormAction.bind(null, cardId, type, null, returnTo);
    return async (previous: { error: string }, data: FormData) => {
      setPending(true);
      try {
        const result = await saveFinancialRecordFormAction(cardId, type, null, returnTo, previous, data, stayOnPage);
        if (!result.error) {
          setVersions(current => ({ ...current, [kind]: current[kind] + 1 }));
          onSaved();
        }
        return result;
      } finally { setPending(false); }
    };
  };
  return (
    <div className="financial-add-record" id="financial-add-record" hidden={!open}>
      <div className="financial-add-record-heading">
        <label className="financial-record-type"><span><UiText text="录入类型" /></span><select value={recordKind} disabled={pending} onChange={event => onKindChange(event.target.value as NewRecordKind)}>{recordActions.map(item => <option key={item.kind} value={item.kind}><UiText text={item.label} /></option>)}</select></label>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={onClose}><UiText text={"收起"} /></button>
      </div>
      <div className="financial-record-composer">
        <div hidden={recordKind !== "purchase"}><TransactionForm key={versions.purchase} action={action("transaction", "purchase")} submitLabel="保存交易" transactionKind="purchase" /></div>
        <div hidden={recordKind !== "sale"}><TransactionForm key={versions.sale} action={action("transaction", "sale")} submitLabel="保存交易" transactionKind="sale" /></div>
        <div hidden={recordKind !== "expense"}><ExpenseForm key={versions.expense} action={action("expense", "expense")} submitLabel="保存费用" transactions={transactions} /></div>
        <div hidden={recordKind !== "valuation"}><ValuationForm key={versions.valuation} action={action("valuation", "valuation")} submitLabel="保存估值" /></div>
      </div>
    </div>
  );
}

function TimelineRecord({ cardId, item, returnTo, transactions }: { cardId: string; item: TimelineItem; returnTo?: string; transactions: CardTransaction[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const record = item.record;
  const [editVersion] = useState(() => recordVersion(record));
  const editorId = `financial-edit-${item.type}-${record.id}`;
  const updateAction = saveFinancialRecordFormAction.bind(null, cardId, item.type, record.id, returnTo);
  const deleteAction = deleteFinancialRecordAction.bind(null, cardId, item.type, record.id, returnTo, editVersion);
  const source = recordSource(item);
  const linkedSale = item.type === "expense" && item.record.transactionId
    ? transactions.find((transaction) => transaction.id === item.record.transactionId)
    : null;

  return (
    <article className={`financial-timeline-item financial-timeline-${item.type}`}>
      <time dateTime={formatHistoryDateInput(item.date)}>{formatHistoryDateLabel(item.date)}</time>
      <div className="financial-record-description">
        <div><span className={`financial-kind financial-kind-${item.type}`}><UiText text={filterLabels[item.type]} /></span>{recordTitle(item) !== filterLabels[item.type] ? <strong><UiText text={recordTitle(item)} /></strong> : null}</div>
        <small><UiText text={recordImpact(item)} /></small>
        {linkedSale ? <small className="financial-record-link">{<UiText text={"关联 {0} 出售"} values={[formatHistoryDateInput(linkedSale.occurredAt)]} />}</small> : null}
      </div>
      <strong className={`financial-record-amount ${item.type === "valuation" ? "is-neutral" : item.type === "transaction" && item.record.kind === "sale" ? "is-positive" : "is-negative"}`}>{recordAmount(item)}</strong>
      <button type="button" className="btn btn-secondary financial-edit-trigger" aria-expanded={isEditing} aria-controls={editorId} onClick={() => setIsEditing((open) => !open)}><UiText text={isEditing ? "收起" : "编辑"} /></button>
      <div id={editorId} className="financial-correction-body" hidden={!isEditing}>
          {source || record.notes ? <div className="financial-record-context">{source ? <span><UiText text={"来源 / 服务方："} />{item.type === "valuation" ? <UiText text={source} /> : source}</span> : null}{record.notes ? <span><UiText text={"备注："} />{record.notes}</span> : null}</div> : null}
          {item.type === "transaction" ? <TransactionForm action={updateAction} submitLabel="保存修改" marker={`${item.type}-${record.id}`} record={item.record} /> : null}
          {item.type === "expense" ? <ExpenseForm action={updateAction} submitLabel="保存修改" marker={`${item.type}-${record.id}`} record={item.record} transactions={transactions} /> : null}
          {item.type === "valuation" ? <ValuationForm action={updateAction} submitLabel="保存修改" marker={`${item.type}-${record.id}`} record={item.record} /> : null}
          <form action={deleteAction} className="financial-delete-form">
            <button className="btn btn-danger" type="submit"><UiText text={"删除这条记录"} /></button>
            <small><UiText text={"删除后将重新计算持仓、成本和盈亏，此操作无法撤销。"} /></small>
          </form>
      </div>
    </article>
  );
}

export function CardFinancialHistory(props: FinancialHistoryProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [recordKind, setRecordKind] = useState<NewRecordKind>("purchase");
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeline: TimelineItem[] = props.editorOnly ? [] : [
    ...props.transactions.map((record) => ({ type: "transaction" as const, date: record.occurredAt, record })),
    ...props.expenses.map((record) => ({ type: "expense" as const, date: record.occurredAt, record })),
    ...props.valuations.map((record) => ({ type: "valuation" as const, date: record.valuedAt, record }))
  ].sort((left, right) => right.date.getTime() - left.date.getTime());
  const visibleTimeline = filter === "all" ? timeline : timeline.filter((item) => item.type === filter);
  const counts: Record<HistoryFilter, number> = {
    all: timeline.length,
    transaction: props.transactions.length,
    expense: props.editorOnly ? 0 : props.expenses.length,
    valuation: props.editorOnly ? 0 : props.valuations.length
  };

  return (
    <section className="panel financial-history" id="financial-history">
      <div className="financial-history-heading">
        <div><h2><UiText text="财务" /></h2></div>
        <div className="financial-history-actions">
          {!props.editorOnly ? <span className="financial-history-count">{timeline.length}<UiText text={" 条记录"} /></span> : null}
          <button
            type="button"
            className="btn btn-secondary financial-add-trigger"
            aria-expanded={adding}
            aria-controls="financial-add-record"
            onClick={() => { setSaved(false); setAdding(current => !current); }}
          ><UiText text="新增财务记录" /></button>
        </div>
      </div>
      {saved ? <p className="note-ok" role="status"><UiText text="财务记录已保存。" /></p> : null}
      <AddRecord cardId={props.cardId} returnTo={props.returnTo} transactions={props.transactions} recordKind={recordKind} open={adding} onKindChange={setRecordKind} onClose={() => setAdding(false)} stayOnPage={props.editorOnly} onSaved={() => { setAdding(false); setSaved(true); }} />
      {!props.editorOnly ? timeline.length ? <FinancialPositionOverview transactions={props.transactions} expenses={props.expenses} valuations={props.valuations} config={props.config} holdingQuantity={props.holdingQuantity} collectionStatus={props.collectionStatus} /> : <p className="muted"><UiText text="暂无财务记录。" /></p> : null}
      {!props.editorOnly && timeline.length ? <details className="financial-history-details"><summary><UiText text="历史记录" /> · {timeline.length}</summary><div className="financial-timeline">
        <div className="financial-timeline-heading">
          <h3><UiText text={"历史记录"} /></h3>
          <UiElement as="div" uiAttributes={["aria-label"]} className="financial-history-filters" aria-label="筛选财务记录">
            {(Object.keys(filterLabels) as HistoryFilter[]).map((type) => (
              <button key={type} type="button" aria-pressed={filter === type} onClick={() => setFilter(type)}><UiText text={filterLabels[type]} /> <span>{counts[type]}</span></button>
            ))}
          </UiElement>
        </div>
        {visibleTimeline.length
          ? visibleTimeline.map((item) => <TimelineRecord key={`${item.type}-${item.record.id}`} cardId={props.cardId} item={item} returnTo={props.returnTo} transactions={props.transactions} />)
          : <p className="financial-empty muted"><UiText text={"暂无"} />{filter === "all" ? null : <UiText text={filterLabels[filter]} />}<UiText text={"记录。"} /></p>}
      </div></details> : null}
    </section>
  );
}
