import { updateShareCollectionAction } from "@/app/actions/shares";
import { ShareCollectionForm } from "@/components/share-collection-form";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { toScalar } from "@/lib/query-params";
import { resolveSuccessMessage, shareEditSuccessMessages } from "@/lib/feedback-messages";

type EditSharePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditSharePage({ params, searchParams }: EditSharePageProps) {
  const { id } = await params;
  const query = await searchParams;
  const [share, cards] = await Promise.all([
    prisma.shareCollection.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        items: {
          include: { card: { include: { images: { take: 1, orderBy: { createdAt: "asc" } } } } },
          orderBy: { sortOrder: "asc" }
        }
      }
    }),
    prisma.card.findMany({
      include: { images: { take: 1, orderBy: { createdAt: "asc" } } },
      orderBy: [{ playerName: "asc" }, { createdAt: "desc" }]
    })
  ]);

  if (!share) {
    notFound();
  }

  const success = resolveSuccessMessage(toScalar(query.success), shareEditSuccessMessages);
  const error = toScalar(query.error);

  return (
    <div className="page shares-page">
      <div className="title-row">
        <div>
          <h1 className="h1">编辑分享集</h1>
          <p className="muted">调整展馆文案、卡片选择、排序和导出前展示内容。</p>
        </div>
        <div className="title-actions">
          <a className="btn btn-secondary" href={`/shares/${share.id}/preview`}>
            预览
          </a>
          <a className="btn btn-primary" href={`/shares/${share.id}/export`}>
            导出
          </a>
        </div>
      </div>
      {success ? <p className="note-ok">{success}</p> : null}
      <ShareCollectionForm action={updateShareCollectionAction.bind(null, share.id)} cards={cards} share={share} error={error} />
    </div>
  );
}
