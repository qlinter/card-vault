const entryFinanceFields = ["kind", "amount", "currency", "secondaryAmount", "amountUnknown", "quantity", "occurredAt", "source", "notes", "context", "transactionId", "vendor", "valuedAt"] as const;
export type EntryFinanceValues = Partial<Record<typeof entryFinanceFields[number], string>>;
export type EntryFinanceRecord = { id: string; type: "transaction" | "expense" | "valuation"; values: EntryFinanceValues };
export const maxEntryFinanceRecords = 50;

export function parseEntryFinance(value: string): EntryFinanceRecord[] {
  if (!value) return [];
  if (value.length > 80_000) throw new Error("财务记录内容过大。");
  let rows: unknown;
  try { rows = JSON.parse(value); } catch { throw new Error("财务记录格式无效。"); }
  if (!Array.isArray(rows) || rows.length > maxEntryFinanceRecords) throw new Error("每次录入最多添加 50 条财务记录。");
  const ids = new Set<string>();
  return rows.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || ids.has(row.id) || !["transaction", "expense", "valuation"].includes(row.type) || !row.values || typeof row.values !== "object" || Array.isArray(row.values)) throw new Error("财务记录格式无效。");
    ids.add(row.id);
    const values: EntryFinanceValues = {};
    for (const field of entryFinanceFields) {
      const raw = row.values[field];
      if (raw !== undefined && (typeof raw !== "string" || raw.length > 2000)) throw new Error("财务记录字段过长或格式无效。");
      if (typeof raw === "string") values[field] = raw;
    }
    return { id: row.id, type: row.type, values };
  });
}

export function readEntryFinance(form: FormData): string {
  // Flat, namespaced controls keep all records in the card form without nested forms.
  const records = form.getAll("financialRecordId").map(id => {
    const prefix = `finance.${String(id)}.`;
    const values: EntryFinanceValues = {};
    for (const field of entryFinanceFields) values[field] = String(form.get(prefix + field) ?? "");
    return { id, type: form.get(prefix + "type"), values };
  });
  return JSON.stringify(records);
}
