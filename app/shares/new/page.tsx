import { createShareCollectionAction } from "@/app/actions/shares";
import { ShareCollectionForm } from "@/components/share-collection-form";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";

type NewSharePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSharePage({ searchParams }: NewSharePageProps) {
  const params = await searchParams;
  const cards = await prisma.card.findMany({
    include: { images: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: [{ playerName: "asc" }, { createdAt: "desc" }]
  });

  return (
    <div className="page shares-page">
      <div className="title-row">
        <div>
          <h1 className="h1">新建分享集</h1>
          <p className="muted">手动挑选卡片，生成面向他人的静态精品展馆。</p>
        </div>
      </div>
      <ShareCollectionForm action={createShareCollectionAction} cards={cards} error={toScalar(params.error)} />
    </div>
  );
}
