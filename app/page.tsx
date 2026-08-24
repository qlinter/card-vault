import { FilterBar } from "@/components/filter-bar";
import { HomeCardGrid, type HomeCardGridItem } from "@/components/home-card-grid";
import { PortfolioAnalysisButton } from "@/components/portfolio-analysis";
import { splitTagString, buildCardFilters, buildCardSorting } from "@/lib/card-helpers";
import { homeCardInclude } from "@/lib/card-query-shapes";
import { calculateLatestValuationTotals } from "@/lib/card-stats";
import { homeThumbnailPublicPath } from "@/lib/card-thumbnail-core.js";
import { formatMinorMoneyGrouped } from "@/lib/financial-history";
import { buildPortfolioScope } from "@/lib/portfolio-analysis";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";
import { commonSuccessMessages, resolveSuccessMessage } from "@/lib/feedback-messages";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort((a, b) =>
    a.localeCompare(b)
  );
}

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

  const [cards, optionRows] = await Promise.all([
    prisma.card.findMany({
      where: buildCardFilters(query),
      include: homeCardInclude,
      orderBy: buildCardSorting(query.sort)
    }),
    prisma.card.findMany({
      select: {
        sport: true,
        team: true,
        year: true,
        brand: true,
        productLine: true,
        subsetName: true,
        parallel: true,
        gradingCompany: true,
        grade: true,
        autoType: true,
        patchType: true
      }
    })
  ]);

  const sports = uniqueStrings(optionRows.map((row) => row.sport));
  const teams = uniqueStrings(optionRows.map((row) => row.team));
  const years = uniqueStrings(optionRows.map((row) => row.year));
  const brands = uniqueStrings(optionRows.map((row) => row.brand));
  const productLines = uniqueStrings(optionRows.map((row) => row.productLine));
  const subsetNames = uniqueStrings(optionRows.map((row) => row.subsetName));
  const parallels = uniqueStrings(optionRows.map((row) => row.parallel));
  const gradingCompanies = uniqueStrings(optionRows.map((row) => row.gradingCompany));
  const grades = uniqueStrings(optionRows.map((row) => row.grade));
  const autoTypes = uniqueStrings(optionRows.map((row) => row.autoType));
  const patchTypes = uniqueStrings(optionRows.map((row) => row.patchType));

  const successMessage = resolveSuccessMessage(toScalar(params.success), commonSuccessMessages, { passthroughUnknown: true });
  const errorMessage = toScalar(params.error);
  const valuationTotals = calculateLatestValuationTotals(cards);
  const valuationCurrencies = Object.keys(valuationTotals.totals).sort((left, right) => {
    if (left === "CNY") return -1;
    if (right === "CNY") return 1;
    return left.localeCompare(right);
  });
  const portfolioScope = buildPortfolioScope(query);
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) returnParams.set(key, value);
  }
  const returnSuffix = returnParams.toString();
  const cardListReturnHref = returnSuffix ? `/?${returnSuffix}` : "/";
  const homeCards: HomeCardGridItem[] = cards.map((card) => ({
    id: card.id,
    playerName: card.playerName,
    cardTitle: card.cardTitle,
    details: [card.year, card.team, card.productLine].filter(Boolean).join(" / ") || "未补充更多信息",
    tags: splitTagString(card.tags).slice(0, 4),
    imagePath: card.images[0] ? homeThumbnailPublicPath(card.images[0].path) : null,
    href: `/cards/${card.id}?returnTo=${encodeURIComponent(cardListReturnHref)}`
  }));

  return (
    <div className="page home-page">
      <div className="title-row">
        <div>
          <h1 className="h1">球星卡收藏</h1>
        </div>
        <a href="/cards/new" className="btn btn-primary">
          {"新增卡片"}
        </a>
      </div>

      <div className="summary-grid">
        <div className="panel">
          <strong>{"卡片数量"}</strong>
          <p className="h1" style={{ marginTop: "0.35rem" }}>
            {cards.length}
          </p>
        </div>
        <div className="panel valuation-summary-card">
          <div className="valuation-summary-head">
            <strong>{"总估值"}</strong>
            <PortfolioAnalysisButton cardCount={cards.length} query={query} scope={portfolioScope} />
          </div>
          <div className="valuation-total-list">
            {valuationCurrencies.length > 0 ? valuationCurrencies.map((currency) => (
              <p className="h1 valuation-total-item" key={currency}>
                {formatMinorMoneyGrouped(valuationTotals.totals[currency], currency)}
              </p>
            )) : <p className="h1 valuation-total-item">CNY 0.00</p>}
          </div>
          <small className="muted valuation-coverage">
            估值覆盖 {valuationTotals.valuedCardCount}/{cards.length}
          </small>
        </div>
      </div>

      {successMessage ? <p className="note-ok">{successMessage}</p> : null}
      {errorMessage ? <p className="note-error">{"操作失败："}{errorMessage}</p> : null}

      <FilterBar
        query={query}
        sports={sports}
        teams={teams}
        years={years}
        brands={brands}
        productLines={productLines}
        subsetNames={subsetNames}
        parallels={parallels}
        gradingCompanies={gradingCompanies}
        grades={grades}
        autoTypes={autoTypes}
        patchTypes={patchTypes}
      />

      <HomeCardGrid key={cardListReturnHref} cards={homeCards} />

      {cards.length === 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <p>{"没有找到符合条件的卡片，试试放宽筛选条件或新增一张卡片。"}</p>
        </div>
      ) : null}
    </div>
  );
}
