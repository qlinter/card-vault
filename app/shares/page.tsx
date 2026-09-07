import { UiText } from "@/components/ui-text";
import Link from "next/link";
import { deleteShareCollectionAction } from "@/app/actions/shares";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";
import { resolveSuccessMessage, shareListSuccessMessages } from "@/lib/feedback-messages";

type SharesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SharesPage({ searchParams }: SharesPageProps) {
  const params = await searchParams;
  const shares = await prisma.shareCollection.findMany({
    include: { items: true },
    orderBy: { updatedAt: "desc" }
  });
  const success = resolveSuccessMessage(toScalar(params.success), shareListSuccessMessages);
  const error = toScalar(params.error);

  return (
    <div className="page shares-page">
      <h1 className="sr-only"><UiText text="分享" /></h1>
      <div className="share-list-toolbar">
        <Link className="btn btn-primary" href="/shares/new"><UiText text={"新建分享集"} /></Link>
      </div>

      {success ? <p className="note-ok"><UiText text={success} /></p> : null}
      {error ? <p className="note-error"><UiText text={error} /></p> : null}

      <section className="share-list">
        {shares.map((share) => (
          <article className="panel share-list-item" key={share.id}>
            <div>
              <h2>{share.title}</h2>
              {share.subtitle || share.description ? <p className="muted">{share.subtitle || share.description}</p> : null}
              <p className="muted">
                {share.items.length}<UiText text=" 张卡片" />
              </p>
            </div>
            <div className="share-list-actions">
              <Link className="btn btn-secondary" href={`/shares/${share.id}/preview`}><UiText text={"预览"} /></Link>
              <Link className="btn btn-secondary" href={`/shares/${share.id}/edit`}><UiText text={"编辑"} /></Link>
              <Link className="btn btn-secondary" href={`/shares/${share.id}/export`}><UiText text={"导出"} /></Link>
              <form action={deleteShareCollectionAction.bind(null, share.id)}>
                <button className="btn btn-danger" type="submit"><UiText text="删除" /></button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {shares.length === 0 ? (
        <div className="panel">
          <p><UiText text={"还没有分享集。先新建一个主题展馆，手动挑选要展示的卡片。"} /></p>
        </div>
      ) : null}
    </div>
  );
}
