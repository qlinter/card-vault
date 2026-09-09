import "server-only";
import { PrismaClient, type Prisma, type Card } from "@prisma/client";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "./prisma";
import { importFields } from "./data-center-fields";
import { buildCardFilters } from "./card-helpers";
import { encodeCsv } from "./tabular-data.js";
import { formatMinorMoney } from "./financial-history";
import { bufferedFile, writeStreamingXlsx } from "./streaming-xlsx.js";
import { snapshotExportDatabase } from "./export-database-snapshot.js";

const initialFinancialFields = new Set(["initialQuantity", "purchasePrice", "purchaseDate", "currentValue", "historyCurrency", "valuationDate", "valuationSource"]);
const ledgerHeaders = ["cardId", "recordId", "type", "kind", "amount", "currency", "quantity", "date", "source", "amountKnown", "secondaryPayments", "context", "notes", "amountMinor", "transactionId", "provenance", "externalKey", "createdAt", "updatedAt"];
const pageSize = 250;
let activeExports = 0;

async function* cardRows(client: PrismaClient, where: Prisma.CardWhereInput, fields: string[], signal: AbortSignal) {
  let cursor: string | undefined;
  for (;;) {
    signal.throwIfAborted();
    const cards = await client.card.findMany({ where: { AND: [where, ...(cursor ? [{ id: { gt: cursor } }] : [])] }, orderBy: { id: "asc" }, take: pageSize });
    for (const card of cards) yield fields.map(field => String(card[field as keyof Card] ?? ""));
    if (cards.length < pageSize) return;
    cursor = cards.at(-1)!.id;
  }
}

type LedgerRecord = Prisma.CardTransactionGetPayload<object> | Prisma.CardExpenseGetPayload<object> | Prisma.CardValuationGetPayload<object>;
async function* ledgerRecords(client: PrismaClient, where: Prisma.CardWhereInput, type: "transactions" | "expenses" | "valuations", signal: AbortSignal): AsyncGenerator<{ type: typeof type; record: LedgerRecord }> {
  let cursor: { cardId: string; id: string } | undefined;
  for (;;) {
    signal.throwIfAborted();
    const args = { where: { card: where, ...(cursor ? { cardId: { gte: cursor.cardId }, OR: [{ cardId: { gt: cursor.cardId } }, { cardId: cursor.cardId, id: { gt: cursor.id } }] } : {}) }, orderBy: [{ cardId: "asc" as const }, { id: "asc" as const }], take: pageSize };
    const records: LedgerRecord[] = type === "transactions" ? await client.cardTransaction.findMany(args) : type === "expenses" ? await client.cardExpense.findMany(args) : await client.cardValuation.findMany(args);
    for (const record of records) yield { type, record };
    if (records.length < pageSize) return;
    cursor = records.at(-1)!;
  }
}
async function* ledgerRows(client: PrismaClient, where: Prisma.CardWhereInput, signal: AbortSignal) {
  const streams = (["transactions", "expenses", "valuations"] as const).map(type => ledgerRecords(client, where, type, signal));
  const heads = await Promise.all(streams.map(stream => stream.next()));
  try {
    for (;;) {
      let chosen = -1;
      for (let i = 0; i < heads.length; i++) {
        if (!heads[i].done && (chosen < 0 || heads[i].value!.record.cardId < heads[chosen].value!.record.cardId)) chosen = i;
      }
      if (chosen < 0) return;
      const { type, record } = heads[chosen].value!;
      yield [record.cardId, record.id, type, "kind" in record ? record.kind : "valuation",
        formatMinorMoney(record.amountMinor, record.currency), record.currency, "quantity" in record ? record.quantity : "",
        ("occurredAt" in record ? record.occurredAt : record.valuedAt).toISOString(), "source" in record ? record.source : record.vendor,
        "amountKnown" in record ? record.amountKnown : "", "paymentsJson" in record ? record.paymentsJson : "", "context" in record ? record.context : "",
        record.notes, record.amountMinor.toString(), "transactionId" in record ? record.transactionId : "", record.provenance, record.externalKey,
        record.createdAt.toISOString(), record.updatedAt.toISOString()];
      heads[chosen] = await streams[chosen].next();
    }
  } finally { await Promise.all(streams.map(stream => stream.return(undefined))); }
}

