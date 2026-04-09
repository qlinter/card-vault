import { splitTagString } from "@/lib/card-helpers";
import { prisma } from "@/lib/prisma";
import { normalizeImagePath } from "@/lib/image-path";
import { notFound } from "next/navigation";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function valueOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function currencyOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `￥${value.toFixed(2)}`;
}

export default async function CardDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const query = await searchParams;
  const success = toScalar(query.success);

  const card = await prisma.card.findUnique({
    where: { id },
    include: { images: { orderBy: { createdAt: "asc" } } }
  });

  if (!card) {
    notFound();
  }

  const tags = splitTagString(card.tags);

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">{card.playerName}</h1>
          <p className="muted">{card.cardTitle}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href={`/cards/${card.id}/edit`} className="btn btn-secondary">
            编辑
          </a>
          <a href={`/cards/${card.id}/delete`} className="btn btn-danger">
            删除
          </a>
        </div>
      </div>

      {success ? <p className="note-ok">操作成功：{success}</p> : null}

      <div className="details">
        <section className="panel">
          <h2>图片展示</h2>
          <div className="gallery">
            {card.images.map((image) => (
              <img key={image.id} src={normalizeImagePath(image.path)} alt={card.cardTitle} />
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>卡片信息</h2>
          <div className="info-grid">
            <div className="info-item">
              <strong>球员姓名</strong>
              <span>{valueOrDash(card.playerName)}</span>
            </div>
            <div className="info-item">
              <strong>运动类型</strong>
              <span>{valueOrDash(card.sport)}</span>
            </div>
            <div className="info-item">
              <strong>球队</strong>
              <span>{valueOrDash(card.team)}</span>
            </div>
            <div className="info-item">
              <strong>年份</strong>
              <span>{valueOrDash(card.year)}</span>
            </div>
            <div className="info-item">
              <strong>系列</strong>
              <span>{valueOrDash(card.setName)}</span>
            </div>
            <div className="info-item">
              <strong>卡号</strong>
              <span>{valueOrDash(card.cardNumber)}</span>
            </div>
            <div className="info-item">
              <strong>编号</strong>
              <span>{valueOrDash(card.serialNumber)}</span>
            </div>
            <div className="info-item">
              <strong>编号范围</strong>
              <span>{valueOrDash(card.serialRange)}</span>
            </div>
            <div className="info-item">
              <strong>签名卡</strong>
              <span>{card.isAutograph ? "是" : "否"}</span>
            </div>
            <div className="info-item">
              <strong>Patch/Jersey</strong>
              <span>{card.isPatch ? "是" : "否"}</span>
            </div>
            <div className="info-item">
              <strong>评级机构</strong>
              <span>{valueOrDash(card.gradingCompany)}</span>
            </div>
            <div className="info-item">
              <strong>评级</strong>
              <span>{valueOrDash(card.grade)}</span>
            </div>
            <div className="info-item">
              <strong>评级链接</strong>
              <span>
                {card.gradingLink ? (
                  <a href={card.gradingLink} target="_blank" rel="noreferrer">
                    查看评级页面
                  </a>
                ) : (
                  "-"
                )}
              </span>
            </div>
            <div className="info-item">
              <strong>购买日期</strong>
              <span>{card.purchaseDate ? new Date(card.purchaseDate).toLocaleDateString() : "-"}</span>
            </div>
            <div className="info-item">
              <strong>购买价格</strong>
              <span>{currencyOrDash(card.purchasePrice)}</span>
            </div>
            <div className="info-item">
              <strong>现值</strong>
              <span>{currencyOrDash(card.currentValue)}</span>
            </div>
            <div className="info-item">
              <strong>购买渠道</strong>
              <span>{valueOrDash(card.purchaseSource)}</span>
            </div>
            <div className="info-item">
              <strong>标签</strong>
              <span>{tags.length > 0 ? tags.join(", ") : "-"}</span>
            </div>
          </div>

          <div style={{ marginTop: "0.8rem" }}>
            <strong>备注</strong>
            <p>{card.notes || "-"}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
