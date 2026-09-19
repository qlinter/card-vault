import { CollectionViewProvider } from "@/components/view-mode-toggle";
import { UiText } from "@/components/ui-text";
import { FilterBar } from "@/components/filter-bar";
import { HomeCardGrid } from "@/components/home-card-grid";
import { HomeValuation } from "@/components/home-valuation";
import { PortfolioAnalysisButton } from "@/components/portfolio-analysis";
import { formatMinorMoneyGrouped } from "@/lib/financial-history";
import { buildPortfolioScope } from "@/lib/portfolio-analysis";
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
  const config = { reportingCurrency: home.currency };
  const valuationTotals = { totals: (home.totalValue === null ? {} : { [home.currency]: BigInt(home.totalValue) }) as Record<string, bigint>, valuedCardCount: home.valuedCount };
  const valuationCurrencies = Object.keys(valuationTotals.totals);
  const successMessage = resolveSuccessMessage(toScalar(params.success), commonSuccessMessages, { passthroughUnknown: true });
  const errorMessage = toScalar(params.error);
  const portfolioScope = buildPortfolioScope(query);
  const cardListReturnHref = buildQueryHref("/", query);


  return (
    <CollectionViewProvider scope="home"><div className="page home-page">
      <div className="summary-grid">
        <div className="panel">
          <strong>{<UiText text={"卡片"} />}</strong>
          <p className="h1" style={{ marginTop: "0.35rem" }}>
            {totalCount}
          </p>
        </div>
        <div className="panel valuation-summary-card">
          <HomeValuation amounts={valuationCurrencies.map(currency => formatMinorMoneyGrouped(valuationTotals.totals[currency], currency))}>
            <PortfolioAnalysisButton cardCount={totalCount} query={query} scope={portfolioScope} />
          </HomeValuation>
          <small className="muted valuation-coverage"><UiText text={"估值覆盖"} />{" "}{valuationTotals.valuedCardCount}/{totalCount}
            {" · "}{config.reportingCurrency}
          </small>
        </div>
      </div>

      {successMessage ? <p className="note-ok"><UiText text={successMessage} /></p> : null}
      {errorMessage ? <p className="note-error">{<UiText text={"操作失败："} />}<UiText text={errorMessage} /></p> : null}

      <FilterBar
        query={query}
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

      <HomeCardGrid key={cardListReturnHref} cards={home.cards} totalCount={totalCount} historyKey={cardListReturnHref} />

      {totalCount === 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <p>{<UiText text={"没有找到符合条件的卡片，试试放宽筛选条件或新增一张卡片。"} />}</p>
        </div>
      ) : null}
    </div></CollectionViewProvider>
  );
}
