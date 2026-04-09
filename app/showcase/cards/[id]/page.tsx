import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildShowcaseCardHref, toShowcaseWhere } from "@/lib/showcase";
import { ShowcaseGallery } from "@/components/showcase-gallery";
import { notFound } from "next/navigation";

type ShowcaseCardPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function ShowcaseCardPage({ params, searchParams }: ShowcaseCardPageProps) {
  const { id } = await params;
  const queryParams = await searchParams;
  const query = {
    group: toScalar(queryParams.group)?.trim() || undefined,
    q: toScalar(queryParams.q)?.trim() || undefined
  };

  const [card, contextCards] = await Promise.all([
    prisma.card.findUnique({
      where: { id },
      include: { images: { orderBy: { createdAt: "asc" } } }
    }),
    prisma.card.findMany({
      where: toShowcaseWhere(query),
      include: { images: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ playerName: "asc" }, { createdAt: "desc" }]
    })
  ]);

  if (!card) {
    notFound();
  }

  const currentIndex = contextCards.findIndex((item) => item.id === id);
  const previousCard = currentIndex > 0 ? contextCards[currentIndex - 1] : null;
  const nextCard = currentIndex >= 0 && currentIndex < contextCards.length - 1 ? contextCards[currentIndex + 1] : null;

  return (
    <div className="page showcase-page showcase-backdrop">
      <div className="showcase-detail-top">
        <div className="showcase-switches">
          {previousCard ? (
            <Link href={buildShowcaseCardHref(previousCard.id, query)} className="btn btn-secondary">
              上一张卡
            </Link>
          ) : null}
          {nextCard ? (
            <Link href={buildShowcaseCardHref(nextCard.id, query)} className="btn btn-secondary">
              下一张卡
            </Link>
          ) : null}
        </div>
      </div>

      <section className="showcase-detail">
        <div className="showcase-detail-gallery panel">
          <ShowcaseGallery cardTitle={card.cardTitle} images={card.images} />
        </div>

        <div className="showcase-detail-copy panel">
          <h1 className="h1">{card.playerName}</h1>
          <p className="showcase-card-name">{card.cardTitle}</p>
          {card.publicDescription ? <p className="showcase-description">{card.publicDescription}</p> : null}
        </div>
      </section>
    </div>
  );
}
