import { UiText } from "@/components/ui-text";
import Link from "next/link";
import { ShowcaseGallery } from "@/components/showcase-gallery";
import { prisma } from "@/lib/prisma";
import { buildShowcaseCardHref, buildShowcaseHref, parseShowcasePage, showcasePageForIndex, showcaseSqlScope, toShowcaseWhere } from "@/lib/showcase";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { toScalar } from "@/lib/query-params";
import { showcaseFacts } from "@/lib/showcase-presentation";
import { ShowcaseIcon } from "@/components/showcase-icon";

type ShowcaseCardPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShowcaseCardPage({ params, searchParams }: ShowcaseCardPageProps) {
  const { id } = await params;
  const queryParams = await searchParams;
  const query = {
    group: toScalar(queryParams.group)?.trim() || undefined,
    q: toScalar(queryParams.q)?.trim() || undefined
  };

  const card = await prisma.card.findUnique({
      where: { id },
      select: { id: true, playerName: true, cardTitle: true, publicDescription: true, year: true, brand: true, productLine: true, parallel: true, cardNumber: true, gradingCompany: true, grade: true, serialNumber: true, serialRange: true,
        images: { orderBy: { createdAt: "asc" }, select: { id: true, path: true, rotation: true } } }
    });

  if (!card) {
    notFound();
  }

  const where = toShowcaseWhere(query);
  const inContext = !(query.group || query.q) || Boolean(await prisma.card.findFirst({ where: { AND: [where, { id }] }, select: { id: true } }));
  const scope = showcaseSqlScope(query);
  // Compare stored timestamp values in SQLite. This matches ORDER BY even for older text-formatted rows.
  const before = Prisma.sql`(candidate.playerName < anchor.playerName OR
    (candidate.playerName = anchor.playerName AND candidate.createdAt > anchor.createdAt) OR
    (candidate.playerName = anchor.playerName AND candidate.createdAt = anchor.createdAt AND candidate.id < anchor.id))`;
  const after = Prisma.sql`(candidate.playerName > anchor.playerName OR
    (candidate.playerName = anchor.playerName AND candidate.createdAt < anchor.createdAt) OR
    (candidate.playerName = anchor.playerName AND candidate.createdAt = anchor.createdAt AND candidate.id > anchor.id))`;
  const [totalCount, previousCount, previousCard, nextCard] = inContext ? await Promise.all([
    prisma.card.count({ where }),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM Card candidate JOIN Card anchor ON anchor.id = ${id} WHERE ${scope} AND ${before}`).then(rows => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT candidate.id FROM Card candidate JOIN Card anchor ON anchor.id = ${id} WHERE ${scope} AND ${before} ORDER BY candidate.playerName DESC, candidate.createdAt ASC, candidate.id DESC LIMIT 1`).then(rows => rows[0] ?? null),
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT candidate.id FROM Card candidate JOIN Card anchor ON anchor.id = ${id} WHERE ${scope} AND ${after} ORDER BY candidate.playerName ASC, candidate.createdAt DESC, candidate.id ASC LIMIT 1`).then(rows => rows[0] ?? null)
  ]) : [0, -1, null, null] as const;
  const page = inContext ? showcasePageForIndex(previousCount) : parseShowcasePage(toScalar(queryParams.page));
  const returnHref = buildShowcaseHref({ ...query, page });
  const facts = showcaseFacts(card).filter(fact => !(card.year && fact.label === "年份"));

  return (
    <div className="page showcase-page showcase-backdrop">
      <div className="showcase-detail-top">
        <Link href={returnHref} className="showcase-tool showcase-return"><ShowcaseIcon name="previous" /><UiText text="返回展墙" /></Link>
        <div className="showcase-switches">
          {previousCard ? (
            <Link href={buildShowcaseCardHref(previousCard.id, { ...query, page: showcasePageForIndex(previousCount - 1) })} className="showcase-tool"><ShowcaseIcon name="previous" /><UiText text={"上一张卡"} /></Link>
          ) : null}
          {inContext ? <span className="showcase-position">{previousCount + 1} / {totalCount}</span> : null}
          {nextCard ? (
            <Link href={buildShowcaseCardHref(nextCard.id, { ...query, page: showcasePageForIndex(previousCount + 1) })} className="showcase-tool"><UiText text={"下一张卡"} /><ShowcaseIcon name="next" /></Link>
          ) : null}
        </div>
      </div>

      <section className="showcase-detail">
        <div className="showcase-detail-gallery">
          <ShowcaseGallery key={card.id} cardId={card.id} cardTitle={card.cardTitle} images={card.images} />
        </div>

        <div className="showcase-detail-copy">
          <p className="showcase-eyebrow"><UiText text="收藏展示" />{card.year ? ` / ${card.year}` : ""}</p>
          <h1 className="h1">{card.playerName}</h1>
          <p className="showcase-card-name">{card.cardTitle}</p>
          {facts.length ? <dl className="showcase-detail-facts">{facts.map(fact => <div key={fact.label}><dt><UiText text={fact.label} /></dt><dd>{fact.value}</dd></div>)}</dl> : null}
          {card.publicDescription ? <section className="showcase-story"><h2><UiText text="收藏故事" /></h2><p className="showcase-description">{card.publicDescription}</p></section> : null}
        </div>
      </section>
    </div>
  );
}
