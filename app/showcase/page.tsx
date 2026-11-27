import { cardImageOrder } from "@/lib/card-image-order";
import Link from "next/link";
import { prefersStudioImages } from "@/lib/showcase-source-server";
import { existingStudioFile, studioImageUrl } from "@/lib/studio-images";
import { ShowcaseSourceSwitch } from "@/components/showcase-source-switch";
import { CollectionViewProvider } from "@/components/view-mode-toggle";
import { ShowcaseViews } from "@/components/showcase-views";
import { UiText, UiElement } from "@/components/ui-text";
import { ShowcaseGroupFilter } from "@/components/showcase-group-filter";
import { ShowcaseImage } from "@/components/showcase-image";
import { ShowcaseIcon } from "@/components/showcase-icon";
import { StartImmersive } from "@/components/immersive-viewer";
import { prisma } from "@/lib/prisma";
import { buildShowcaseCardHref, buildShowcaseHref, compareShowcaseGroupNames, normalizeGroupName, parseShowcasePage, showcaseOrderBy, SHOWCASE_PAGE_SIZE, toShowcaseWhere } from "@/lib/showcase";
import { showcaseCaptionFields, showcaseFacts } from "@/lib/showcase-presentation";
import { toScalar } from "@/lib/query-params";
import { homeThumbnailPublicPath } from "@/lib/card-thumbnail-core.js";
import { requireShowcaseAccess } from "@/lib/account-server";

type ShowcasePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShowcasePage({ searchParams }: ShowcasePageProps) {
  const { guest } = await requireShowcaseAccess();
  const studio = await prefersStudioImages(guest);
  const params = await searchParams;
  const query = { q: toScalar(params.q)?.trim() || undefined, group: toScalar(params.group)?.trim() || undefined };
  const where = toShowcaseWhere(query, guest);
  const [totalCount, groupRows] = await Promise.all([
    prisma.card.count({ where }),
    prisma.card.groupBy({ by: ["playerName"], where: toShowcaseWhere({ q: query.q }, guest), _count: { _all: true }, orderBy: { playerName: "asc" } })
  ]);
  const pageCount = Math.max(1, Math.ceil(totalCount / SHOWCASE_PAGE_SIZE));
  const page = Math.min(parseShowcasePage(toScalar(params.page)), pageCount);
  const cards = await prisma.card.findMany({
      where,
      select: { id: true, playerName: true, cardTitle: true, gradingCompany: true, grade: true, parallel: true, serialNumber: true, serialRange: true,
        images: { take: 1, orderBy: cardImageOrder, select: { id: true, path: true, rotation: true } } },
      orderBy: showcaseOrderBy,
      skip: (page - 1) * SHOWCASE_PAGE_SIZE,
      take: SHOWCASE_PAGE_SIZE
    });
  const studioIds = new Set(studio ? await Promise.all(cards.map(async card => await existingStudioFile(card) ? card.id : null)) : []);
  const groups = groupRows.flatMap(row => {
    const name = normalizeGroupName(row.playerName);
    return name ? [{ name, count: row._count._all }] : [];
  });
  if (query.group && !groups.some(group => group.name === query.group)) groups.push({ name: query.group, count: 0 });
  groups.sort((a, b) => compareShowcaseGroupNames(a.name, b.name));
  const filtered = Boolean(query.q || query.group);
  return <CollectionViewProvider scope={guest ? "guest-showcase" : "showcase"}><div className="page showcase-page showcase-backdrop">
    <h1 className="sr-only"><UiText text="展示" /></h1>
    <header className="showcase-heading">
      <StartImmersive showcaseStudio={studio} source={query} disabled={!totalCount} appearance="showcase" guest={guest} />
      {!guest && totalCount > 0 ? <Link className="showcase-action" href={buildShowcaseHref({ ...query, page }, "/showcase/group-photo")}><ShowcaseIcon name="image" /><UiText text="导出合影" /></Link> : null}
      {!guest ? <Link className="showcase-action showcase-shares" href="/shares"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="16" rx="2" /><path d="M7 6V2h14v16h-4" /></svg><UiText text="分享集" /></Link> : null}
      <form className="showcase-search" method="get" role="search">
        <ShowcaseIcon name="search" />
        <UiElement as="input" uiAttributes={["aria-label"]} name="q" defaultValue={query.q ?? ""} aria-label={guest ? "搜索公开卡牌" : "搜索卡牌主体、Team、系列、年份、标签..."} className="showcase-search-input" />
        {query.group ? <input type="hidden" name="group" value={query.group} /> : null}
        <button className="showcase-tool" type="submit"><UiText text="搜索" /></button>
        {filtered ? <Link className="showcase-tool" href="/showcase"><UiText text="清空" /></Link> : null}
      </form>
    </header>
    <ShowcaseGroupFilter groups={groups} activeGroup={query.group} queryText={query.q} />
    <ShowcaseViews sourceSwitch={<ShowcaseSourceSwitch studio={studio} guest={guest} />} hasCards={cards.length > 0} heading={<h2 className="showcase-current-group">{query.group ?? <UiText text="全部卡牌" />}<span className="showcase-summary"><UiText text={filtered ? "当前展出 {0} 张卡牌" : "共 {0} 张卡牌"} values={[totalCount]} /></span></h2>}>
      <div className="showcase-grid">
        {cards.map((card, index) => {
          const facts = new Map(showcaseFacts(card).map(fact => [fact.label, fact.value]));
          return <Link key={card.id} href={buildShowcaseCardHref(card.id, { ...query, page })} className="showcase-card">
            <div className="showcase-card-stage"><ShowcaseImage key={studioIds.has(card.id) ? "studio" : card.images[0]?.id ?? "empty"} src={studioIds.has(card.id) ? studioImageUrl(card.id, true) : card.images[0] ? homeThumbnailPublicPath(card.images[0].path) : undefined} alt={card.cardTitle} rotation={studioIds.has(card.id) ? 0 : card.images[0]?.rotation} eager={index < 8} priority={index < 4} /></div>
            <div className="showcase-card-body">
              <h3 title={card.playerName}>{card.playerName}</h3>
              <p className="showcase-card-title" title={card.cardTitle}>{card.cardTitle}</p>
              <dl className="showcase-card-facts">
                {showcaseCaptionFields.map(field => {
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
      {cards.length === 0 ? <div className="showcase-empty"><ShowcaseIcon name="image" /><h3><UiText text={filtered ? "没有匹配的收藏" : guest ? "暂无可浏览的公开卡牌" : "收藏展墙等待第一张卡牌"} /></h3>
        {filtered || !guest ? <>
          <p><UiText text={filtered ? "试试其他关键词，或清空筛选查看全部收藏。" : "录入卡牌后，它们会在这里完整展出。"} /></p>
          <Link className="showcase-tool" href={filtered ? "/showcase" : "/cards/new"}><UiText text={filtered ? "查看全部收藏" : "新增卡牌"} /></Link>
        </> : null}
      </div> : null}
    </ShowcaseViews>
  </div></CollectionViewProvider>;
}
