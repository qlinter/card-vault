import Link from "next/link";
import { GroupPhotoEditor } from "@/components/group-photo-editor";
import { ShowcaseIcon } from "@/components/showcase-icon";
import { UiText } from "@/components/ui-text";
import { requireAccount } from "@/lib/account-server";
import { cardImageOrder } from "@/lib/card-image-order";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";
import { buildShowcaseHref, parseShowcasePage, showcaseOrderBy, toShowcaseWhere } from "@/lib/showcase";
import { groupPhotoAsset, studioFile } from "@/lib/studio-images";

export default async function GroupPhotoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAccount();
  const p = await searchParams;
  const query = { q: toScalar(p.q)?.trim(), group: toScalar(p.group)?.trim(), page: parseShowcasePage(toScalar(p.page)) };
  const select = { id: true, cardTitle: true, playerName: true, visibility: true, gradingCompany: true, grade: true,
      team: true, year: true, brand: true, productLine: true, subsetName: true, parallel: true, cardNumber: true, tags: true,
      images: { take: 1, orderBy: cardImageOrder, select: { id: true, path: true, rotation: true } } } as const;
  // Prisma loads the first-image relation using a list of parent IDs. Keep each
  // list below SQLite's bind limit, within one consistent ordered snapshot.
  const rows = await prisma.$transaction(async tx => {
    const pageSize = 250;
    const load = (skip: number) => tx.card.findMany({ where: toShowcaseWhere(query), orderBy: showcaseOrderBy, select, take: pageSize, skip });
    const result = await load(0);
    while (result.length > 0 && result.length % pageSize === 0) {
      const next = await load(result.length);
      if (!next.length) break;
      result.push(...next);
    }
    return result;
  }, { timeout: 30_000 });
  const toCandidate = async (card: typeof rows[number]) => {
    const asset = await groupPhotoAsset(card.id, studioFile(card));
    const searchText = [card.playerName, card.cardTitle, card.team, card.year, card.brand, card.productLine, card.subsetName, card.parallel, card.cardNumber, card.tags].filter(Boolean).join(" ").toLowerCase();
    return { id: card.id, title: card.cardTitle, name: card.playerName, searchText, visibility: card.visibility, graded: Boolean(card.gradingCompany || card.grade),
      ...asset };
  };
  const cards = [];
  for (let i = 0; i < rows.length; i += 16) {
    cards.push(...await Promise.all(rows.slice(i, i + 16).map(toCandidate)));
  }
  return <div className="page showcase-page showcase-backdrop group-photo-page">
    <Link href={buildShowcaseHref(query)} className="showcase-tool showcase-return"><ShowcaseIcon name="previous" /><span><UiText text="返回展墙" /></span></Link>
    <h1 className="h1"><UiText text="导出合影" /></h1>
    <GroupPhotoEditor key={JSON.stringify([query.group, query.q])} cards={cards} />
  </div>;
}
