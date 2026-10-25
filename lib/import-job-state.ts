import type { ImportValues } from "./import-matching.ts";

export type ImportRowStatus = { id: string; rowNumber: number; status: string; error: string | null; cardId: string | null };
export type ImportJobSummary = { id: string; kind: string; status: string; total: number; counts: Record<string, number> };
export type ImportJobPage = ImportJobSummary & { nextRow: number | null; rows: Array<ImportRowStatus & { values: ImportValues }> };
export type ImportJobDelta = ImportJobSummary & { delta: true; nextCursor: number | null; rows: ImportRowStatus[] };

/** Update visible rows without retransmitting input values or losing the detail cursor. */
export function mergeImportJobDelta(current: ImportJobPage | null, delta: ImportJobDelta): ImportJobPage | null {
  if (!current || current.id !== delta.id) return current;
  const changed = new Map(delta.rows.map(row => [row.id, row]));
  return { ...current, status: delta.status, total: delta.total, counts: delta.counts,
    rows: current.rows.map(row => changed.has(row.id) ? { ...row, ...changed.get(row.id)! } : row) };
}
