import { createHash } from "node:crypto";
import type { Card, CardImage, Prisma } from "@prisma/client";
import { recordVersion } from "./record-version.ts";

export const cardEditConflictMessage = "卡片资料或图片已在其他操作中更新，未覆盖最新内容。当前输入已保留，请重新打开编辑页核对后再保存。";

/** The existing primary key makes retries atomic without changing the database format. */
export function cardIdForSubmission(submissionId: string, draftId?: string, queueItemId?: string): string {
  const identity = queueItemId ? ["queue", queueItemId] : draftId ? ["draft", draftId] : ["submission", submissionId];
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(identity[1])) throw new Error("录入提交标识无效，请重新打开录入页。");
  return "entry_" + createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

type Archive = Card & { images: CardImage[] };
export function cardEditVersions(card: Archive) {
  // Financial writes update updatedAt and quantity independently of the archive form.
  const archive = Object.fromEntries(Object.entries(card).filter(([key]) => !["images", "createdAt", "updatedAt", "holdingQuantity"].includes(key)));
  const pictureState = card.images.map(({ id, path, rotation }) => ({ id, path, rotation })).sort((a, b) => a.id.localeCompare(b.id));
  const hash = (values: object) => createHash("sha256").update(JSON.stringify([Object.entries(values).sort(([a], [b]) => a.localeCompare(b)), pictureState])).digest("hex");
  const withoutStatus = Object.fromEntries(Object.entries(archive).filter(([key]) => key !== "collectionStatus"));
  return { version: hash(archive), archiveVersion: hash(withoutStatus) };
}

export function assertCardEditVersion(card: Archive, expectedVersion: string) {
  if (cardEditVersions(card).version !== expectedVersion) throw new Error(cardEditConflictMessage);
}

export const cardDeleteConflictMessage = "卡片资料、图片、财务或关联记录已发生变化，未执行删除。请核对最新内容后重新确认。";
export const cardDeleteInclude = {
  images: true, transactions: true, expenses: true, valuations: true,
  shareItems: true, acquiredWishes: true, tracking: true
} satisfies Prisma.CardInclude;

type DeletableCard = Prisma.CardGetPayload<{ include: typeof cardDeleteInclude }>;

/** Deletion removes dependent facts too; the confirmation must cover all of them. */
export function cardDeleteVersion(card: DeletableCard): string {
  const { images, transactions, expenses, valuations, shareItems, acquiredWishes, ...archive } = card;
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(recordVersion({
    ...archive,
    images: byId(images), transactions: byId(transactions), expenses: byId(expenses),
    valuations: byId(valuations), shareItems: byId(shareItems),
    acquiredWishes: [...acquiredWishes].sort((a, b) => a.planId.localeCompare(b.planId))
  })).digest("hex");
}

export function assertCardDeleteVersion(card: DeletableCard, expectedVersion: string) {
  if (!expectedVersion || cardDeleteVersion(card) !== expectedVersion) throw new Error(cardDeleteConflictMessage);
}
