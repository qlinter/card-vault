import type { PortfolioFilterInput } from "./portfolio-analysis-scope.ts";
import type { PortfolioCardRecord } from "./portfolio-analysis-types.ts";
import type { buildReportingPortfolio } from "./portfolio-reporting.ts";
import { assessPortfolioCardQuality } from "./portfolio-quality.ts";
import { searchTerms } from "./search-terms.ts";
import { buildQueryHref } from "./query-params.ts";
import { minorMoneyToNumber } from "./financial-history.ts";

export const dataTabs = ["overview", "trends", "structure", "details"] as const;
export type DataTab = typeof dataTabs[number];
export const structureFields = ["playerName", "sport", "team", "brand", "year", "productLine", "gradingCompany", "collectionStatus"] as const;
export type StructureField = typeof structureFields[number];
export const cardAttributeFields = ["isRookie", "isAutograph", "isPatch", "isSerialNumbered"] as const;
export type CardAttributeField = typeof cardAttributeFields[number];
export type CardAttributeSummary = { count: number; quantity: number; value: number; valuedCount: number; soldCount: number };
export type DataIssue = { key: string; label: string; financial: boolean };
export type DataRow = {
  id: string; playerName: string; cardTitle: string; sport: string; team: string; brand: string; year: string; productLine: string; gradingCompany: string; collectionStatus: string;
  quantity: number; value: number | null; cost: number | null; realized: number | null; netSales: number | null; soldCost: number | null; returnRate: number | null; soldQuantity: number; soldAt: string | null; valuedAt: string | null; issues: DataIssue[];
};
export type DataWorkspace = {
  quantity: number; currency: string; top: DataRow[]; rows: DataRow[]; total: number; page: number; pages: number;
  issueCounts: Record<string, number>; qualityCount: number; physical: Record<string, Record<string, number>>;
  closed: Record<string, Record<string, number>>; attributes: Record<CardAttributeField, CardAttributeSummary>;
};

export function dataTab(value?: string): DataTab { return dataTabs.includes(value as DataTab) ? value as DataTab : "overview"; }
export function dataHref(query: PortfolioFilterInput, state: Record<string, string | undefined>, changes: Record<string, string | undefined> = {}) {
  return buildQueryHref("/portfolio", { ...query, ...state, ...changes, success: undefined, error: undefined });
}
export function profitTone(value: number | null): "positive" | "negative" | "neutral" {
  return value === null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";
}
export function valuationChangeAvailable(row: { baselineValuedCardCount: number; currentValuedCardCount: number }) {
  return row.baselineValuedCardCount > 0 && row.currentValuedCardCount > 0;
}
export function isClosedDataRow(row: Pick<DataRow, "quantity" | "soldQuantity" | "collectionStatus">) {
  return row.quantity === 0 && (row.soldQuantity > 0 || row.collectionStatus === "sold");
}
export function dataGroupCount(groups: DataWorkspace["physical"], field: StructureField, name: string): number {
  const values = groups[field];
  return values && Object.hasOwn(values, name) ? values[name] : 0;
}
function incrementGroup(groups: DataWorkspace["physical"], field: StructureField, name: string, amount: number) {
  const values = groups[field] ||= {};
  // User-entered names may match Object.prototype properties, including __proto__.
  Object.defineProperty(values, name, { value: dataGroupCount(groups, field, name) + amount, enumerable: true, writable: true, configurable: true });
}

