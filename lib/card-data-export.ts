import "server-only";
import ExcelJS from "exceljs";
import type { Card } from "@prisma/client";
import { prisma } from "./prisma";
import { importFields } from "./data-center-fields";
import { buildCardFilters } from "./card-helpers";
import { encodeCsv } from "./tabular-data.js";
import { formatMinorMoney } from "./financial-history";

const initialFinancialFields = new Set(["initialQuantity", "purchasePrice", "purchaseDate", "currentValue", "historyCurrency", "valuationDate", "valuationSource"]);
const ledgerHeaders = ["cardId", "recordId", "type", "kind", "amount", "currency", "quantity", "date", "source", "amountKnown", "secondaryPayments", "context", "notes", "amountMinor", "transactionId", "provenance", "externalKey", "createdAt", "updatedAt"];

export async function exportCards(query: Parameters<typeof buildCardFilters>[0], format: string, publicOnly: boolean) {
  if (format !== "csv" && format !== "xlsx") throw new Error("请选择 CSV 或 XLSX 导出格式。");
  const fields = Object.keys(importFields).filter(field => !initialFinancialFields.has(field) && !(publicOnly && field === "notes"));
  const rows: string[][] = [fields];
  const book = format === "xlsx" ? new ExcelJS.Workbook() : null;
  const sheet = book?.addWorksheet("Cards");
  const ledger = !publicOnly ? book?.addWorksheet("Financial history") : undefined;
  ledger?.addRow(ledgerHeaders);
  let cursor: string | undefined;
  for (;;) {
    // Archive-only exports do not load financial facts, images or share references.
    const cards = await prisma.card.findMany({
      where: { AND: [buildCardFilters(query), ...(publicOnly ? [{ visibility: "public" }] : [])] },
      include: { transactions: Boolean(ledger), expenses: Boolean(ledger), valuations: Boolean(ledger) },
      orderBy: { id: "asc" }, take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    for (const card of cards) {
      rows.push(fields.map(field => String(card[field as keyof Card] ?? "")));
      if (!ledger) continue;
      for (const type of ["transactions", "expenses", "valuations"] as const) {
        for (const record of [...card[type]].sort((a, b) => a.id.localeCompare(b.id))) {
          ledger.addRow([
            card.id, record.id, type, "kind" in record ? record.kind : "valuation",
            formatMinorMoney(record.amountMinor, record.currency), record.currency,
            "quantity" in record ? record.quantity : "",
            ("occurredAt" in record ? record.occurredAt : record.valuedAt).toISOString(),
            "source" in record ? record.source : record.vendor,
            "amountKnown" in record ? record.amountKnown : "",
            "paymentsJson" in record ? record.paymentsJson : "",
            "context" in record ? record.context : "", record.notes, record.amountMinor.toString(),
            "transactionId" in record ? record.transactionId : "", record.provenance,
            record.externalKey, record.createdAt.toISOString(), record.updatedAt.toISOString()
          ]);
        }
      }
    }
    if (cards.length < 250) break;
    cursor = cards.at(-1)!.id;
  }
  if (!book) return { bytes: Buffer.from(encodeCsv(rows)), type: "text/csv; charset=utf-8", extension: "csv" };
  sheet!.addRows(rows);
  for (const worksheet of book.worksheets) {
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.columns.forEach(column => { column.width = 22; });
  }
  return { bytes: Buffer.from(await book.xlsx.writeBuffer()), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" };
}
