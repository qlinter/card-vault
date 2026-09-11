"use client";

import { UiText, UiElement } from "@/components/ui-text";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useState } from "react";
import { paymentComponents, type FinancialConfig } from "@/lib/financial-reporting";
import { saveFinancialRecordFormAction, deleteFinancialRecordAction } from "@/app/actions/financial-history";
import { ExpenseForm, TransactionForm, ValuationForm } from "@/components/financial-history-forms";
import { FinancialPositionOverview } from "@/components/financial-position-overview";
import { formatMinorMoney } from "@/lib/financial-history";
import {
  expenseContextLabels,
  expenseKindLabels,
  formatHistoryDateInput,
  formatHistoryDateLabel,
  transactionLabels
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
};

type TimelineItem =
  | { type: "transaction"; date: Date; record: CardTransaction }
  | { type: "expense"; date: Date; record: CardExpense }
  | { type: "valuation"; date: Date; record: CardValuation };

type RecordType = TimelineItem["type"];
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
  return item.record.source;
}

function AddRecord({ cardId, returnTo, transactions, isOpen, onClose }: { cardId: string; returnTo?: string; transactions: CardTransaction[]; isOpen: boolean; onClose: () => void }) {
  const [recordType, setRecordType] = useState<RecordType>("transaction");
  const addTransaction = saveFinancialRecordFormAction.bind(null, cardId, "transaction", null, returnTo);
  const addExpense = saveFinancialRecordFormAction.bind(null, cardId, "expense", null, returnTo);
  const addValuation = saveFinancialRecordFormAction.bind(null, cardId, "valuation", null, returnTo);
  return (
    <div className="financial-add-record" id="financial-add-record" hidden={!isOpen}>
      <div className="financial-add-record-heading">
        <strong><UiText text={"新增财务记录"} /></strong>
        <button type="button" className="btn btn-secondary" onClick={onClose}><UiText text={"收起"} /></button>
      </div>
      <div className="financial-record-composer">
        <UiElement as="div" uiAttributes={["aria-label"]} className="financial-record-tabs" role="tablist" aria-label="新增财务记录类型">
          {(["transaction", "expense", "valuation"] as const).map((type) => (
            <button key={type} type="button" role="tab" aria-selected={recordType === type} onClick={() => setRecordType(type)}><UiText text={filterLabels[type]} /></button>
          ))}
        </UiElement>
        <div hidden={recordType !== "transaction"}><TransactionForm action={addTransaction} submitLabel="保存交易" /></div>
        <div hidden={recordType !== "expense"}><ExpenseForm action={addExpense} submitLabel="保存费用" transactions={transactions} /></div>
        <div hidden={recordType !== "valuation"}><ValuationForm action={addValuation} submitLabel="保存估值" /></div>
      </div>
    </div>
  );
}

function TimelineRecord({ cardId, item, returnTo, transactions }: { cardId: string; item: TimelineItem; returnTo?: string; transactions: CardTransaction[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const record = item.record;
  const editorId = `financial-edit-${item.type}-${record.id}`;
  const updateAction = saveFinancialRecordFormAction.bind(null, cardId, item.type, record.id, returnTo);
  const deleteAction = deleteFinancialRecordAction.bind(null, cardId, item.type, record.id, returnTo);
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
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const timeline: TimelineItem[] = [
    ...props.transactions.map((record) => ({ type: "transaction" as const, date: record.occurredAt, record })),
    ...props.expenses.map((record) => ({ type: "expense" as const, date: record.occurredAt, record })),
    ...props.valuations.map((record) => ({ type: "valuation" as const, date: record.valuedAt, record }))
  ].sort((left, right) => right.date.getTime() - left.date.getTime());
  const visibleTimeline = filter === "all" ? timeline : timeline.filter((item) => item.type === filter);
  const counts: Record<HistoryFilter, number> = {
    all: timeline.length,
    transaction: props.transactions.length,
    expense: props.expenses.length,
    valuation: props.valuations.length
  };

  return (
    <section className="panel financial-history" id="financial-history">
      <div className="financial-history-heading">
        <div><h2><UiText text={"财务历史"} /></h2></div>
        <div className="financial-history-actions">
          <span className="financial-history-count">{timeline.length}<UiText text={" 条记录"} /></span>
          <button
            type="button"
            className="btn btn-primary financial-add-trigger"
            aria-expanded={isAddingRecord}
            aria-controls="financial-add-record"
            onClick={() => setIsAddingRecord((open) => !open)}
          ><UiText text={"＋ 新增记录"} /></button>
        </div>
      </div>
      <AddRecord cardId={props.cardId} returnTo={props.returnTo} transactions={props.transactions} isOpen={isAddingRecord} onClose={() => setIsAddingRecord(false)} />
      <FinancialPositionOverview transactions={props.transactions} expenses={props.expenses} valuations={props.valuations} config={props.config} holdingQuantity={props.holdingQuantity} collectionStatus={props.collectionStatus} />
      <div className="financial-timeline">
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
      </div>
    </section>
  );
}
