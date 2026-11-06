import Link from "next/link";
import { normalizeRecapSpec } from "@/lib/collection-recap";
import { normalizePortfolioFilterInput } from "@/lib/portfolio-analysis-scope";
import { loadRecapSummary, recapCards } from "@/lib/collection-recap-service";
import { CollectionRecapEditor } from "@/components/collection-recap-editor";
import { UiText } from "@/components/ui-text";
import { toScalar } from "@/lib/query-params";

export const dynamic = "force-dynamic";
export default async function RecapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, toScalar(value)]));
  async function load() {
    const spec = normalizeRecapSpec({ year: params.recapYear, month: params.recapMonth, basis: params.recapBasis, scope: normalizePortfolioFilterInput(params) });
    const [summary, cards] = await Promise.all([loadRecapSummary(spec), recapCards(spec)]);
    const wanted = summary.representatives;
    const representatives = await recapCards(spec, { ids: wanted });
    const ordered = wanted.flatMap(id => { const card = representatives.find(row => row.id === id); return card ? [card] : []; });
    return { spec, summary, cards, representatives: ordered };
  }
  let initial;
  try { initial = await load(); }
  catch { return <div className="page"><p role="alert"><UiText text="无法读取回顾，请检查日期和筛选条件。" /></p><Link href="/portfolio/recap"><UiText text="新建回顾" /></Link></div>; }
  return <CollectionRecapEditor key={JSON.stringify(initial.spec)} initial={initial} />;
}
