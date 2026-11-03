/** Stable content versions also detect writes that share the same millisecond. */
export function recordVersion(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]));
    return item;
  };
  return JSON.stringify(normalize(value));
}

export const financialConflictMessage = "这条财务记录已被其他操作修改，未覆盖最新内容。当前输入已保留，请重新打开卡片核对后再保存。";

export function assertFinancialVersion(record: unknown, expectedVersion: string) {
  if (!record || !expectedVersion || recordVersion(record) !== expectedVersion) throw new Error(financialConflictMessage);
}
