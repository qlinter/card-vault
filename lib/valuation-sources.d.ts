export const valuationSources: readonly ["个人估计", "卡淘", "eBay", "Others"];
export const valuationSourceLabels: Readonly<Record<typeof valuationSources[number], string>>;
export function canonicalValuationSource(source: string): string;
