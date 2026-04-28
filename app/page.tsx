import { FilterBar } from "@/components/filter-bar";
import { StorageSettings } from "@/components/storage-settings";
import { splitTagString, buildCardFilters, buildCardSorting } from "@/lib/card-helpers";
import { normalizeImagePath } from "@/lib/image-path";
import { prisma } from "@/lib/prisma";
import { resolveConfiguredDataDir } from "@/lib/storage-resolver";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function formatCurrency(value: number): string {
  return `¥${value.toFixed(2)}`;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = {
    q: toScalar(params.q),
    sport: toScalar(params.sport),
    team: toScalar(params.team),
    year: toScalar(params.year),
    setName: toScalar(params.setName),
    isAutograph: toScalar(params.isAutograph),
    isPatch: toScalar(params.isPatch),
    isGraded: toScalar(params.isGraded),
    sort: toScalar(params.sort)
  };

  const [cards, optionRows] = await Promise.all([
    prisma.card.findMany({
      where: buildCardFilters(query),
      include: { images: { orderBy: { createdAt: "asc" } } },
      orderBy: buildCardSorting(query.sort)
    }),
    prisma.card.findMany({
      select: { sport: true, team: true, year: true, setName: true }
    })
  ]);

  const sports = uniqueStrings(optionRows.map((row) => row.sport));
  const teams = uniqueStrings(optionRows.map((row) => row.team));
  const years = uniqueStrings(optionRows.map((row) => row.year));
  const sets = uniqueStrings(optionRows.map((row) => row.setName));

  const successMessage = toScalar(params.success);
  const errorMessage = toScalar(params.error);
  const totalValue = cards.reduce((sum, card) => sum + (card.currentValue ?? 0), 0);
  const currentStoragePath = resolveConfiguredDataDir() ?? "未设置";

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">我的球星卡收藏</h1>
          <p className="muted">当前显示 {cards.length} 张卡片，支持离线录入、管理、筛选与展示</p>
        </div>
        <a href="/cards/new" className="btn btn-primary">
          新增卡片
        </a>
      </div>

      <div className="summary-grid">
        <div className="panel">
          <strong>卡片数量</strong>
          <p className="h1" style={{ marginTop: "0.35rem" }}>
            {cards.length}
          </p>
        </div>
        <div className="panel">
          <strong>总估值</strong>
          <p className="h1" style={{ marginTop: "0.35rem" }}>
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      <StorageSettings currentPath={currentStoragePath} />

      {successMessage ? <p className="note-ok">操作成功：{successMessage}</p> : null}
      {errorMessage ? <p className="note-error">操作失败：{errorMessage}</p> : null}

      <FilterBar query={query} sports={sports} teams={teams} years={years} sets={sets} />

      <section className="cards-grid">
        {cards.map((card) => {
          const tags = splitTagString(card.tags);
          return (
            <article key={card.id} className="card-item">
              <a href={`/cards/${card.id}`}>
                {card.images[0] ? (
                  <img className="card-thumb" src={normalizeImagePath(card.images[0].path)} alt={card.cardTitle} />
                ) : (
                  <div className="card-thumb" />
                )}
              </a>
              <div className="card-body">
                <h2 className="card-title">{card.playerName}</h2>
                <p className="card-sub">{card.cardTitle}</p>
                <p className="card-sub">{[card.year, card.team, card.setName].filter(Boolean).join(" / ") || "未补充更多信息"}</p>
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
          <p>没有找到符合条件的卡片，试试放宽筛选条件或新增一张卡片。</p>
        </div>
      ) : null}
    </div>
  );
}
