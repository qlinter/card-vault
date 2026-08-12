import { exportShareCollectionAction } from "@/app/actions/shares";
import { prisma } from "@/lib/prisma";
import { formatBytes } from "@/lib/share-export-validation";
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
  const reportPath = toScalar(query.report);
  const fileCount = Number.parseInt(toScalar(query.files) ?? "", 10);
  const totalBytes = Number.parseInt(toScalar(query.bytes) ?? "", 10);
  const warningCount = Number.parseInt(toScalar(query.warnings) ?? "", 10);

  return (
    <div className="page shares-page">
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
      <p className="muted export-privacy-note">
        导出仅包含球员、卡片和公开展示信息，不包含价格、成本、购买渠道、备注、AI Key 或本地数据库路径。
      </p>
      {error ? <p className="note-error">{error}</p> : null}
      {success ? (
        <div className="panel export-result">
          <h2>{success === "drop" ? "Cloudflare Drop 临时发布包已生成" : "静态分享包已生成"}</h2>
          <p>文件夹：{folderPath}</p>
          <p>压缩包：{zipPath}</p>
          <p>检查报告：{reportPath}</p>
          {Number.isFinite(fileCount) && Number.isFinite(totalBytes) ? (
            <p>发布前检查已通过：{fileCount} 个文件，合计 {formatBytes(totalBytes)}。</p>
          ) : null}
          {Number.isFinite(warningCount) && warningCount > 0 ? (
            <p className="note-error">另有 {warningCount} 项非阻断提醒，请在上传前查看检查报告。</p>
          ) : null}
          {success === "drop" ? (
            <p className="muted">Cloudflare Drop 临时地址约一小时后失效；Card Vault 不记录发布 URL 或认领链接。</p>
          ) : null}
          <p className="muted">导出包使用相对路径，不包含价格、成本、购买渠道、备注、AI Key 或本地数据库路径。</p>
        </div>
      ) : null}

      <section>
        <form action={exportShareCollectionAction.bind(null, share.id)} className="panel share-export-card">
          <div>
            <h2>生成分享包</h2>
            <p className="muted">两种分享包包含相同的展馆网页，请根据使用场景选择附加配置。</p>
          </div>

          <fieldset className="share-export-options">
            <legend className="sr-only">分享包类型</legend>
            <label className="share-export-option">
              <input type="radio" name="exportMode" value="static" />
              <span>
                <strong>通用静态包</strong>
                <small>用于本地浏览、发送、归档，也可以上传到任意静态托管服务。</small>
              </span>
            </label>
            <label className="share-export-option">
              <input type="radio" name="exportMode" value="drop" defaultChecked />
              <span>
                <strong>Cloudflare Drop 临时预览包</strong>
                <small>在相同网页基础上增加 noindex、安全响应头、404 页面和一小时临时发布说明。</small>
              </span>
            </label>
          </fieldset>

          <button className="btn btn-primary" type="submit">
            生成分享包
          </button>
        </form>
      </section>
    </div>
  );
}
