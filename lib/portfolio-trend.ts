import type { PortfolioTimeSeriesPoint } from "./portfolio-analysis-types.ts";

export type PortfolioTrendRange = 12 | 24 | "all";

function monthOffset(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function monthSequence(firstMonth: string, lastMonth: string): string[] {
  const months: string[] = [];
  for (let month = firstMonth; month <= lastMonth; month = monthOffset(month, 1)) months.push(month);
  return months;
}

export function portfolioTrendMonths(
  timeSeries: Record<string, PortfolioTimeSeriesPoint[]>,
  range: PortfolioTrendRange,
  asOfMonth?: string
): string[] {
  const recordedMonths = [...new Set(Object.values(timeSeries).flatMap((points) => points.map((point) => point.month)))].sort();
  if (recordedMonths.length === 0) return [];

  const latestRecordedMonth = recordedMonths.at(-1) ?? recordedMonths[0];
  const lastMonth = asOfMonth && asOfMonth > latestRecordedMonth ? asOfMonth : latestRecordedMonth;
  const requestedFirst = range === "all" ? recordedMonths[0] : monthOffset(lastMonth, -(range - 1));
  const firstMonth = requestedFirst < recordedMonths[0] ? recordedMonths[0] : requestedFirst;
  return monthSequence(firstMonth, lastMonth);
}

export function portfolioTrendLabelIndexes(
  monthCount: number,
  chartWidth: number,
  minimumSpacing = 100
): number[] {
  if (monthCount <= 0) return [];
  if (monthCount === 1) return [0];

  const pointSpacing = chartWidth / (monthCount - 1);
  const step = Math.max(1, Math.ceil(minimumSpacing / pointSpacing));
  const indexes = [0];
  for (let index = step; index < monthCount - 1; index += step) indexes.push(index);

  const lastIndex = monthCount - 1;
  if (lastIndex - indexes[indexes.length - 1] < step * 0.75 && indexes.length > 1) indexes.pop();
  indexes.push(lastIndex);
  return indexes;
}

export function portfolioTrendChartWidth(monthCount: number, availableWidth: number): number {
  return Math.max(availableWidth, 120 + Math.max(0, monthCount - 1) * 14);
}
