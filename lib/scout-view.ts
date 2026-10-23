export type WishView = { page: number; cancelledPage: number; acquired: boolean; search: string; sort: string };
export const defaultWishView: WishView = { page: 1, cancelledPage: 1, acquired: false, search: "", sort: "priority" };
export function scoutScrollPositions(raw: string | null): Record<"query" | "wishlist", number> {
  const positions = { query: 0, wishlist: 0 };
  try {
    const value: unknown = raw && raw.length < 2048 ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return positions;
    for (const key of ["query", "wishlist"] as const) {
      const top = (value as Record<string, unknown>)[key];
      if (typeof top === "number" && Number.isFinite(top) && top >= 0) positions[key] = top;
    }
  } catch { /* Corrupt or unavailable session data starts at the top. */ }
  return positions;
}
type WishReference = { id: string; status: string; priority?: number; createdAt?: string; targetDate?: string | null };
export function wishViewForTarget(rows: WishReference[], size: number, id: string, view: WishView): WishView | null {
  const target = rows.find(row => row.id === id);
  if (!target) return null;
  const acquired = view.acquired || target.status === "acquired";
  const recent = (a: WishReference, b: WishReference) => a.createdAt && b.createdAt ? Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : 0;
  const ordered = [...rows].sort((a, b) => (view.sort === "recent" ? 0 : view.sort === "target" ? (a.targetDate ? Date.parse(a.targetDate) : Infinity) - (b.targetDate ? Date.parse(b.targetDate) : Infinity) || 0 : (a.priority ?? 2) - (b.priority ?? 2)) || recent(a, b));
  const visible = ordered.filter(row => target.status === "cancelled" ? row.status === "cancelled" : row.status === "planned" || (acquired && row.status === "acquired"));
  const page = Math.floor(visible.findIndex(row => row.id === id) / size) + 1;
  return { ...view, search: "", acquired, ...(target.status === "cancelled" ? { cancelledPage: page } : { page }) };
}
