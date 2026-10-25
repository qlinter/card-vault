export type ScoutQuery = { keyword: string };
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
