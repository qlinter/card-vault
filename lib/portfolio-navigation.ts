import type { PortfolioFilterInput } from "./portfolio-analysis-scope.ts";
import type { CardAttributeField, DataWorkspace, StructureField } from "./portfolio-workspace-types.ts";
import { buildQueryHref } from "./query-params.ts";

export const dataTabs = ["overview", "trends", "structure", "details"] as const;
export type DataTab = typeof dataTabs[number];

export function dataTab(value?: string): DataTab { return dataTabs.includes(value as DataTab) ? value as DataTab : "overview"; }
export function dataHref(query: PortfolioFilterInput, state: Record<string, string | undefined>, changes: Record<string, string | undefined> = {}) {
  return buildQueryHref("/portfolio", { ...query, ...state, ...changes, success: undefined, error: undefined });
}
export function attributeDrillQuery(query: PortfolioFilterInput, field: CardAttributeField): PortfolioFilterInput | null {
  return query[field] === "false" ? null : { ...query, [field]: "true" };
}
export function profitTone(value: number | null): "positive" | "negative" | "neutral" {
  return value === null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";
}
export function valuationChangeAvailable(row: { baselineValuedCardCount: number; currentValuedCardCount: number }) {
  return row.baselineValuedCardCount > 0 && row.currentValuedCardCount > 0;
}
export function dataGroupCount(groups: DataWorkspace["physical"], field: StructureField, name: string): number {
  const values = groups[field];
  return values && Object.hasOwn(values, name) ? values[name] : 0;
}
