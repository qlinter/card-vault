import Link from "next/link";
import { deleteShareCollectionAction } from "@/app/actions/shares";
import { prisma } from "@/lib/prisma";

type SharesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function successText(value: string | undefined): string | null {
  if (value === "deleted") {
    return "分享集已删除。";
  }
  return null;
}

export default async function SharesPage({ searchParams }: SharesPageProps) {
  const params = await searchParams;
  const shares = await prisma.shareCollection.findMany({
    include: { items: true },
    orderBy: { updatedAt: "desc" }
  });
  const success = successText(toScalar(params.success));
  const error = toScalar(params.error);

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">分享</h1>
          <p className="muted">创建可静态导出、可部署到阿里云服务器的球星卡精品展馆。</p>
        </div>
        <Link className="btn btn-primary" href="/shares/new">
          新建分享集
        </Link>
      </div>

      {success ? <p className="note-ok">{success}</p> : null}
      {error ? <p className="note-error">{error}</p> : null}

      <section className="share-list">
        {shares.map((share) => (
          <article className="panel share-list-item" key={share.id}>
            <div>
              <h2>{share.title}</h2>
              <p className="muted">{share.subtitle || share.description || "尚未填写分享说明。"}</p>
              <p className="muted">
                {share.items.length} 张卡片 / slug: {share.slug}
              </p>
            </div>
            <div className="share-list-actions">
              <Link className="btn btn-secondary" href={`/shares/${share.id}/preview`}>
                预览
              </Link>
              <Link className="btn btn-secondary" href={`/shares/${share.id}/edit`}>
                编辑
              </Link>
              <Link className="btn btn-primary" href={`/shares/${share.id}/export`}>
                导出
              </Link>
              <form action={deleteShareCollectionAction.bind(null, share.id)}>
                <button className="btn btn-secondary" type="submit">
                  删除
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {shares.length === 0 ? (
        <div className="panel">
          <p>还没有分享集。先新建一个主题展馆，手动挑选要展示的卡片。</p>
        </div>
      ) : null}
    </div>
  );
}
