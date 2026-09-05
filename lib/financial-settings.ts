import "server-only";
import { prisma } from "./prisma";
import type { FinancialConfig } from "./financial-reporting.ts";

export async function loadFinancialSettings(): Promise<FinancialConfig> {
  const [settings, rates] = await Promise.all([
    prisma.financialSettings.findUnique({ where: { id: "default" } }),
    prisma.exchangeRate.findMany({ orderBy: [{ effectiveDate: "desc" }, { revision: "desc" }] })
  ]);
  return { reportingCurrency: settings?.reportingCurrency ?? "CNY", rates };
}
