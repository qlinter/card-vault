import { normalizeCardCollectionStatus } from "./card-domain.ts";

export const lastAcquisitionMessage = "这条流水是当前持仓的唯一来源，请修改取得方式或数量。如需移除整张卡牌，请删除档案。";
export const closedStatusMessage = "清仓状态由最后一笔转出流水决定，请在财务历史中更正卖出或赠送记录。";

export function defaultInitialQuantityForStatus(collectionStatus: string): number {
  return ["sold","gifted"].includes(normalizeCardCollectionStatus(collectionStatus)) ? 0 : 1;
}

export function assertCollectionStatusQuantity(collectionStatus: string, quantity: number): void {
  const minimum = defaultInitialQuantityForStatus(collectionStatus);
  if (minimum === 0 && quantity !== 0) {
    if (collectionStatus === "gifted") throw new Error("已赠出卡牌的持有数量必须为 0，请先登记赠送。");
    throw new Error("已售卡牌的持有数量必须为 0，请先在财务记录中登记出售。");
  }
  if (minimum === 1 && quantity < minimum) {
    throw new Error("持有、待送评、送评中或待售的卡牌数量至少为 1，请先登记买入。");
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
