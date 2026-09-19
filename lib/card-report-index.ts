import { isOwnedCollectionStatus } from "./card-stats";
import "server-only";
import { prisma } from "./prisma";
import { financialCardSelect } from "./card-query-shapes";
import { loadFinancialSettings } from "./financial-settings";
import { reportingHistory } from "./financial-reporting";
import { calculateCurrencyPosition } from "./position-accounting";

let rebuilding: Promise<void> | null = null;
async function rebuild() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const meta = await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (meta.revision === meta.projectionRevision && meta.projectionDay === day) return;
    if (meta.projectionDay !== day) {
      // Refresh business events entering the cutoff; backwards clocks refresh all.
      if (!meta.projectionDay || meta.projectionDay > day) {
        await prisma.$executeRaw`INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card`;
      } else {
        const start = new Date(`${meta.projectionDay}T00:00:00Z`).getTime();
        const end = now.getTime();
        await prisma.$executeRaw`INSERT OR IGNORE INTO CardReportDirty
          SELECT cardId FROM CardTransaction WHERE CASE WHEN typeof(occurredAt)='integer' THEN occurredAt ELSE CAST(strftime('%s',occurredAt) AS INTEGER)*1000 END BETWEEN ${start} AND ${end}
          UNION SELECT cardId FROM CardExpense WHERE CASE WHEN typeof(occurredAt)='integer' THEN occurredAt ELSE CAST(strftime('%s',occurredAt) AS INTEGER)*1000 END BETWEEN ${start} AND ${end}
          UNION SELECT cardId FROM CardValuation WHERE CASE WHEN typeof(valuedAt)='integer' THEN valuedAt ELSE CAST(strftime('%s',valuedAt) AS INTEGER)*1000 END BETWEEN ${start} AND ${end}`;
      }
    }
    const config = await loadFinancialSettings();
    let changed = false;
    for (;;) {
      const pending = await prisma.cardReportDirty.findMany({ take: 250, orderBy: { cardId: "asc" }, include: { card: { select: financialCardSelect } } });
      if (!pending.length) break;
      const reports = pending.map(({ card }) => {
        const history = reportingHistory({ ...card, holdingQuantity: !isOwnedCollectionStatus(card.collectionStatus) ? 0 : card.holdingQuantity }, config, now);
        const position = calculateCurrencyPosition(history, config.reportingCurrency);
        return { cardId: card.id, currency: config.reportingCurrency, quantity: position.remainingQuantity, remainingCostMinor: position.costComplete ? position.remainingCostMinor : null, valueMinor: position.remainingQuantity > 0 ? position.currentValueMinor : null };
      });
      const ids = reports.map(row => row.cardId);
      const committed = await prisma.$transaction(async tx => {
        const current = await tx.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
        if (current.revision !== meta.revision) return false;
        await tx.cardReport.deleteMany({ where: { cardId: { in: ids } } });
        await tx.cardReport.createMany({ data: reports });
        await tx.cardReportDirty.deleteMany({ where: { cardId: { in: ids } } });
        return true;
      }, { timeout: 30000 });
      if (!committed) { changed = true; break; }
    }
    if (changed) continue;
    const finished = await prisma.$transaction(async tx => {
      const current = await tx.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
      if (current.revision !== meta.revision || await tx.cardReportDirty.count() > 0) return false;
      await tx.dataRevision.update({ where: { id: 1 }, data: { projectionRevision: meta.revision, projectionDay: day } });
      return true;
    });
    if (finished) return;
  }
  throw new Error("收藏数据正在连续变化，请稍后刷新。");
}

export async function ensureCardReports() {
  if (!rebuilding) rebuilding = rebuild().finally(() => { rebuilding = null; });
  return rebuilding;
}
