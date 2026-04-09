import Link from "next/link";
import { normalizeImagePath } from "@/lib/image-path";
import { buildShowcaseCardHref, normalizeGroupName, toShowcaseWhere } from "@/lib/showcase";
import { prisma } from "@/lib/prisma";

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
      if (!name || map.has(name)) {
        return map;
      }

      map.set(name, {
        name,
        coverPath: row.images[0]?.path ?? null
      });
      return map;
    }, new Map<string, { name: string; coverPath: string | null }>())
  ).map(([, group]) => group);

  return (
    <div className="page showcase-page showcase-backdrop">
      <form className="panel showcase-search" method="get">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search players, teams, sets, years, tags..."
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

      <section className="showcase-groups">
        <div className="showcase-section-head">
          <p className="muted">按球员浏览</p>
        </div>
        <div className="showcase-group-row">
          <Link
            href={query.q ? `/showcase?q=${encodeURIComponent(query.q)}` : "/showcase"}
            className={`showcase-chip${!query.group ? " active" : ""}`}
          >
            全部
          </Link>
          {groups.map((group) => {
            const href = query.q
              ? `/showcase?group=${encodeURIComponent(group.name)}&q=${encodeURIComponent(query.q)}`
              : `/showcase?group=${encodeURIComponent(group.name)}`;

            return (
              <Link key={group.name} href={href} className={`showcase-chip${query.group === group.name ? " active" : ""}`}>
                {group.name}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="showcase-grid-wrap">
        <div className="showcase-section-head">
          <h2>{activeGroupLabel(query.group)}</h2>
          <p className="muted">{cards.length} 张卡</p>
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
