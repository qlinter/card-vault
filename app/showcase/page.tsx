import Link from "next/link";
import { ShowcaseGroupFilter } from "@/components/showcase-group-filter";
import { normalizeImagePath } from "@/lib/image-path";
import { prisma } from "@/lib/prisma";
import { buildShowcaseCardHref, normalizeGroupName, toShowcaseWhere } from "@/lib/showcase";

type ShowcasePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function activeGroupLabel(group: string | undefined): string {
  return group ?? "全部卡片";
}

export default async function ShowcasePage({ searchParams }: ShowcasePageProps) {
  const params = await searchParams;
  const query = {
    q: toScalar(params.q)?.trim() || undefined,
    group: toScalar(params.group)?.trim() || undefined
  };

  const [cards, groupRows] = await Promise.all([
    prisma.card.findMany({
      where: toShowcaseWhere(query),
      include: { images: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ playerName: "asc" }, { createdAt: "desc" }]
    }),
    prisma.card.findMany({
      select: { playerName: true, images: { take: 1, orderBy: { createdAt: "asc" }, select: { path: true } } },
      orderBy: [{ playerName: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const groups = Array.from(
    groupRows.reduce((map, row) => {
      const name = normalizeGroupName(row.playerName);
      if (!name) {
        return map;
      }

      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
        return map;
      }

      map.set(name, {
        name,
        count: 1
      });
      return map;
    }, new Map<string, { name: string; count: number }>())
  ).map(([, group]) => group);

  return (
    <div className="page showcase-page showcase-backdrop">
      <div className="title-row">
        <div>
          <h1 className="h1">展示</h1>
          <p className="muted">
            当前展示 {cards.length} 张卡片，来自 {groups.length} 位球员或组合
          </p>
        </div>
      </div>

      <form className="panel showcase-search" method="get">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="搜索球员、球队、系列、年份、标签..."
          className="showcase-search-input"
        />
        {query.group ? <input type="hidden" name="group" value={query.group} /> : null}
        <button className="btn btn-primary" type="submit">
          搜索
        </button>
        <Link className="btn btn-secondary" href="/showcase">
          清空
        </Link>
      </form>

      <ShowcaseGroupFilter groups={groups} activeGroup={query.group} queryText={query.q} />

      <section className="showcase-grid-wrap">
        <div className="showcase-section-head">
          <div>
            <h2>{activeGroupLabel(query.group)}</h2>
            <p className="muted">共 {cards.length} 张卡片</p>
          </div>
        </div>
        <div className="showcase-grid">
          {cards.map((card) => (
            <Link key={card.id} href={buildShowcaseCardHref(card.id, query)} className="showcase-card">
              {card.images[0] ? (
                <img
                  className="showcase-card-image"
                  src={normalizeImagePath(card.images[0].path)}
                  alt={card.cardTitle}
                />
              ) : (
                <div className="showcase-card-image showcase-placeholder" />
              )}
              <div className="showcase-card-body">
                <h3>{card.playerName}</h3>
                <p>{card.cardTitle}</p>
              </div>
            </Link>
          ))}
        </div>
        {cards.length === 0 ? (
          <div className="panel" style={{ marginTop: "1rem" }}>
            <p>当前筛选条件下没有匹配的卡片。</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
