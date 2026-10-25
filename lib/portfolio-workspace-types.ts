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
