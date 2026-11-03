import { createHash } from "node:crypto";
import type { Card, CardImage } from "@prisma/client";

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
