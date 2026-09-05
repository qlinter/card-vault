"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseFxRate } from "@/lib/financial-reporting";

type State = { error?: string; saved?: boolean };
const failure = (error: unknown): State => ({ error: error instanceof Error ? error.message : "Unable to save settings" });

export async function savePrimaryCurrency(_state: State, formData: FormData): Promise<State> {
  try {
    const currency = String(formData.get("reportingCurrency"));
    if (!["CNY", "USD"].includes(currency)) throw new Error("Invalid currency");
    await prisma.financialSettings.upsert({ where: { id: "default" }, create: { id: "default", reportingCurrency: currency }, update: { reportingCurrency: currency } });
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) { return failure(error); }
}

export async function saveExchangeRate(_state: State, formData: FormData): Promise<State> {
  try {
    const id = String(formData.get("id") ?? "");
    const rateMicros = parseFxRate(String(formData.get("rate") ?? ""));
    const day = String(formData.get("effectiveDate") ?? "");
    const source = String(formData.get("source") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error("请填写有效日期 / Enter a valid date");
    if (source.length > 200) throw new Error("说明不能超过 200 字 / Note must be at most 200 characters");
    await prisma.$transaction(async (tx) => {
      const existing = id ? await tx.exchangeRate.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new Error("汇率记录不存在 / Rate no longer exists");
      if (existing && existing.effectiveDate === day && existing.rateMicros === rateMicros && existing.source === source) return;
      const last = await tx.exchangeRate.findFirst({ where: { effectiveDate: day }, orderBy: { revision: "desc" } });
      const data = { effectiveDate: day, rateMicros, source, revision: (last?.revision ?? 0) + 1 };
      if (existing) await tx.exchangeRate.update({ where: { id }, data });
      else if (!last || last.rateMicros !== rateMicros || last.source !== source) await tx.exchangeRate.create({ data: { id: randomUUID(), ...data } });
    });
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) { return failure(error); }
}

export async function deleteExchangeRate(_state: State, formData: FormData): Promise<State> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Invalid rate");
    const result = await prisma.exchangeRate.deleteMany({ where: { id } });
    if (!result.count) throw new Error("汇率记录不存在 / Rate no longer exists");
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) { return failure(error); }
}
