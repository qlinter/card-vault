import { createHash } from "node:crypto";
import type { ShareCollection, ShareCollectionItem, ShareSection } from "@prisma/client";
import { recordVersion } from "./record-version.ts";

type EditableShare = ShareCollection & { items: ShareCollectionItem[]; sections: ShareSection[] };
export const shareConflictMessage = "分享集已被其他操作修改，未覆盖最新内容。当前输入已保留，请重新打开编辑页核对后再保存。";
export function shareEditVersion(share: EditableShare): string {
  const { items, sections, ...fields } = share;
  // Exclude joined card data; editing the card itself does not alter the share's choices.
  const itemFields = items.map(({ id, shareCollectionId, cardId, sectionId, sortOrder, displayTitle, displayDescription }) => ({ id, shareCollectionId, cardId, sectionId, sortOrder, displayTitle, displayDescription })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(recordVersion({ ...fields, items: itemFields, sections: [...sections].sort((a, b) => a.id.localeCompare(b.id)) })).digest("hex");
}
export function assertShareVersion(share: EditableShare, expectedVersion: string) {
  if (!expectedVersion || shareEditVersion(share) !== expectedVersion) throw new Error(shareConflictMessage);
}
