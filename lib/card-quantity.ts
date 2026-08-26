const ZERO_QUANTITY_STATUSES = new Set(["sold", "target"]);

export function defaultInitialQuantityForStatus(collectionStatus: string): number {
  return ZERO_QUANTITY_STATUSES.has(collectionStatus) ? 0 : 1;
}

export function parseInitialCardQuantity(value: string, collectionStatus: string): number {
  const fallback = defaultInitialQuantityForStatus(collectionStatus);
  const quantity = Number(value.trim() || String(fallback));

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("初始数量必须是非负整数。");
  }
  if (fallback === 1 && quantity < 1) {
    throw new Error("持有、在售或送评中的卡片初始数量至少为 1。");
  }

  return quantity;
}
