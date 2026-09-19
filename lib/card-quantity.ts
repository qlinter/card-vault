import { normalizeCardCollectionStatus } from "./card-domain.ts";

export function defaultInitialQuantityForStatus(collectionStatus: string): number {
  return normalizeCardCollectionStatus(collectionStatus) === "sold" ? 0 : 1;
}

export function assertCollectionStatusQuantity(collectionStatus: string, quantity: number): void {
  const minimum = defaultInitialQuantityForStatus(collectionStatus);
  if (minimum === 0 && quantity !== 0) {
    throw new Error("已售卡片的持有数量必须为 0，请先在财务记录中登记出售。");
  }
  if (minimum === 1 && quantity < minimum) {
    throw new Error("持有、待送评、送评中或待售的卡片数量至少为 1，请先登记买入。");
  }
}

export function parseInitialCardQuantity(value: string, collectionStatus: string): number {
  const fallback = defaultInitialQuantityForStatus(collectionStatus);
  const quantity = Number(value.trim() || String(fallback));

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("初始数量必须是非负整数。");
  }
  assertCollectionStatusQuantity(collectionStatus, quantity);

  return quantity;
}
