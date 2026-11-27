// Date inputs store calendar days as UTC midnight, independently of the device timezone.
export function localBusinessDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function storedBusinessDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Current reports include today's date-only records even before UTC midnight.
export function currentFinancialCutoff(now = new Date()): Date {
  const start = localBusinessDay(now).getTime();
  return new Date(Math.max(start, Math.min(start + 86_399_999, now.getTime())));
}

export function transactionDate(date: Date, today = localBusinessDay()): Date {
  const day = storedBusinessDay(date);
  if (!Number.isFinite(day)) throw new Error("交易日期无效。");
  if (day > today.getTime()) throw new Error("交易日期不能晚于今天。");
  return new Date(day);
}
