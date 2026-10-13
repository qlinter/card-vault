import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { exportFromSnapshot } from "./export-workspace";
import { bufferedFile } from "./streaming-xlsx.js";
import { encodeCsv } from "./tabular-data.js";

export async function exportScout(kind: string, requestSignal: AbortSignal) {
  if (kind !== "keywords" && kind !== "wishes") throw new Error("导出类型无效。");
  return exportFromSnapshot(async ({ directory, snapshot, signal }) => {
    const db = new DatabaseSync(snapshot, { readOnly: true });
    try {
      const output = path.join(directory, "scout.csv"), file = await bufferedFile(output, signal);
      const headers = kind === "keywords" ? ["id", "keyword", "linkedWishes", "createdAt"] : ["id", "title", "subject", "status", "priority", "budgetMinor", "currency", "targetDate", "targetCount", "boundCount", "boundCardIds", "keywords", "notes"];
      const rows = db.prepare(kind === "keywords" ? "SELECT * FROM ScoutWatch WHERE id > ? ORDER BY id LIMIT 250" : "SELECT p.*, d.priority, d.targetCount FROM CollectionPlan p LEFT JOIN ScoutWishDetails d ON d.planId=p.id WHERE p.id > ? ORDER BY p.id LIMIT 250");
      const links = db.prepare(kind === "keywords" ? "SELECT p.title FROM ScoutWishWatch l JOIN CollectionPlan p ON p.id=l.planId WHERE l.watchId=? ORDER BY p.id" : "SELECT w.title FROM ScoutWishWatch l JOIN ScoutWatch w ON w.id=l.watchId WHERE l.planId=? ORDER BY w.id");
      const cards = db.prepare("SELECT cardId FROM ScoutWishCard WHERE planId=? ORDER BY cardId");
      try {
        await file.append(encodeCsv([headers]));
        let cursor = "";
        for (;;) {
          signal.throwIfAborted();
          const batch = rows.all(cursor);
          for (const row of batch) {
            const linked = links.all(row.id).map(link => link.title);
            const ids = kind === "wishes" ? cards.all(row.id).map(link => link.cardId) : [];
            const values = kind === "keywords" ? [row.id, row.title, JSON.stringify(linked), row.createdAt] : [row.id, row.title, row.playerName, row.status, row.priority ?? 2, row.budgetMinor, row.currency, row.targetDate, row.targetCount, ids.length, JSON.stringify(ids), JSON.stringify(linked), row.notes];
            await file.append("\r\n" + encodeCsv([values]).slice(1));
          }
          if (batch.length < 250) break;
          cursor = String(batch.at(-1)!.id);
          await new Promise<void>(resolve => setImmediate(resolve));
        }
        await file.close();
      } catch (error) { await file.abort().catch(() => {}); throw error; }
      return output;
    } finally { db.close(); }
  }, requestSignal);
}
