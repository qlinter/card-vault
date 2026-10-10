import assert from "node:assert/strict";
import test from "node:test";
import { parseEntryFinance, readEntryFinance } from "../lib/card-entry-finance.ts";
import { normalizeCardFormValues, readCardFormValues, serializeCardEntryDraftValues, parseCardEntryDraftValues } from "../lib/card-entry-domain.ts";
import { transactionInput, expenseInput, valuationInput } from "../lib/financial-history-input.ts";

test("additional finance survives form extraction and draft round trips without mixing initial fields", () => {
  const form = new FormData();
  form.set("purchasePrice", "300");
  form.append("financialRecordId", "sale-1");
  for (const [key,value] of Object.entries({type:"transaction",kind:"sale",amount:"200",currency:"USD",quantity:"1",occurredAt:"2026-09-01",notes:"sale notes"})) form.set("finance.sale-1."+key,value);
  const values=readCardFormValues(form);
  const restored=parseCardEntryDraftValues(serializeCardEntryDraftValues(values));
  assert.equal(restored.purchasePrice,"300");
  const records=parseEntryFinance(restored.financialRecords);
  assert.equal(records[0].values.currency,"USD");
  assert.equal(records[0].values.notes,"sale notes");
  assert.equal(readEntryFinance(new FormData()),"[]");
  assert.deepEqual(parseEntryFinance(normalizeCardFormValues({}).financialRecords),[]);
});

test("additional finance rejects malformed, duplicate and oversized record payloads", () => {
  const row={id:"row-1",type:"transaction",values:{}};
  assert.throws(()=>parseEntryFinance(JSON.stringify([row,row])));
  assert.throws(()=>parseEntryFinance(JSON.stringify([{...row,type:"delete"}])));
  assert.throws(()=>parseEntryFinance(JSON.stringify([{...row,values:{amount:1}}])));
  assert.throws(()=>parseEntryFinance(JSON.stringify([{...row,values:[]}])) , /财务记录格式无效/);
  assert.throws(()=>parseEntryFinance("{broken"), /财务记录格式无效/);
  assert.throws(()=>parseEntryFinance(JSON.stringify(Array.from({length:51},(_,i)=>({...row,id:`row-${i}`})))));
  assert.throws(()=>parseEntryFinance(" ".repeat(80001)));
});

test("retired incomplete-amount flags cannot survive draft recovery or change transaction accounting", () => {
  const legacy = { id: "buy-1", type: "transaction", values: { kind: "purchase", amount: "0", currency: "CNY", quantity: "1", occurredAt: "2026-10-01", amountUnknown: "on" } };
  const [record] = parseEntryFinance(JSON.stringify([legacy]));
  assert.equal("amountUnknown" in record.values, false);

  const form = new FormData();
  form.append("financialRecordId", legacy.id);
  form.set("finance.buy-1.type", legacy.type);
  for (const [key, value] of Object.entries(legacy.values)) form.set("finance.buy-1." + key, value);
  const [submitted] = JSON.parse(readEntryFinance(form));
  assert.equal("amountUnknown" in submitted.values, false);

  const transaction = new FormData();
  for (const [key, value] of Object.entries(legacy.values)) transaction.set(key, value);
  assert.equal(transactionInput(transaction).amountKnown, true);
  assert.equal(transactionInput(transaction).amount, "0");
  transaction.set("amount", "125");
  assert.equal(transactionInput(transaction).amountKnown, true);
  transaction.set("amount", "");
  assert.throws(() => transactionInput(transaction), /金额不能为空/);
});

test("entry finance requires real dates, quantities and valuation sources", () => {
  const form=new FormData();
  for(const [key,value] of Object.entries({kind:"purchase",amount:"10",currency:"CNY",quantity:"1",occurredAt:"2026-02-30"})) form.set(key,value);
  assert.throws(()=>transactionInput(form),/日期/);
  form.set("occurredAt","2026-02-28");
  form.set("quantity","1.5");
  assert.throws(()=>transactionInput(form),/数量/);
  form.set("quantity","2");
  assert.equal(transactionInput(form).quantity,2);
  form.set("secondaryAmount","5");
  assert.throws(()=>transactionInput(form),/只能填写一种币种/);
  form.delete("secondaryAmount");
  form.set("context","sale");form.set("transactionId","sale-1");
  assert.equal(expenseInput(form).transactionId,"sale-1");
  form.set("valuedAt","2026-03-01");
  assert.throws(()=>valuationInput(form),/来源/);
});
