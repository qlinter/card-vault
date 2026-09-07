import "server-only";
import { prisma } from "./prisma";
import { homeCardInclude } from "./card-query-shapes";
import { loadFinancialSettings } from "./financial-settings";
import { reportingHistory } from "./financial-reporting";
import { calculateCurrencyPosition } from "./position-accounting";

let rebuilding: Promise<void> | null = null;
async function rebuild() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const meta = await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
    const day = new Date().toISOString().slice(0, 10);
    if (meta.revision === meta.projectionRevision && meta.projectionDay === day) return;
    const config = await loadFinancialSettings();
    const reports: Array<{ cardId: string; currency: string; remainingCostMinor: bigint | null; valueMinor: bigint | null; quantity: number }> = [];
    let cursor: string | undefined;
    for (;;) {
      const cards = await prisma.card.findMany({ take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: { id: "asc" }, include: homeCardInclude });
      for (const card of cards) {
        const history = reportingHistory({ ...card, holdingQuantity: ["sold", "target"].includes(card.collectionStatus) ? 0 : card.holdingQuantity }, config);
        const position = calculateCurrencyPosition(history, config.reportingCurrency);
        reports.push({ cardId: card.id, currency: config.reportingCurrency, quantity: position.remainingQuantity, remainingCostMinor: position.costComplete ? position.remainingCostMinor : null, valueMinor: position.remainingQuantity > 0 ? position.currentValueMinor : null });
      }
      if (cards.length < 250) break;
      cursor = cards.at(-1)!.id;
    }
    const committed = await prisma.$transaction(async (tx) => {
      const current = await tx.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
      if (current.revision !== meta.revision) return false;
      await tx.cardReport.deleteMany();
      for (let offset = 0; offset < reports.length; offset += 250) await tx.cardReport.createMany({ data: reports.slice(offset, offset + 250) });
      await tx.dataRevision.update({ where: { id: 1 }, data: { projectionRevision: meta.revision, projectionDay: day } });
      return true;
    }, { timeout: 30000 });
    if (committed) return;
  }
  throw new Error("收藏数据正在连续变化，请稍后刷新。");
}

export async function ensureCardReports() {
  if (!rebuilding) rebuilding = rebuild().finally(() => { rebuilding = null; });
  return rebuilding;
}
