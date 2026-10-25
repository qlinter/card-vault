import Link from "next/link";
import { CollectionViewProvider } from "@/components/view-mode-toggle";
import { ShowcaseViews } from "@/components/showcase-views";
import { UiText, UiElement } from "@/components/ui-text";
import { ShowcaseGroupFilter } from "@/components/showcase-group-filter";
import { ShowcaseImage } from "@/components/showcase-image";
import { ShowcaseIcon } from "@/components/showcase-icon";
import { prisma } from "@/lib/prisma";
import { buildShowcaseCardHref, buildShowcaseHref, compareShowcaseGroupNames, normalizeGroupName, parseShowcasePage, SHOWCASE_PAGE_SIZE, toShowcaseWhere } from "@/lib/showcase";
import { showcaseFacts } from "@/lib/showcase-presentation";
import { toScalar } from "@/lib/query-params";
import { homeThumbnailPublicPath } from "@/lib/card-thumbnail-core.js";

type ShowcasePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const captionFields = [
  { key: "variant", label: "版本" },
  { key: "grade", label: "评级" },
  { key: "serial", label: "限量编号" }
];

export default async function ShowcasePage({ searchParams }: ShowcasePageProps) {
  const params = await searchParams;
  const query = { q: toScalar(params.q)?.trim() || undefined, group: toScalar(params.group)?.trim() || undefined };
  const where = toShowcaseWhere(query);
  const [totalCount, groupRows] = await Promise.all([
    prisma.card.count({ where }),
    prisma.card.groupBy({ by: ["playerName"], where: toShowcaseWhere({ q: query.q }), _count: { _all: true }, orderBy: { playerName: "asc" } })
  ]);
  const pageCount = Math.max(1, Math.ceil(totalCount / SHOWCASE_PAGE_SIZE));
  const page = Math.min(parseShowcasePage(toScalar(params.page)), pageCount);
  const cards = await prisma.card.findMany({
      where,
      select: { id: true, playerName: true, cardTitle: true, gradingCompany: true, grade: true, parallel: true, serialNumber: true, serialRange: true,
        images: { take: 1, orderBy: { createdAt: "asc" }, select: { id: true, path: true, rotation: true } } },
      orderBy: [{ playerName: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * SHOWCASE_PAGE_SIZE,
      take: SHOWCASE_PAGE_SIZE
    });
  const groups = groupRows.flatMap(row => {
    const name = normalizeGroupName(row.playerName);
    return name ? [{ name, count: row._count._all }] : [];
  });
  if (query.group && !groups.some(group => group.name === query.group)) groups.push({ name: query.group, count: 0 });
  groups.sort((a, b) => compareShowcaseGroupNames(a.name, b.name));
  const filtered = Boolean(query.q || query.group);
  return <CollectionViewProvider scope="showcase"><div className="page showcase-page showcase-backdrop">
    <h1 className="sr-only"><UiText text="展示" /></h1>
    <header className="showcase-heading">
      <Link className="scope-navigation-link showcase-shares" href="/shares"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="16" rx="2" /><path d="M7 6V2h14v16h-4" /></svg><UiText text="分享集" /></Link>
      <form className="showcase-search" method="get" role="search">
        <ShowcaseIcon name="search" />
        <UiElement as="input" uiAttributes={["placeholder", "aria-label"]} name="q" defaultValue={query.q ?? ""} placeholder="搜索收藏" aria-label="搜索卡片主体、Team、系列、年份、标签..." className="showcase-search-input" />
        {query.group ? <input type="hidden" name="group" value={query.group} /> : null}
        <button className="showcase-tool" type="submit"><UiText text="搜索" /></button>
        {filtered ? <Link className="showcase-tool" href="/showcase"><UiText text="清空" /></Link> : null}
      </form>
    </header>
    <ShowcaseGroupFilter groups={groups} activeGroup={query.group} queryText={query.q} />
    <ShowcaseViews hasCards={cards.length > 0} heading={<h2 className="showcase-current-group">{query.group ?? <UiText text="全部卡片" />}<span className="showcase-summary"><UiText text={filtered ? "当前展出 {0} 张卡片" : "共 {0} 张卡片"} values={[totalCount]} /></span></h2>}>
      <div className="showcase-grid">
        {cards.map((card, index) => {
          const facts = new Map(showcaseFacts(card).map(fact => [fact.label, fact.value]));
          return <Link key={card.id} href={buildShowcaseCardHref(card.id, { ...query, page })} className="showcase-card">
            <div className="showcase-card-stage"><ShowcaseImage key={card.images[0]?.id ?? "empty"} src={card.images[0] ? homeThumbnailPublicPath(card.images[0].path) : undefined} alt={card.cardTitle} rotation={card.images[0]?.rotation} eager={index < 8} priority={index < 4} /></div>
            <div className="showcase-card-body">
              <h3 title={card.playerName}>{card.playerName}</h3>
              <p className="showcase-card-title" title={card.cardTitle}>{card.cardTitle}</p>
              <dl className="showcase-card-facts">
                {captionFields.map(field => {
                  const value = facts.get(field.label);
                  return <div key={field.key} data-showcase-fact={field.key}>
                    <dt><UiText text={field.label} /></dt>
                    <dd className={value ? undefined : "is-empty"} title={value}>{value || "–"}</dd>
                  </div>;
                })}
              </dl>
            </div>
          </Link>;
        })}
      </div>
      {pageCount > 1 ? <UiElement as="nav" uiAttributes={["aria-label"]} className="showcase-pagination" aria-label="展示分页">
        {page > 1 ? <Link className="showcase-tool showcase-pagination-previous" href={buildShowcaseHref({ ...query, page: page - 1 })}><UiText text="上一页" /></Link> : <span />}
        <span className="showcase-page-position" aria-live="polite">{page} / {pageCount}</span>
        {page < pageCount ? <Link className="showcase-tool showcase-pagination-next" href={buildShowcaseHref({ ...query, page: page + 1 })}><UiText text="下一页" /></Link> : <span />}
      </UiElement> : null}
      {cards.length === 0 ? <div className="showcase-empty"><ShowcaseIcon name="image" /><h3><UiText text={filtered ? "没有匹配的收藏" : "收藏展墙等待第一张卡片"} /></h3><p><UiText text={filtered ? "试试其他关键词，或清空筛选查看全部收藏。" : "录入卡片后，它们会在这里完整展出。"} /></p><Link className="showcase-tool" href={filtered ? "/showcase" : "/cards/new"}><UiText text={filtered ? "查看全部收藏" : "新增卡片"} /></Link></div> : null}
    </ShowcaseViews>
  </div></CollectionViewProvider>;
}
