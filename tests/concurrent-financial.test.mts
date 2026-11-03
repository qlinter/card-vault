import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { updateCardTransaction, updateCardExpense, updateCardValuation, deleteCardFinancialRecord } from "../lib/financial-history-store.ts";
import { recordVersion } from "../lib/record-version.ts";
const { initializeDatabase } = createRequire(import.meta.url)("../scripts/database-schema.js");

for (const type of ["transaction", "expense", "valuation"] as const) test(`${type} rejects stale saves and deletes, including equal timestamps`, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-finance-conflict-")), dbPath = path.join(root, "test.db");
  initializeDatabase(dbPath);
  const client = new PrismaClient({ datasources: { db: { url: "file:" + dbPath.replaceAll("\\", "/") } } });
  t.after(async () => { await client.$disconnect(); fs.rmSync(root, { recursive: true, force: true }); });
  await client.card.create({ data: { id: "card", playerName: "Test", cardTitle: "Test", sport: "Test" } });
  const shared = { id: "record", cardId: "card", amountMinor: 10000n, currency: "CNY", provenance: "test", notes: "original" };
  const date = new Date("2026-01-01T00:00:00Z");
  if (type === "transaction") await client.cardTransaction.create({ data: { ...shared, kind: "purchase", occurredAt: date } });
  if (type === "expense") await client.cardExpense.create({ data: { ...shared, kind: "grading", context: "grading", occurredAt: date } });
  if (type === "valuation") await client.cardValuation.create({ data: { ...shared, source: "个人估计", valuedAt: date } });
  const model = type === "transaction" ? "CardTransaction" : type === "expense" ? "CardExpense" : "CardValuation";
  await client.$executeRawUnsafe(`UPDATE ${model} SET createdAt='2026-01-01 00:00:00', updatedAt='2026-01-01 00:00:00' WHERE id='record'`);
  const read = async () => type === "transaction" ? client.cardTransaction.findUniqueOrThrow({ where: { id: "record" } }) : type === "expense" ? client.cardExpense.findUniqueOrThrow({ where: { id: "record" } }) : client.cardValuation.findUniqueOrThrow({ where: { id: "record" } });
  const save = (amount: string, notes: string, version: string) => client.$transaction(tx => {
    const input = { amount, currency: "CNY", notes };
    if (type === "transaction") return updateCardTransaction(tx, "card", "record", { ...input, kind: "purchase", quantity: 1, occurredAt: date }, version);
    if (type === "expense") return updateCardExpense(tx, "card", "record", { ...input, kind: "grading", context: "grading", occurredAt: date }, version);
    return updateCardValuation(tx, "card", "record", { ...input, source: "个人估计", valuedAt: date }, version);
  });
  const original = await read(), staleVersion = recordVersion(original);
  await save("200", "first editor", staleVersion);
  // Content checks must still work if timestamp precision cannot distinguish edits.
  await client.$executeRawUnsafe(`UPDATE ${model} SET updatedAt=? WHERE id='record'`, original.updatedAt);
  for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(save("100", "stale note", staleVersion), /未覆盖最新内容/);
  await assert.rejects(client.$transaction(tx => deleteCardFinancialRecord(tx, "card", type, "record", staleVersion)), /未覆盖最新内容/);
  const latest = await read(); assert.equal(latest.amountMinor, 20000n); assert.equal(latest.notes, "first editor");
  const concurrent = await Promise.allSettled([save("300", "concurrent A", recordVersion(latest)), save("400", "concurrent B", recordVersion(latest))]);
  assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 1);
  const fresh = await read();
  await client.$transaction(tx => deleteCardFinancialRecord(tx, "card", type, "record", recordVersion(fresh)));
  await assert.rejects(read());
});
