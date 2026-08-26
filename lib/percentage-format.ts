type PercentageFormatOptions = {
  fractionDigits?: 0 | 1 | 2;
  signed?: boolean;
  fallback?: string;
};

export function formatPercentage(value: number | null, options: PercentageFormatOptions = {}): string {
  if (value === null || !Number.isFinite(value)) return options.fallback ?? "—";
  const fractionDigits = options.fractionDigits;
  const absoluteValue = options.signed ? Math.abs(value) : value;
  const formatted = absoluteValue.toLocaleString("zh-CN", {
    useGrouping: false,
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 2
  });
  const sign = options.signed ? value > 0 ? "+" : value < 0 ? "−" : "" : "";
  return `${sign}${formatted}%`;
}
