export type TaskCard = {
  id: string; playerName: string; cardTitle: string; collectionStatus: string;
  updatedAt: Date; createdAt: Date; _count: { images: number; transactions: number };
  valuations: Array<{ valuedAt: Date }>; hasUnknownPurchase?: boolean;
  tracking?: { statusStartedAt: Date; statusDateEstimated: boolean; statusRevision: number; imagesRevision: number; purchaseRevision: number; valuationRevision: number } | null;
};
export type CollectionTask = { id: string; cardId: string; playerName: string; cardTitle: string; kind: "images" | "purchase" | "valuation" | "stale" | "grading" | "listed"; fingerprint: string; days: number; state?: string; dateEstimated?: boolean };
export function deriveCollectionTasks(cards: TaskCard[], now = new Date()): CollectionTask[] {
  const tasks: CollectionTask[] = [];
  const nowTime = now.getTime();
  const age = (date: Date) => Math.max(0, Math.floor((nowTime - date.getTime()) / 86400000));
  for (const card of cards) {
    const add = (kind: CollectionTask["kind"], date: Date) => {
      const revisionKey = kind === "images" ? "imagesRevision" : kind === "purchase" ? "purchaseRevision" : ["valuation", "stale"].includes(kind) ? "valuationRevision" : "statusRevision";
      const revision = card.tracking?.[revisionKey] ?? 0;
      tasks.push({ id: `${card.id}:${kind}`, cardId: card.id, playerName: card.playerName, cardTitle: card.cardTitle, kind, days: age(date), fingerprint: `${kind}:${date.toISOString()}${revision ? `:${revision}` : ""}`, dateEstimated: ["grading", "listed"].includes(kind) && (card.tracking?.statusDateEstimated ?? true) });
    };
    if (!card._count.images) add("images", card.createdAt);
    if (["holding", "listed", "grading"].includes(card.collectionStatus)) {
      if (!card._count.transactions || card.hasUnknownPurchase) add("purchase", card.createdAt);
      let latest: { valuedAt: Date } | undefined;
      let latestTime = -Infinity;
      for (const row of card.valuations) {
        const time = row.valuedAt.getTime();
        if (time <= nowTime && time > latestTime) { latest = row; latestTime = time; }
      }
      if (!latest) add("valuation", card.createdAt);
      else if (age(latest.valuedAt) >= 180) add("stale", latest.valuedAt);
    }
    const statusStartedAt = card.tracking?.statusStartedAt ?? card.updatedAt;
    if (card.collectionStatus === "grading" && age(statusStartedAt) >= 180) add("grading", statusStartedAt);
    if (card.collectionStatus === "listed" && age(statusStartedAt) >= 180) add("listed", statusStartedAt);
  }
  return tasks.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
}
export function taskIsVisible(task: CollectionTask, state: { fingerprint: string; status: string; snoozedUntil: Date | null } | undefined, now = new Date()) {
  if (!state || state.fingerprint !== task.fingerprint || state.status === "open") return true;
  return state.status === "snoozed" && (!state.snoozedUntil || state.snoozedUntil <= now);
}
