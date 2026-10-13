export type ScoutQuery = { keyword: string };
export type ScoutOwnedCard = { id: string; playerName: string; cardTitle: string; details: string; imagePath: string | null; imageRotation: number; certNumber: string | null };
export type ScoutOwnedCardsPage = { cards: ScoutOwnedCard[]; totalCount: number; page: number; pageSize: number };
export type WishUndo = { id: string; status: string; cardIds: string[]; revision: string };
export function scoutTargetCount(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("目标数量须为 1 至 500 的整数。");
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error("目标数量须为 1 至 500 的整数。");
  return count;
}
export function wishProgressStatus(count: number, target: number | null): "planned" | "acquired" {
  return target !== null && count < target ? "planned" : "acquired";
}
export function scoutCardIds(value: unknown, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > 500 || value.some(id => typeof id !== "string" || !id.trim() || id.length > 160)) throw new Error("请选择有效的入藏卡片，最多 500 张。");
  if (new Set(value).size !== value.length) throw new Error("入藏卡片不能重复选择。");
  return [...value].sort();
}
export const emptyScoutQuery: ScoutQuery = { keyword: "" };
export function normalizeScoutQuery(input: unknown): ScoutQuery {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("查询条件无效。");
  const keyword = (input as Record<string, unknown>).keyword;
  if (keyword !== undefined && typeof keyword !== "string") throw new Error("查询条件无效。");
  const query = { keyword: String(keyword ?? "").trim().replace(/\s+/g, " ") };
  if (query.keyword.length > 500) throw new Error("查询关键词过长。");
  return query;
}
export const scoutSearchText = (query: ScoutQuery) => query.keyword;
export const scoutMoneyInput = (minor: string | null) => minor === null ? "" : String(BigInt(minor) / 100n) + "." + (BigInt(minor) % 100n).toString().padStart(2, "0");
export function scoutLinks(query: ScoutQuery) {
  const keyword = query.keyword.trim();
  return [
    { source: "cardhobby", label: "卡淘", href: "https://www.cardhobby.com.cn/market/search?" + new URLSearchParams({ keyword, searchtype: "1" }) },
    { source: "ebay", label: "eBay", href: "https://www.ebay.com/sch/i.html?" + new URLSearchParams({ _nkw: keyword }) },
    { source: "130pt", label: "130 Point", href: "https://130point.com/sales/" }
  ];
}
export function scoutAmount(value: unknown): bigint | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value.trim())) throw new Error("金额需为非负数，最多两位小数。");
  const [major, minor = ""] = value.trim().split(".");
  return BigInt(major) * 100n + BigInt(minor.padEnd(2, "0"));
}
