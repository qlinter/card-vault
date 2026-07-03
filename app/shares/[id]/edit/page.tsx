import { updateShareCollectionAction } from "@/app/actions/shares";
import { ShareCollectionForm } from "@/components/share-collection-form";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type EditSharePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function successText(value: string | undefined): string | null {
  if (value === "created") {
    return "分享集已创建。";
  }
  if (value === "updated") {
    return "分享集已保存。";
  }
  return null;
}

export default async function EditSharePage({ params, searchParams }: EditSharePageProps) {
  const { id } = await params;
  const query = await searchParams;
  const [share, cards] = await Promise.all([
    prisma.shareCollection.findUnique({
      where: { id },
      include: {
        items: {
          include: { card: { include: { images: { orderBy: { createdAt: "asc" } } } } },
          orderBy: { sortOrder: "asc" }
        }
      }
    }),
    prisma.card.findMany({
      include: { images: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ playerName: "asc" }, { createdAt: "desc" }]
    })
  ]);

  if (!share) {
    notFound();
  }

  const success = successText(toScalar(query.success));
  const error = toScalar(query.error);

  return (
    <div className="page">
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
