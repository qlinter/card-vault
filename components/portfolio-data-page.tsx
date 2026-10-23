import Link from "next/link";
import { Suspense } from "react";
import { RefreshPageButton } from "@/components/page-recovery";
import { UiText } from "@/components/ui-text";
import { PortfolioAnalysisButton } from "@/components/portfolio-analysis";
import { PortfolioComparisonPanel } from "@/components/portfolio-comparison-panel";
import { PortfolioWorkspaceControls } from "@/components/portfolio-workspace-controls";
import { PortfolioOverview } from "@/components/portfolio-overview";
import { PortfolioDataDetails } from "@/components/portfolio-data-details";
import { PortfolioStructureView } from "@/components/portfolio-structure-view";
import { PortfolioFinancialHistorySection, PortfolioActivityTrendSection } from "@/components/portfolio-center-trends";
import { PortfolioValuationChanges } from "@/components/portfolio-valuation-changes";
import { PortfolioFrozenSnapshot } from "@/components/portfolio-frozen-snapshot";
import { PortfolioDataTabs } from "@/components/portfolio-data-tabs";
import { PortfolioCriterion } from "@/components/portfolio-criterion";
import { PortfolioRangeField } from "@/components/portfolio-context";
import { errorMessage } from "@/lib/feedback-messages";
import { buildPortfolioScope, normalizePortfolioFilterInput, type PortfolioFilterInput } from "@/lib/portfolio-analysis";
import { listStoredPortfolioSnapshots } from "@/lib/portfolio-persistence";
import { loadPortfolioComparison, loadPortfolioSnapshot, type PortfolioSnapshotResult } from "@/lib/portfolio-snapshot-service";
import { createDataCollector, dataHref, dataTab, type DataWorkspace } from "@/lib/portfolio-workspace";
import { normalizePortfolioWorkspaceState } from "@/lib/portfolio-workspace-state";
import { buildQueryHref, toScalar } from "@/lib/query-params";
import { prisma } from "@/lib/prisma";
import styles from "@/components/portfolio-data.module.css";

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
  return <PortfolioOverview result={result} workspace={workspace} returnTo={returnTo} detailsHref={dataHref(query, listState, { tab: "details", kind: "holdings" })} qualityHref={dataHref(query, listState, { tab: "details", kind: "quality" })} />;
}
async function Comparison({ pending, left, right }: { pending: Promise<Loaded>; left: string; right: string }) {
  let comparison, failure = "";
  try { comparison = await loadPortfolioComparison(left, right, (await pending).result); } catch (error) { failure = errorMessage(error, "组合比较失败。"); }
  if (failure) return <div><p role="alert" className="note-error"><UiText text={failure} /></p><RefreshPageButton /></div>;
  return comparison ? <PortfolioComparisonPanel comparison={comparison} /> : null;
}

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, toScalar(value)]));
  const snapshots = await listStoredPortfolioSnapshots();
  const query = normalizePortfolioFilterInput(params);
  const state = normalizePortfolioWorkspaceState(params);
  state.tab = dataTab(state.tab);
  const wish = query.wish ? await prisma.collectionPlan.findUnique({ where: { id: query.wish }, select: { title: true } }) : null;
  const scope = buildPortfolioScope(query, { wish: wish?.title || "已删除的心愿" });
  const collector = createDataCollector(new Date(), { includeRows: state.tab === "details" });
  const pending = loadPortfolioSnapshot(query, { allowEmpty: true, includeDetails: state.tab === "trends", onReportingBatch: collector.add }).then(result => ({ result, workspace: collector.finish(state) }));
  const homeHref = buildQueryHref("/", { ...query, sort: state.sort });
  return <div className={`page portfolio-page ${styles.stack}`}>
    <h1 className="sr-only"><UiText text="数据" /></h1>
    {params.success ? <p role="status" className="note-ok"><UiText text={params.success} /></p> : null}
    {params.error ? <p role="alert" className="note-error"><UiText text={params.error} /></p> : null}
    <header className={styles.toolbar}>
      <h2 id="portfolio-current-title"><UiText text="当前范围" /> · <span><UiText text={scope.isFiltered ? "已筛选" : "全部收藏"} /></span></h2>
      <div className={styles.tools}><Link href={homeHref} className="scope-navigation-link"><UiText text={scope.isFiltered ? "返回筛选结果" : "查看卡片"} /></Link><Suspense><Analysis pending={pending} query={query} /></Suspense></div>
      {scope.criteria.length ? <div className={styles.scope}>{scope.criteria.map(item => <Link key={item.field} href={dataHref({ ...query, [item.field]: undefined }, state, { page: undefined })}><PortfolioCriterion item={item} /> ×</Link>)}<Link href="/portfolio"><UiText text="清空条件" /></Link></div> : null}
      <details className={styles.scopeEditor}><summary><UiText text="调整范围" /></summary><form method="get">
        <PortfolioRangeField />
        {Object.entries({ ...query, tab: state.tab }).map(([key, value]) => value && key !== "q" ? <input type="hidden" name={key} key={key} value={value} /> : null)}
        <label><UiText text="搜索关键词" /><input type="search" name="q" defaultValue={query.q} maxLength={160} /></label>
        <button className="btn btn-secondary"><UiText text="搜索" /></button>
      </form></details>
      <details className={styles.scopeEditor} open={Boolean(params.compareLeft && params.compareRight || params.workspace)}><summary><UiText text="快照与比较" /></summary>
        <PortfolioWorkspaceControls query={query} snapshots={snapshots} compareLeft={params.compareLeft} compareRight={params.compareRight} state={state} />
        {params.snapshotId ? <Suspense fallback={<p role="status"><UiText text="正在读取快照…" /></p>}><PortfolioFrozenSnapshot id={params.snapshotId} /></Suspense> : null}
        {params.compareLeft && params.compareRight ? <Suspense fallback={<p role="status"><UiText text="正在加载比较…" /></p>}><Comparison pending={pending} left={params.compareLeft} right={params.compareRight} /></Suspense> : null}
      </details>
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
