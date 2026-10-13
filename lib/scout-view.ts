export type WishView = { page: number; cancelledPage: number; acquired: boolean; search: string; sort: string };
export const defaultWishView: WishView = { page: 1, cancelledPage: 1, acquired: false, search: "", sort: "priority" };
export function wishViewForTarget(rows: Array<{ id: string; status: string }>, size: number, id: string, view: WishView): WishView | null {
  const target = rows.find(row => row.id === id);
  if (!target) return null;
  const acquired = view.acquired || target.status === "acquired";
  const visible = rows.filter(row => target.status === "cancelled" ? row.status === "cancelled" : row.status === "planned" || (acquired && row.status === "acquired"));
  const page = Math.floor(visible.findIndex(row => row.id === id) / size) + 1;
  return { ...view, search: "", acquired, ...(target.status === "cancelled" ? { cancelledPage: page } : { page }) };
}
