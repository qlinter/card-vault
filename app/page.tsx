import { FilterBar } from "@/components/filter-bar";
import { PortfolioAnalysisButton } from "@/components/portfolio-analysis";
import { splitTagString, buildCardFilters, buildCardSorting } from "@/lib/card-helpers";
import { homeCardInclude } from "@/lib/card-query-shapes";
import { calculateLatestValuationTotals } from "@/lib/card-stats";
import { formatMinorMoneyGrouped } from "@/lib/financial-history";
import { normalizeImagePath } from "@/lib/image-path";
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
    serialNumber: toScalar(params.serialNumber),
    serialRange: toScalar(params.serialRange),
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

  return (
    <div className="page home-page">
      <div className="title-row">
        <div>
          <h1 className="h1">{"我的球星卡收藏"}</h1>
          <p className="muted">
            {"当前显示 "}{cards.length}{" 张卡片，支持离线录入、管理、筛选与展示"}
          </p>
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

      <section className="cards-grid">
        {cards.map((card) => {
          const tags = splitTagString(card.tags);
          return (
            <article key={card.id} className="card-item">
              <a href={`/cards/${card.id}?returnTo=${encodeURIComponent(cardListReturnHref)}`}>
                {card.images[0] ? (
                  <img className="card-thumb" src={normalizeImagePath(card.images[0].path)} alt={card.cardTitle} />
                ) : (
                  <div className="card-thumb" />
                )}
              </a>
              <div className="card-body">
                <h2 className="card-title">{card.playerName}</h2>
                <p className="card-sub">{card.cardTitle}</p>
                <p className="card-sub">
                  {[card.year, card.team, card.productLine].filter(Boolean).join(" / ") || "未补充更多信息"}
                </p>
                {tags.length > 0 ? (
                  <div className="tags">
                    {tags.slice(0, 4).map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {cards.length === 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <p>{"没有找到符合条件的卡片，试试放宽筛选条件或新增一张卡片。"}</p>
        </div>
      ) : null}
    </div>
  );
}