export function selectDataRows(rows: DataRow[], params: Record<string, string | undefined>) {
  const terms = searchTerms((params.search || "").slice(0, 160)).map(term => term.toLocaleLowerCase());
  const field = structureFields.includes(params.dimension as StructureField) ? params.dimension as StructureField : undefined;
  const filtered = rows.filter(row => {
    if (params.kind === "quality" ? row.issues.length === 0 : params.kind === "sold" ? row.soldQuantity === 0 : params.kind !== "all" && row.quantity === 0) return false;
    if (params.closed === "1" && !isClosedDataRow(row)) return false;
    if (params.kind === "quality" && params.issue && !row.issues.some(issue => issue.key === params.issue || params.issue === "financial" && issue.financial || params.issue === "archive" && !issue.financial)) return false;
    if (field && (row[field].trim() || "未填写") !== params.item) return false;
    const text = [row.playerName, row.cardTitle, row.sport, row.team, row.brand, row.year, row.productLine, row.gradingCompany].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  const metric = params.order === "costDesc" ? "cost" : params.order === "profitDesc" ? "realized" : "value";
  filtered.sort((a, b) => params.order === "nameAsc" ? a.playerName.localeCompare(b.playerName) || a.id.localeCompare(b.id)
    : params.order === "dateDesc" ? (params.kind === "sold" ? b.soldAt || "" : b.valuedAt || "").localeCompare(params.kind === "sold" ? a.soldAt || "" : a.valuedAt || "") || a.id.localeCompare(b.id)
      : (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const parsed = Number(params.page);
  const page = Math.min(pages, Math.max(1, Number.isFinite(parsed) ? Math.floor(parsed) : 1));
  return { rows: filtered.slice((page - 1) * 20, page * 20), total: filtered.length, page, pages };
}

/** Reuse the financial pass; summary tabs retain aggregates and five positions only. */
export function createDataCollector(asOf = new Date(), { includeRows = true }: { includeRows?: boolean } = {}) {
  const rows: DataRow[] = [];
  const top: DataRow[] = [];
  const physical: DataWorkspace["physical"] = {};
  const closed: DataWorkspace["closed"] = {};
  const attributes = Object.fromEntries(cardAttributeFields.map(field => [field, { count: 0, quantity: 0, value: 0, valuedCount: 0, soldCount: 0 }])) as DataWorkspace["attributes"];
  const issueCounts: Record<string, number> = {};
  let quantity = 0, qualityCount = 0, count = 0, currency = "CNY";
  function add(reporting: ReturnType<typeof buildReportingPortfolio>, originals: PortfolioCardRecord[]) {
    currency = reporting.snapshot.accounting!.currency;
    for (const [index, card] of reporting.cards.entries()) {
      const original = originals[index];
      const fact = reporting.cardFacts.get(card)!;
      const position = fact.positions.find(item => item.currency === currency);
      const financial = [...new Set([...card.missing, ...(fact.quantity > 0 && !fact.valuation ? ["VALUATION"] : [])])];
      const assessment = assessPortfolioCardQuality({ playerName: original.playerName, cardTitle: original.cardTitle || "", sport: original.sport, imageCount: original.imageCount || 0, transactionCount: original.transactions.length, valuations: original.valuations }, asOf);
      const issues: DataIssue[] = financial.map(reason => ({ key: reason.startsWith("FX ") ? "missing_fx" : reason.startsWith("COST") ? "missing_cost" : "missing_valuation", label: reason.startsWith("FX ") ? "缺汇率" : reason.startsWith("COST") ? "缺成本记录" : "缺少估值", financial: true }));
      assessment.issueTypes.forEach((key, i) => {
        if (fact.quantity === 0 && ["missing_valuation", "stale_valuation"].includes(key)) return;
        if (!issues.some(issue => issue.key === key)) issues.push({ key, label: assessment.issues[i], financial: ["missing_valuation", "stale_valuation", "missing_transaction"].includes(key) });
      });
      const row: DataRow = {
        id: card.id!, playerName: card.playerName, cardTitle: card.cardTitle || "", sport: card.sport, team: card.team || "", brand: card.brand || "", year: card.year || "", productLine: card.productLine || "", gradingCompany: card.gradingCompany || "", collectionStatus: card.collectionStatus,
        quantity: fact.quantity, value: fact.quantity > 0 && fact.valuation ? fact.value : null,
        cost: position && position.costComplete && card.costMissing.length === 0 ? minorMoneyToNumber(position.remainingCostMinor, currency) : null,
        realized: position && position.profitComplete && card.costMissing.length === 0 ? minorMoneyToNumber(position.realizedProfitMinor, currency) : null,
        netSales: position && position.profitComplete && card.costMissing.length === 0 ? minorMoneyToNumber(position.netSaleAmountMinor, currency) : null,
        soldCost: position && position.costComplete && card.costMissing.length === 0 ? minorMoneyToNumber(position.realizedCostMinor, currency) : null,
        returnRate: position && position.profitComplete && card.costMissing.length === 0 && position.realizedCostMinor > 0n ? Number(position.realizedProfitMinor) / Number(position.realizedCostMinor) * 100 : null,
        soldQuantity: position?.soldQuantity || 0,
        soldAt: card.transactions.filter(item => item.kind === "sale").map(item => (item.occurredAt || item.createdAt)?.toISOString() || "").sort().at(-1) || null,
        valuedAt: fact.valuation?.valuedAt.toISOString() || null, issues: [...new Map(issues.map(issue => [issue.key, issue])).values()]
      };
      quantity += row.quantity;
      const sold = isClosedDataRow(row);
      for (const field of cardAttributeFields) {
        if (!original[field]) continue;
        const attribute = attributes[field];
        attribute.count++;
        attribute.quantity += row.quantity;
        if (sold) attribute.soldCount++;
        if (row.value !== null) { attribute.value += row.value; attribute.valuedCount++; }
      }
      for (const field of structureFields) {
        const name = row[field].trim() || "未填写";
        incrementGroup(physical, field, name, row.quantity);
        if (sold) incrementGroup(closed, field, name, 1);
      }
      if (row.issues.length) {
        qualityCount++;
        for (const issue of row.issues) issueCounts[issue.key] = (issueCounts[issue.key] || 0) + 1;
        for (const type of ["financial", "archive"]) if (row.issues.some(issue => issue.financial === (type === "financial"))) issueCounts[type] = (issueCounts[type] || 0) + 1;
      }
      count++;
      if (includeRows) rows.push(row);
      if (row.quantity > 0 && row.value !== null) {
        top.push(row);
        top.sort((a, b) => b.value! - a.value! || a.id.localeCompare(b.id));
        if (top.length > 5) top.pop();
      }
    }
  }
  function finish(params: Record<string, string | undefined>): DataWorkspace {
    return { quantity, currency, physical, closed, attributes, issueCounts, qualityCount, top: [...top],
      ...(includeRows ? selectDataRows(rows, params) : { rows: [], total: count, page: 1, pages: 1 }) };
  }
  return { add, finish };
}
