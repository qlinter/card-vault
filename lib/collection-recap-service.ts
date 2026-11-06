import "server-only";
import { Prisma } from "@prisma/client";
import { setImmediate as yieldToRequests } from "node:timers/promises";
import { prisma } from "./prisma";
import { buildCardFilters } from "./card-helpers";
import { createRecapAccumulator, normalizeRecapSpec, recapActivity, representativeIds, type RecapSpec } from "./collection-recap";

export const recapCardSelect = { id: true, playerName: true, cardTitle: true, sport: true, productLine: true, isAutograph: true, grade: true, collectionStatus: true, visibility: true, createdAt: true,
  images: { take: 1, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, path: true, rotation: true } } } satisfies Prisma.CardSelect;

export function recapWhere(spec: RecapSpec, includePrivate = true): Prisma.CardWhereInput {
  return { AND: [buildCardFilters(spec.scope), ...(includePrivate ? [] : [{ visibility: { not: "private" } }])] };
}

// Existing supported SQLite files contain both ISO text and epoch timestamps.
// Prisma decodes both to Date; comparing dates after decoding avoids SQLite's
// storage-class ordering excluding one of those formats from a date predicate.
export async function* recapBatches(spec: RecapSpec, includePrivate = true) {
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.card.findMany({ where: { AND: [recapWhere(spec, includePrivate), ...(cursor ? [{ id: { gt: cursor } }] : [])] }, orderBy: { id: "asc" }, take: 250,
      select: { ...recapCardSelect, images: false, transactions: { where: { kind: "purchase" }, select: { occurredAt: true, quantity: true } } } });
    yield batch;
    if (batch.length < 250) break;
    cursor = batch.at(-1)!.id; await yieldToRequests();
  }
}

export async function loadRecapSummary(spec: RecapSpec, includePrivate = true, now = new Date()) {
  const accumulator = createRecapAccumulator(spec, now);
  // A repeat purchase counts its recorded quantity, while each archive is counted once.
  // Read in stable ID batches and select only dates/quantities, never money or private notes.
  let missing = 0;
  for await (const batch of recapBatches(spec, includePrivate)) for (const card of batch) {
    accumulator.add(card, card.transactions);
    if (!card.transactions.length) missing++;
  }
  return accumulator.finish(spec.basis === "purchase" ? missing : 0);
}

export async function recapCards(spec: RecapSpec, options: { includePrivate?: boolean; page?: number; ids?: string[]; q?: string } = {}) {
  if (options.ids?.length === 0) return [];
  const ids: string[] = [], skip = (options.page ?? 0) * 24;
  let matched = 0;
  for await (const batch of recapBatches(spec, options.includePrivate ?? true)) {
    for (const card of batch) {
      if (!recapActivity(spec, card).length || (options.ids && !options.ids.includes(card.id)) || (options.q && !`${card.playerName} ${card.cardTitle}`.toLocaleLowerCase().includes(options.q.toLocaleLowerCase()))) continue;
      if (options.ids || matched++ >= skip) ids.push(card.id);
      if (ids.length >= (options.ids ? options.ids.length : 24)) break;
    }
    if (ids.length >= (options.ids ? options.ids.length : 24)) break;
  }
  if (!ids.length) return [];
  const cards = await prisma.card.findMany({ where: { id: { in: ids } }, select: recapCardSelect });
  return ids.flatMap(id => { const card = cards.find(row => row.id === id); return card ? [card] : []; });
}

export function recapDraft(value: Record<string, unknown>) {
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 100) throw new Error("标题限 100 字。");
  return { spec: normalizeRecapSpec(value.spec), title: value.title.trim(), ids: representativeIds(value.representativeIds) };
}

