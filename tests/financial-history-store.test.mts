import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createCardExpense,
  createCardTransaction,
  createCardValuation
} from "../lib/financial-history-store.ts";

function captureClient() {
  const calls: Array<{ model: string; data: Record<string, unknown> }> = [];
  const create = (model: string) => async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ model, data });
    return data;
  };
  const client = {
    cardTransaction: { create: create("transaction") },
    cardExpense: { create: create("expense") },
    cardValuation: { create: create("valuation") }
  } as unknown as PrismaClient;
  return { client, calls };
}

test("history store writes normalized transaction and expense facts", async () => {
  const { client, calls } = captureClient();
  await createCardTransaction(client, {
    cardId: "card-1",
    kind: "purchase",
    amount: "1,234.50",
    currency: "cny",
    occurredAt: new Date("2025-01-02T00:00:00.000Z"),
    source: "  dealer  "
  });
  await createCardExpense(client, {
    cardId: "card-1",
    kind: "grading",
    amount: "12.34",
    currency: "USD",
    occurredAt: new Date("2025-01-03T00:00:00.000Z")
  });

  assert.equal(calls[0].data.amountMinor, BigInt(123450));
  assert.equal(calls[0].data.currency, "CNY");
  assert.equal(calls[0].data.source, "dealer");
  assert.equal(calls[0].data.provenance, "manual");
  assert.equal(calls[1].data.amountMinor, BigInt(1234));
  assert.equal(calls[1].data.currency, "USD");
});

test("history store rejects invalid quantity and source-free valuations", async () => {
  const { client } = captureClient();
  await assert.rejects(
    createCardTransaction(client, {
      cardId: "card-1",
      kind: "purchase",
      amount: "1",
      quantity: 0,
      occurredAt: new Date()
    }),
    /正整数/
  );
  await assert.rejects(
    createCardValuation(client, {
      cardId: "card-1",
      amount: "100",
      valuedAt: new Date(),
      source: "   "
    }),
    /估值来源必须选择/
  );
});

test("history store writes traceable valuations", async () => {
  const { client, calls } = captureClient();
  await createCardValuation(client, {
    cardId: "card-1",
    amount: "998",
    currency: "USD",
    valuedAt: new Date("2025-02-01T00:00:00.000Z"),
    source: "近期成交",
    provenance: "manual_review",
    externalKey: "valuation-import-1"
  });

  assert.equal(calls[0].data.amountMinor, BigInt(99800));
  assert.equal(calls[0].data.source, "近期成交");
  assert.equal(calls[0].data.provenance, "manual_review");
  assert.equal(calls[0].data.externalKey, "valuation-import-1");
});
