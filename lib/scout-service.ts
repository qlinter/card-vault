import "server-only";
import { prisma } from "./prisma";
import { scoutAmount } from "./scout-domain";
import { optionalCardText, requiredCardText } from "./card-domain";
import { normalizeCurrency } from "./financial-history";
import { ensureScoutReady } from "./scout-ready";
export { loadScout, type ScoutData } from "./scout-read";

export async function mutateScout(body: Record<string, unknown>) {
  ensureScoutReady();
  if (body.action === "wish") {
    const allowed = new Set(["action", "id", "title", "playerName", "budget", "currency", "notes"]);
    if (Object.keys(body).some(key => !allowed.has(key)) || Object.values(body).some(value => value !== undefined && typeof value !== "string")) throw new Error("心愿设置无效。");
    const data = {
      title: requiredCardText(String(body.title ?? ""), "心愿名称"),
      playerName: optionalCardText(String(body.playerName ?? ""), "卡片主体", 500),
      budgetMinor: scoutAmount(body.budget),
      currency: normalizeCurrency(String(body.currency ?? "CNY")),
      notes: optionalCardText(String(body.notes ?? ""), "备注", 10000)
    };
    const plan = body.id
      ? await prisma.collectionPlan.update({ where: { id: requiredCardText(String(body.id), "ID") }, data })
      : await prisma.collectionPlan.create({ data });
    return { id: plan.id };
  }
  if (body.action === "wish-delete") {
    await prisma.collectionPlan.delete({ where: { id: requiredCardText(String(body.id ?? ""), "ID") } });
    return { ok: true };
  }
  throw new Error("操作无效。");
}
