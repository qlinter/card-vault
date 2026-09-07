export type TaskCard = { id: string; playerName: string; cardTitle: string; collectionStatus: string; updatedAt: Date; createdAt: Date; _count: { images: number; transactions: number }; valuations: Array<{ valuedAt: Date }> };
export type CollectionTask = { id: string; cardId: string; playerName: string; cardTitle: string; kind: "images" | "purchase" | "valuation" | "stale" | "grading" | "listed"; fingerprint: string; days: number; state?: string };
export function deriveCollectionTasks(cards: TaskCard[], now = new Date()): CollectionTask[] {
  const tasks: CollectionTask[] = [];
  const age = (date: Date) => Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
  for (const card of cards) {
    const add = (kind: CollectionTask["kind"], date: Date) => tasks.push({ id: `${card.id}:${kind}`, cardId: card.id, playerName: card.playerName, cardTitle: card.cardTitle, kind, days: age(date), fingerprint: `${kind}:${date.toISOString()}` });
    if (!card._count.images) add("images", card.createdAt);
    if (["holding", "listed", "grading"].includes(card.collectionStatus)) {
      if (!card._count.transactions) add("purchase", card.createdAt);
      const latest = card.valuations.filter(row => row.valuedAt <= now).sort((a, b) => b.valuedAt.getTime() - a.valuedAt.getTime())[0];
      if (!latest) add("valuation", card.createdAt);
      else if (age(latest.valuedAt) >= 180) add("stale", latest.valuedAt);
    }
    if (card.collectionStatus === "grading" && age(card.updatedAt) >= 180) add("grading", card.updatedAt);
    if (card.collectionStatus === "listed" && age(card.updatedAt) >= 180) add("listed", card.updatedAt);
  }
  return tasks.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
}
export function taskIsVisible(task: CollectionTask, state: { fingerprint: string; status: string; snoozedUntil: Date | null } | undefined, now = new Date()) {
  if (!state || state.fingerprint !== task.fingerprint || state.status === "open") return true;
  return state.status === "snoozed" && (!state.snoozedUntil || state.snoozedUntil <= now);
}
