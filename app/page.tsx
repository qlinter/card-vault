import { CollectionViewProvider } from "@/components/view-mode-toggle";
import { UiText } from "@/components/ui-text";
import { valuationCoverage } from "@/lib/portfolio-metrics";
import { FilterBar } from "@/components/filter-bar";
import { HomeCardGrid } from "@/components/home-card-grid";
import { HomeValuation } from "@/components/home-valuation";
import { formatMinorMoneyGrouped } from "@/lib/financial-history";
import { buildQueryHref, toScalar } from "@/lib/query-params";
import { commonSuccessMessages, resolveSuccessMessage } from "@/lib/feedback-messages";

import { loadHomeData, loadHomeOptions } from "@/lib/home-data";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};


export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = {
    q: toScalar(params.q),
    sport: toScalar(params.sport),
    team: toScalar(params.team),
    year: toScalar(params.year),
    brand: toScalar(params.brand),
    productLine: toScalar(params.productLine),
    subsetName: toScalar(params.subsetName),
    parallel: toScalar(params.parallel),
    cardNumber: toScalar(params.cardNumber),
    isSerialNumbered: toScalar(params.isSerialNumbered),
    isOneOfOne: toScalar(params.isOneOfOne),
    isRookie: toScalar(params.isRookie),
    isAutograph: toScalar(params.isAutograph),
    autoType: toScalar(params.autoType),
    isPatch: toScalar(params.isPatch),
    patchType: toScalar(params.patchType),
    isGraded: toScalar(params.isGraded),
    gradingCompany: toScalar(params.gradingCompany),
    grade: toScalar(params.grade),
    certNumber: toScalar(params.certNumber),
    visibility: toScalar(params.visibility),
    collectionStatus: toScalar(params.collectionStatus),
    sort: toScalar(params.sort)
  };

  const [home, options] = await Promise.all([loadHomeData(query), loadHomeOptions()]);
  const totalCount = home.totalCount;
  const coverage = valuationCoverage(home.valuedCount, home.activeCount);
  const valuationTotals = { totals: (home.totalValue === null ? {} : { [home.currency]: BigInt(home.totalValue) }) as Record<string, bigint>, valuedCardCount: home.valuedCount };
  const valuationCurrencies = Object.keys(valuationTotals.totals);
  const successMessage = resolveSuccessMessage(toScalar(params.success), commonSuccessMessages, { passthroughUnknown: true });
  const errorMessage = toScalar(params.error);
  const exportMode = toScalar(params.export) === "1";
  const cardListReturnHref = buildQueryHref("/", { ...query, export: exportMode ? "1" : undefined });


  return (
    <CollectionViewProvider scope="home"><div className="page home-page">
      <header className="collection-summary">
        <h1><UiText text="收藏" /><span>{totalCount} <UiText text="项" /></span></h1>
        {valuationCurrencies.length ? <div className="collection-value"><HomeValuation compact amounts={valuationCurrencies.map(currency => formatMinorMoneyGrouped(valuationTotals.totals[currency], currency))} /><small className="valuation-coverage"><UiText text="估值覆盖" /> {coverage.valuedCount}/{coverage.eligibleCount}</small></div> : null}
        <div className="collection-shortcuts"><a className="collection-scout-link" href="/collection?tab=wishlist"><UiText text="目标 & 寻卡" /></a></div>
      </header>

      {successMessage ? <p className="note-ok"><UiText text={successMessage} /></p> : null}
      {errorMessage ? <p className="note-error">{<UiText text={"操作失败："} />}<UiText text={errorMessage} /></p> : null}


      <FilterBar
        query={query}
        exportMode={exportMode}
        sports={options.sport}
        teams={options.team}
        years={options.year}
        brands={options.brand}
        productLines={options.productLine}
        subsetNames={options.subsetName}
        parallels={options.parallel}
        gradingCompanies={options.gradingCompany}
        grades={options.grade}
        autoTypes={options.autoType}
        patchTypes={options.patchType}
      />

      <HomeCardGrid key={cardListReturnHref} cards={home.cards} totalCount={totalCount} historyKey={cardListReturnHref} exportMode={exportMode} query={query} />

      {totalCount === 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <p>{<UiText text={"没有找到符合条件的卡片，试试放宽筛选条件或新增一张卡片。"} />}</p>
        </div>
      ) : null}
    </div></CollectionViewProvider>
  );
}
