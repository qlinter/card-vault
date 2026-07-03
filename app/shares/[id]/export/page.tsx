import { exportShareCollectionAction } from "@/app/actions/shares";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type ExportSharePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ExportSharePage({ params, searchParams }: ExportSharePageProps) {
  const { id } = await params;
  const query = await searchParams;
  const share = await prisma.shareCollection.findUnique({
    where: { id },
    include: { items: { include: { card: true } } }
  });

  if (!share) {
    notFound();
  }

  const privateCount = share.items.filter((item) => item.card.visibility === "private").length;
  const success = toScalar(query.success);
  const error = toScalar(query.error);
  const folderPath = toScalar(query.path);
  const zipPath = toScalar(query.zip);

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">导出分享集</h1>
          <p className="muted">{share.title} / {share.items.length} 张卡片</p>
        </div>
        <div className="title-actions">
          <a className="btn btn-secondary" href={`/shares/${share.id}/edit`}>
            编辑
          </a>
          <a className="btn btn-secondary" href={`/shares/${share.id}/preview`}>
            预览
          </a>
        </div>
      </div>

      {privateCount > 0 ? <p className="note-error">当前分享集包含 {privateCount} 张私密卡。导出前请确认这是你主动选择的内容。</p> : null}
      {error ? <p className="note-error">{error}</p> : null}
      {success ? (
        <div className="panel export-result">
          <h2>{success === "aliyun" ? "阿里云发布包已生成" : "静态分享包已生成"}</h2>
          <p>文件夹：{folderPath}</p>
          <p>压缩包：{zipPath}</p>
          <p className="muted">导出包使用相对路径，不包含价格、成本、购买渠道、备注、AI Key 或本地数据库路径。</p>
        </div>
      ) : null}

      <section className="share-export-grid">
        <form action={exportShareCollectionAction.bind(null, share.id, "static")} className="panel share-export-card">
          <h2>静态导出</h2>
          <p className="muted">生成完整 HTML/CSS/图片/data 文件夹和 zip，可本地打开、压缩发送或归档保存。</p>
          <button className="btn btn-primary" type="submit">
            生成静态分享包
          </button>
        </form>

        <form action={exportShareCollectionAction.bind(null, share.id, "aliyun")} className="panel share-export-card">
          <h2>阿里云发布包</h2>
          <p className="muted">生成适合上传到阿里云 ECS + Nginx 静态目录的发布包，包含部署说明和 Nginx 示例配置。</p>
          <button className="btn btn-primary" type="submit">
            生成阿里云发布包
          </button>
        </form>
      </section>
    </div>
  );
}