export async function exportCards(query: Parameters<typeof buildCardFilters>[0], format: string, publicOnly: boolean, selectedIds?: string[], requestSignal?: AbortSignal) {
  if (format !== "csv" && format !== "xlsx") throw new Error("请选择 CSV 或 XLSX 导出格式。");
  if (activeExports >= 2) throw new Error("已有两个导出任务，请等待完成后重试。");
  activeExports++;
  let directory: string | undefined, client: PrismaClient | undefined;
  let cleanupPromise: Promise<void> | undefined;
  const cleanup = () => cleanupPromise ??= (async () => {
    try { if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    finally { activeExports--; }
  })();
  try {
    const signal = requestSignal ? AbortSignal.any([requestSignal, AbortSignal.timeout(600000)]) : AbortSignal.timeout(600000);
    signal.throwIfAborted();
    directory = await mkdtemp(path.join(tmpdir(), "card-vault-export-"));
    const databases = await prisma.$queryRaw<Array<{ name: string; file: string }>>`PRAGMA database_list`;
    const sourcePath = databases.find(db => db.name === "main")?.file;
    if (!sourcePath) throw new Error("无法定位收藏数据库。");
    const snapshot = path.join(directory, "snapshot.db");
    await snapshotExportDatabase(sourcePath, snapshot, signal);
    client = new PrismaClient({ datasources: { db: { url: `file:${snapshot.replaceAll("\\", "/")}` } } });
    const where: Prisma.CardWhereInput = { AND: [buildCardFilters(query), ...(selectedIds ? [{ id: { in: selectedIds } }] : []), ...(publicOnly ? [{ visibility: "public" }] : [])] };
    const fields = Object.keys(importFields).filter(field => !initialFinancialFields.has(field) && !(publicOnly && field === "notes"));
    let output: string;
    if (format === "csv") {
      output = path.join(directory, "export.csv");
      const file = await bufferedFile(output, signal);
      try {
        await file.append(encodeCsv([fields]));
        for await (const row of cardRows(client, where, fields, signal)) await file.append("\r\n" + encodeCsv([row]).slice(1));
        await file.close();
      } catch (error) { await file.abort().catch(() => {}); throw error; }
    } else {
      const sheets: Array<{ name: string; headers: string[]; rows: AsyncIterable<unknown[]> }> = [{ name: "Cards", headers: fields, rows: cardRows(client, where, fields, signal) }];
      if (!publicOnly) sheets.push({ name: "Financial history", headers: ledgerHeaders, rows: ledgerRows(client, where, signal) });
      output = await writeStreamingXlsx(directory, sheets, signal);
    }
    await client.$disconnect(); client = undefined;
    signal.throwIfAborted();
    const size = (await stat(output)).size;
    const stream = createReadStream(output, { highWaterMark: 65536 });
    const abort = () => stream.destroy(new Error("导出下载已取消。"));
    requestSignal?.addEventListener("abort", abort, { once: true });
    stream.once("close", () => { requestSignal?.removeEventListener("abort", abort); void cleanup().catch(error => console.error("Export temporary-file cleanup failed", error)); });
    const body = Readable.toWeb(stream, { strategy: { highWaterMark: 65536, size: chunk => chunk.byteLength } }) as ReadableStream<Uint8Array>;
    if (requestSignal?.aborted) abort();
    return { body, size, type: format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: format };
  } catch (error) {
    if (client) await client.$disconnect().catch(() => {});
    await cleanup();
    throw error;
  }
}
