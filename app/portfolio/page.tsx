import { UiText } from "@/components/ui-text";
import { PortfolioAnalysisButton } from "@/components/portfolio-analysis";
import { PortfolioCenter } from "@/components/portfolio-center";
import { PortfolioComparisonPanel } from "@/components/portfolio-comparison-panel";
import { PortfolioWorkspaceControls } from "@/components/portfolio-workspace-controls";
import { DisclosureIcon } from "@/components/disclosure-icon";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizePortfolioFilterInput } from "@/lib/portfolio-analysis";
import { listSavedPortfolioViews, listStoredPortfolioSnapshots } from "@/lib/portfolio-persistence";
import { loadPortfolioComparison, loadPortfolioSnapshot } from "@/lib/portfolio-snapshot-service";
import { toScalar } from "@/lib/query-params";
import styles from "@/components/portfolio-center.module.css";

export const dynamic = "force-dynamic";

type PortfolioPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const params = await searchParams;
  const [views, storedSnapshots] = await Promise.all([
    listSavedPortfolioViews(),
    listStoredPortfolioSnapshots()
  ]);
  const activeViewId = toScalar(params.viewId);
  const activeView = activeViewId ? views.find((view) => view.id === activeViewId) : undefined;
  const requestedQuery = normalizePortfolioFilterInput(Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, toScalar(value)])
  ));
  const query = activeView?.query ?? requestedQuery;
  const result = await loadPortfolioSnapshot(query, { allowEmpty: true });
  let comparison = null;
  let comparisonError: string | null = null;
  try {
    comparison = await loadPortfolioComparison(
      toScalar(params.compareLeft),
      toScalar(params.compareRight),
      result
    );
  } catch (error) {
    comparisonError = errorMessage(error, "组合比较失败。");
  }
  const success = toScalar(params.success);
  const error = toScalar(params.error) ?? (activeViewId && !activeView ? "收藏视图不存在或已删除。" : null);
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const scalar = toScalar(value);
    if (scalar && key !== "success" && key !== "error") returnParams.set(key, scalar);
  }
  const returnTo = returnParams.size > 0 ? `/portfolio?${returnParams}` : "/portfolio";

  return (
    <div className="page portfolio-page">
      <h1 className="sr-only"><UiText text="组合" /></h1>
      {success ? <p className="note-ok"><UiText text={success} /></p> : null}
      {error ? <p className="note-error"><UiText text={error} /></p> : null}
      {comparisonError ? <p className="note-error">{comparisonError}</p> : null}
      <details className={`${styles.portfolioZone} ${styles.comparisonWorkspace}`}>
        <summary className={`${styles.zoneHeader} ${styles.zoneSummary}`}>
          <div><h2><UiText text={"视图与比较"} /></h2></div>
          <span className="disclosure-button" aria-hidden="true">
            <DisclosureIcon expanded={false} />
          </span>
        </summary>
        <div className={styles.zoneContent}>
          <PortfolioWorkspaceControls
            query={query}
            activeViewId={activeView?.id}
            views={views}
            snapshots={storedSnapshots}
            compareLeft={toScalar(params.compareLeft)}
            compareRight={toScalar(params.compareRight)}
          />
          {comparison ? <PortfolioComparisonPanel comparison={comparison} /> : null}
        </div>
      </details>

      <section className={styles.portfolioZone} aria-labelledby="portfolio-current-title">
        <header className={`${styles.zoneHeader} ${styles.currentDataHeader}`}>
          <div><h2 id="portfolio-current-title"><UiText text={"当前组合数据"} /></h2></div>
          <PortfolioAnalysisButton cardCount={result.snapshot.cardCount} query={query} scope={result.snapshot.scope} />
        </header>
        <PortfolioCenter
          snapshot={result.snapshot}
          qualityCards={result.qualityCards}
          incompleteCards={result.incompleteCards}
          valuationChanges={result.valuationChanges}
          financialHistory={result.financialHistory}
          highCostPositions={result.highCostPositions}
          soldReviews={result.soldReviews}
          returnTo={returnTo}
          asOfMonth={new Date().toISOString().slice(0, 7)}
        />
      </section>
    </div>
  );
}
