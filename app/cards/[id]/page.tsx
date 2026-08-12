import { BackButton } from "@/components/back-button";
import { CardFinancialHistory } from "@/components/card-financial-history";
import { splitTagString } from "@/lib/card-helpers";
import { normalizeImagePath } from "@/lib/image-path";
import { normalizeHttpUrl } from "@/lib/http-url";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { toScalar } from "@/lib/query-params";
import { cardSuccessMessages, resolveSuccessMessage } from "@/lib/feedback-messages";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valueOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function yesNo(value: boolean): string {
  return value ? "是" : "否";
}

function visibilityText(value: string): string {
  switch (value) {
    case "public":
      return "公开";
    case "linkOnly":
      return "仅链接可见";
    case "private":
      return "私密";
    default:
      return value;
  }
}

function collectionStatusText(value: string): string {
  switch (value) {
    case "holding":
      return "持有中";
    case "listed":
      return "在售";
    case "sold":
      return "已售出";
    case "grading":
      return "送评中";
    case "target":
      return "目标卡";
    default:
      return value;
  }
}

export default async function CardDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const query = await searchParams;
  const success = resolveSuccessMessage(toScalar(query.success), cardSuccessMessages, { passthroughUnknown: true });
  const error = toScalar(query.error);
  const returnTo = toScalar(query.returnTo);
  const returnHref = returnTo === "/" || returnTo?.startsWith("/?") ? returnTo : "/";

  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      images: { orderBy: { createdAt: "asc" } },
      transactions: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] },
      expenses: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] },
      valuations: { orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }] }
    }
  });

  if (!card) {
    notFound();
  }

  const tags = splitTagString(card.tags);
  const gradingLink = normalizeHttpUrl(card.gradingLink);

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">{card.playerName}</h1>
          <p className="muted">{card.cardTitle}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <BackButton href={returnHref} />
          <a href={`/cards/${card.id}/edit`} className="btn btn-secondary">
            编辑
          </a>
          <a href={`/cards/${card.id}/delete`} className="btn btn-danger">
            删除
          </a>
        </div>
      </div>

      {success ? <p className="note-ok">{success}</p> : null}
      {error ? <p className="note-error">{error}</p> : null}

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
              <strong>品牌</strong>
              <span>{valueOrDash(card.brand)}</span>
            </div>
            <div className="info-item">
              <strong>产品线</strong>
              <span>{valueOrDash(card.productLine)}</span>
            </div>
            <div className="info-item">
              <strong>子系列</strong>
              <span>{valueOrDash(card.subsetName)}</span>
            </div>
            <div className="info-item">
              <strong>平行版本</strong>
              <span>{valueOrDash(card.parallel)}</span>
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
              <strong>Rookie</strong>
              <span>{yesNo(card.isRookie)}</span>
            </div>
            <div className="info-item">
              <strong>签名卡</strong>
              <span>{yesNo(card.isAutograph)}</span>
            </div>
            <div className="info-item">
              <strong>签字类型</strong>
              <span>{valueOrDash(card.autoType)}</span>
            </div>
            <div className="info-item">
              <strong>Patch/Jersey</strong>
              <span>{yesNo(card.isPatch)}</span>
            </div>
            <div className="info-item">
              <strong>Patch 类型</strong>
              <span>{valueOrDash(card.patchType)}</span>
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
              <strong>证书号</strong>
              <span>{valueOrDash(card.certNumber)}</span>
            </div>
            <div className="info-item">
              <strong>评级链接</strong>
              <span>
                {gradingLink ? (
                  <a href={gradingLink} target="_blank" rel="noreferrer">
                    查看评级页面
                  </a>
                ) : (
                  "-"
                )}
              </span>
            </div>
            <div className="info-item">
              <strong>公开状态</strong>
              <span>{visibilityText(card.visibility)}</span>
            </div>
            <div className="info-item">
              <strong>收藏状态</strong>
              <span>{collectionStatusText(card.collectionStatus)}</span>
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

      <CardFinancialHistory
        cardId={card.id}
        transactions={card.transactions}
        expenses={card.expenses}
        valuations={card.valuations}
      />
    </div>
  );
}

