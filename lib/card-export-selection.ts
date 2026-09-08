export function parseExportSelection(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const ids: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10000 || ids.some(id => typeof id !== "string" || !id.trim() || id.length > 128)) {
    throw new Error("请选择 1–10000 张有效卡片。 / Select 1–10000 valid cards.");
  }
  return [...new Set(ids as string[])];
}
