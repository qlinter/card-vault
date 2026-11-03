import Link from "next/link";
import { Suspense } from "react";
import { RefreshPageButton } from "@/components/page-recovery";
import { UiText } from "@/components/ui-text";
import { PortfolioAnalysisButton } from "@/components/portfolio-analysis";
import { PortfolioOverview } from "@/components/portfolio-overview";
import { PortfolioDataDetails } from "@/components/portfolio-data-details";
import { PortfolioStructureView } from "@/components/portfolio-structure-view";
import { PortfolioFinancialHistorySection, PortfolioActivityTrendSection } from "@/components/portfolio-center-trends";
import { PortfolioValuationChanges } from "@/components/portfolio-valuation-changes";
import { PortfolioDataTabs } from "@/components/portfolio-data-tabs";
import { PortfolioCriterion } from "@/components/portfolio-criterion";
import { HomeOverview } from "@/components/home-overview";
import { errorMessage } from "@/lib/feedback-messages";
import { buildPortfolioScope, normalizePortfolioFilterInput, type PortfolioFilterInput } from "@/lib/portfolio-analysis";
import { type PortfolioSnapshotResult } from "@/lib/portfolio-snapshot-service";
import { loadPortfolioData } from "@/lib/portfolio-data-service";
import { dataHref, dataTab } from "@/lib/portfolio-navigation";
import type { DataWorkspace } from "@/lib/portfolio-workspace-types";
import { normalizePortfolioWorkspaceState } from "@/lib/portfolio-workspace-state";
import { buildQueryHref, toScalar } from "@/lib/query-params";
import styles from "@/components/portfolio-data.module.css";
import { ensurePortfolioReady } from "@/lib/portfolio-ready";

type State = Record<string, string | undefined>;
type Loaded = { result: PortfolioSnapshotResult; workspace: DataWorkspace };

async function DataBody({ pending, query, state }: { pending: Promise<Loaded>; query: PortfolioFilterInput; state: State }) {
  let loaded: Loaded | undefined, failure = "";
  try { loaded = await pending; } catch (error) { failure = errorMessage(error, "数据加载失败，请重试。"); }
  if (!loaded) return <section className={styles.panel}><p role="alert" className="note-error"><UiText text={failure} /></p><RefreshPageButton /></section>;
  const { result, workspace } = loaded;
  const tab = dataTab(state.tab), returnTo = dataHref(query, state);
  if (result.snapshot.cardCount === 0) return <section className={styles.panel}><h2><UiText text="还没有可汇总的收藏" /></h2><Link href={buildQueryHref("/cards/new", { returnTo })}><UiText text="新增卡片" /></Link></section>;
  if (tab === "details") return <PortfolioDataDetails workspace={workspace} query={query} state={state} returnTo={returnTo} />;
  if (tab === "structure") return <PortfolioStructureView snapshot={result.snapshot} physical={workspace.physical} closed={workspace.closed} attributes={workspace.attributes} query={query} state={state} />;
  if (tab === "trends") return <div className={styles.stack} data-testid="data-trends">
    <PortfolioFinancialHistorySection points={result.financialHistory} currencies={[workspace.currency]} rangeValue={state.financialRange || state.range} />
    <PortfolioActivityTrendSection snapshot={result.snapshot} currencies={[workspace.currency]} asOfMonth={new Date().toISOString().slice(0, 7)} rangeValue={state.activityRange || state.range} />
    <PortfolioValuationChanges changes={result.valuationChanges} />
  </div>;
  const listState = { ...state, page: undefined, search: undefined, dimension: undefined, item: undefined, closed: undefined, issue: undefined, order: undefined };
  const qualityHref = dataHref(query, listState, { tab: "details", kind: "quality" });
  return <>
    <PortfolioOverview result={result} workspace={workspace} returnTo={returnTo} detailsHref={dataHref(query, listState, { tab: "details", kind: "holdings" })} qualityHref={qualityHref} />
    <HomeOverview scope={buildQueryHref("/", query).slice(1)} reviewHref={qualityHref} qualityCount={workspace.qualityCount} />
  </>;
}
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, toScalar(value)]));
  ensurePortfolioReady();
  const query = normalizePortfolioFilterInput(params);
  const state = normalizePortfolioWorkspaceState(params);
  if (state.kind === "quality") for (const key of ["detailStatus", "issue", "search", "order", "page", "dimension", "item", "closed"]) delete state[key];
  state.tab = dataTab(state.tab);
  const scope = buildPortfolioScope(query);
  const pending = loadPortfolioData(query, state);
  const homeHref = buildQueryHref("/", { ...query, sort: state.sort });
  return <div className={`page portfolio-page ${styles.stack}`}>
    <h1 className="sr-only"><UiText text="统计" /></h1>
    {params.success ? <p role="status" className="note-ok"><UiText text={params.success} /></p> : null}
    {params.error ? <p role="alert" className="note-error"><UiText text={params.error} /></p> : null}
    <header className={styles.toolbar}>
      <h2 id="portfolio-current-title"><UiText text="当前范围" /> · <span><UiText text={scope.isFiltered ? "已筛选" : "全部收藏"} /></span></h2>
      <div className={styles.tools}><Link href={homeHref} className="scope-navigation-link"><UiText text={scope.isFiltered ? "返回筛选结果" : "查看卡片"} /></Link><Suspense><Analysis pending={pending} query={query} /></Suspense></div>
      {scope.criteria.length ? <div className={styles.scope}>{scope.criteria.map(item => <Link key={item.field} href={dataHref({ ...query, [item.field]: undefined }, state, { page: undefined })}><PortfolioCriterion item={item} /> ×</Link>)}<Link href="/portfolio"><UiText text="清空条件" /></Link></div> : null}
    </header>
    <PortfolioDataTabs query={query} state={state} />
    <Suspense fallback={<div className={styles.panel} role="status"><UiText text="正在计算数据…" /></div>}><DataBody pending={pending} query={query} state={state} /></Suspense>
  </div>;
}
async function Analysis({ pending, query }: { pending: Promise<Loaded>; query: PortfolioFilterInput }) {
  let loaded;
  try { loaded = await pending; } catch { return null; }
  return <PortfolioAnalysisButton cardCount={loaded.result.snapshot.cardCount} query={query} scope={loaded.result.snapshot.scope} />;
}
