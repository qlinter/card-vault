import { normalizePortfolioFilterInput, type PortfolioFilterInput } from "./portfolio-analysis-scope.ts";

export type RecapSpec = { year: number; month?: number; basis: "purchase" | "entry"; scope: PortfolioFilterInput };
export type RecapCard = { id: string; playerName: string; cardTitle: string; sport: string; productLine: string | null; isAutograph: boolean; grade: string | null; collectionStatus: string; visibility: string; createdAt: Date; images: { id: string; path: string; rotation: number }[] };
export type RecapCandidate = { id: string; playerName: string; month: number };
export type RecapSummary = { quantity: number; cardCount: number; subjectCount: number; seriesCount: number; subjects: { name: string; count: number }[]; sports: { name: string; count: number }[]; series: { name: string; count: number }[]; autograph: number; graded: number; months: number[]; weeks: { start: number; end: number; count: number }[]; missingPurchases: number; asOf: string; inProgress: boolean; representatives: string[] };

/** The screen and exported image share metric order, labels, and counting rules. */
export function recapStats(spec: RecapSpec, summary: RecapSummary) {
  return [
    { label: spec.basis === "purchase" ? "购入张数" : "新增档案", value: summary.quantity },
    { label: "涉及档案", value: summary.cardCount },
    { label: "卡片主体", value: summary.subjectCount },
    { label: "产品线", value: summary.seriesCount },
    { label: "签名档案", value: summary.autograph },
    { label: "评级档案", value: summary.graded }
  ];
}

export function normalizeRecapSpec(value: unknown, now = new Date()): RecapSpec {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const year = raw.year === undefined || raw.year === "" ? now.getUTCFullYear() : Number(raw.year);
  const month = raw.month === undefined || raw.month === "" ? undefined : Number(raw.month);
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12))) throw new Error("回顾日期无效。");
  if (raw.basis !== undefined && raw.basis !== "purchase" && raw.basis !== "entry") throw new Error("回顾口径无效。");
  return { year, ...(month ? { month } : {}), basis: raw.basis === "entry" ? "entry" : "purchase", scope: normalizePortfolioFilterInput(raw.scope ?? {}) };
}

/** Purchase dates use the same UTC calendar dates as transaction entry. */
export function recapPeriod(spec: RecapSpec, now = new Date()) {
  const start = new Date(Date.UTC(spec.year, (spec.month ?? 1) - 1, 1));
  const end = new Date(Date.UTC(spec.year + (spec.month ? 0 : 1), spec.month ?? 0, 1));
  return { start, end: new Date(Math.min(end.getTime(), now.getTime() + 1)), inProgress: start <= now && end > now };
}

export function recapActivity(spec: RecapSpec, card: { createdAt: Date; transactions: { occurredAt: Date; quantity: number }[] }, now = new Date()) {
  const period = recapPeriod(spec, now);
  return (spec.basis === "entry" ? [{ occurredAt: card.createdAt, quantity: 1 }] : card.transactions).filter(event => event.occurredAt >= period.start && event.occurredAt < period.end);
}

export function recapQuery(spec: RecapSpec): string { return new URLSearchParams({ recapYear: String(spec.year), ...(spec.month ? { recapMonth: String(spec.month) } : {}), recapBasis: spec.basis, ...Object.fromEntries(Object.entries(spec.scope).filter((entry): entry is [string, string] => entry[1] !== undefined)) }).toString(); }

export function recapDefaultTitle(spec: Pick<RecapSpec, "year" | "month">, locale = "zh-CN") {
  if (locale === "en") return `${spec.month ? new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(spec.year, spec.month - 1, 1))) + " " : ""}${spec.year} Collection Recap`;
  return `${spec.year}年${spec.month ? `${spec.month}月` : ""}收藏回顾`;
}

export function representativeIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 6 || value.some(id => typeof id !== "string" || !id || id.length > 100) || new Set(value).size !== value.length) throw new Error("代表卡片最多选择六张，且不能重复。");
  return value as string[];
}

/** Keep a bounded, diverse set rather than retaining every card in memory. */
export function addRepresentative(pool: RecapCandidate[], candidate: RecapCandidate) {
  if (pool.some(item => item.id === candidate.id)) return;
  if (pool.filter(item => item.playerName === candidate.playerName && item.month === candidate.month).length < 6) pool.push(candidate);
  if (pool.length > 72) pool.splice(pool.findIndex(item => pool.filter(other => other.month === item.month).length > 6), 1);
}
export function chooseRepresentatives(pool: RecapCandidate[]): string[] {
  const selected: RecapCandidate[] = [];
  const rest = [...pool];
  while (rest.length && selected.length < 6) {
    rest.sort((a, b) => {
      const score = (item: RecapCandidate) => Number(!selected.some(row => row.playerName === item.playerName)) * 2 + Number(!selected.some(row => row.month === item.month));
      return score(b) - score(a);
    });
    selected.push(rest.shift()!);
  }
  return selected.map(item => item.id);
}

export function recapWeeks(spec: RecapSpec) {
  if (!spec.month) return [];
  const days = new Date(Date.UTC(spec.year, spec.month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(spec.year, spec.month - 1, 1)).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((days + offset) / 7) }, (_, index) => ({ start: Math.max(1, index * 7 - offset + 1), end: Math.min(days, (index + 1) * 7 - offset), count: 0 }));
}

export function recapChart(spec: RecapSpec, summary: RecapSummary) {
  return spec.month ? summary.weeks.map(week => ({ label: `${week.start}–${week.end}`, count: week.count })) : summary.months.map((count, index) => ({ label: String(index + 1), count }));
}

export function createRecapAccumulator(spec: RecapSpec, now = new Date()) {
  const summary: RecapSummary = { quantity: 0, cardCount: 0, subjectCount: 0, seriesCount: 0, subjects: [], sports: [], series: [], autograph: 0, graded: 0, months: Array(12).fill(0), weeks: recapWeeks(spec), missingPurchases: 0, asOf: now.toISOString(), inProgress: recapPeriod(spec, now).inProgress, representatives: [] };
  const subjects = new Map<string, number>(), sports = new Map<string, number>(), series = new Map<string, number>(), pool: RecapCandidate[] = [];
  const increment = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  return {
    add(card: Pick<RecapCard, "id" | "playerName" | "sport" | "productLine" | "isAutograph" | "grade" | "createdAt">, activity: { occurredAt: Date; quantity: number }[]) {
      const events = recapActivity(spec, { createdAt: card.createdAt, transactions: activity }, now);
      if (!events.length) return;
      summary.cardCount++;
      for (const event of events) { summary.quantity += event.quantity; summary.months[event.occurredAt.getUTCMonth()] += event.quantity; const week = summary.weeks.find(row => event.occurredAt.getUTCDate() >= row.start && event.occurredAt.getUTCDate() <= row.end); if (week) week.count += event.quantity; }
      summary.autograph += Number(card.isAutograph); summary.graded += Number(Boolean(card.grade));
      increment(subjects, card.playerName); increment(sports, card.sport); if (card.productLine) increment(series, card.productLine);
      addRepresentative(pool, { id: card.id, playerName: card.playerName, month: events[0].occurredAt.getUTCMonth() });
    },
    finish(missingPurchases = 0): RecapSummary {
      const top = (map: Map<string, number>) => [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
      return { ...summary, subjectCount: subjects.size, seriesCount: series.size, missingPurchases, subjects: top(subjects), sports: top(sports), series: top(series), representatives: chooseRepresentatives(pool) };
    }
  };
}
