import { structureFields, type StructureField, type DataRow } from "./portfolio-workspace-types.ts";
import { searchTerms } from "./search-terms.ts";
import { cardCollectionStatuses } from "./card-domain.ts";

export function portfolioDetailStatus(params: Record<string, string | undefined>): string {
  const statuses = ["all", "holdings", "sales", ...cardCollectionStatuses];
  if (params.detailStatus && statuses.includes(params.detailStatus)) return params.detailStatus;
  return params.kind === "holdings" ? "holdings" : params.kind === "sold" ? "sales" : "all";
}

export function isClosedDataRow(row: Pick<DataRow, "quantity" | "soldQuantity" | "collectionStatus">) {
  return row.quantity === 0 && (row.soldQuantity > 0 || row.collectionStatus === "sold");
}
function sortedDataRows(rows: DataRow[], params: Record<string, string | undefined>) {
  if (params.kind === "quality") return rows.filter(row => row.issues.length > 0).sort((a, b) => a.playerName.localeCompare(b.playerName) || a.id.localeCompare(b.id));
  const terms = searchTerms((params.search || "").slice(0, 160)).map(term => term.toLocaleLowerCase());
  const status = portfolioDetailStatus(params);
  const field = structureFields.includes(params.dimension as StructureField) ? params.dimension as StructureField : undefined;
  const filtered = rows.filter(row => {
    if (status === "holdings" ? row.quantity === 0 : status === "sales" ? row.soldQuantity === 0 : status !== "all" && row.collectionStatus !== status) return false;
    if (params.closed === "1" && !isClosedDataRow(row)) return false;
    if (field && (row[field].trim() || "未填写") !== params.item) return false;
    const text = [row.playerName, row.cardTitle, row.sport, row.team, row.brand, row.year, row.productLine, row.gradingCompany].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  const metric = params.order === "costDesc" ? "cost" : params.order === "profitDesc" ? "realized" : "value";
  filtered.sort((a, b) => params.order === "nameAsc" ? a.playerName.localeCompare(b.playerName) || a.id.localeCompare(b.id)
    : params.order === "dateDesc" ? [b.soldAt || "", b.valuedAt || ""].sort().at(-1)!.localeCompare([a.soldAt || "", a.valuedAt || ""].sort().at(-1)!) || a.id.localeCompare(b.id)
      : (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity) || a.id.localeCompare(b.id));
  return filtered;
}

function dataPage(rows: DataRow[], params: Record<string, string | undefined>) {
  if (params.kind === "quality") return { rows, total: rows.length, page: 1, pages: 1 };
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const parsed = Number(params.page);
  const page = Math.min(pages, Math.max(1, Number.isFinite(parsed) ? Math.floor(parsed) : 1));
  return { rows: rows.slice((page - 1) * 20, page * 20), total: rows.length, page, pages };
}


export function selectDataRows(rows: DataRow[], params: Record<string, string | undefined>) { return dataPage(sortedDataRows(rows, params), params); }

export function createDataRowSelector(rows: DataRow[]) {
  const selections = new Map<string, DataRow[]>();
  return (params: Record<string, string | undefined>) => {
    const key = JSON.stringify(params.kind === "quality" ? ["quality"] : [portfolioDetailStatus(params), params.search, params.order, params.dimension, params.item, params.closed]);
    let selected = selections.get(key);
    if (!selected) {
      selected = sortedDataRows(rows, params);
      if (selections.size >= 4) selections.delete(selections.keys().next().value!);
      selections.set(key, selected);
    }
    return dataPage(selected, params);
  };
}
