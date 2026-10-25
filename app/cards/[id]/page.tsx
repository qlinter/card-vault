import { collectionStatusText } from "@/lib/card-domain";
import { UiText } from "@/components/ui-text";
import { BackButton } from "@/components/back-button";
import { CardFinancialHistory } from "@/components/card-financial-history";
import { cardImageRotationStyle } from "@/lib/card-image-rotation";
import { splitTagString } from "@/lib/card-helpers";
import { normalizeHttpUrl } from "@/lib/http-url";
import { prisma } from "@/lib/prisma";
import { loadFinancialSettings } from "@/lib/financial-settings";
import { notFound } from "next/navigation";
import { encodeReturnTo, normalizeReturnTo, toScalar } from "@/lib/query-params";
import { cardSuccessMessages, resolveSuccessMessage } from "@/lib/feedback-messages";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function CardDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const financialConfig = await loadFinancialSettings();
  const query = await searchParams;
  const success = resolveSuccessMessage(toScalar(query.success), cardSuccessMessages, { passthroughUnknown: true });
  const error = toScalar(query.error);
  const returnTo = normalizeReturnTo(toScalar(query.returnTo));
  const returnHref = returnTo ?? "/";

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
  const facts = [
    ["运动类型", card.sport], ["Team", card.team], ["年份", card.year],
    ["品牌", card.brand], ["产品线", card.productLine], ["子系列", card.subsetName],
    ["平行版本", card.parallel], ["卡号", card.cardNumber], ["编号", card.serialNumber], ["编号范围", card.serialRange],
    ["评级机构", card.gradingCompany], ["评级", card.grade], ["证书号", card.certNumber],
    ["签字类型", card.autoType], ["Patch 类型", card.patchType]
  ].filter(([, value]) => Boolean(value?.trim()));
  const attributes = [["Rookie", card.isRookie], ["签名卡", card.isAutograph], ["Patch/Jersey", card.isPatch]] as const;

  return (
    <div className="page card-detail-page">
      <div className="title-row">
        <div>
          <h1 className="h1">{card.playerName}</h1>
          <p className="muted">{card.cardTitle}</p>
        </div>
        <div className="card-detail-actions">
          <BackButton href={returnHref} />
          <a href={`/cards/${card.id}/edit${encodeReturnTo(returnTo)}`} className="btn btn-secondary"><UiText text={"编辑"} /></a>
          <a href={`/cards/${card.id}/delete`} className="btn btn-danger"><UiText text={"删除"} /></a>
        </div>
      </div>

      {success ? <p className="note-ok"><UiText text={success} /></p> : null}
      {error ? <p className="note-error"><UiText text={error} /></p> : null}

      <div className="details">
        <section className="panel">
          <h2><UiText text={"图片展示"} /></h2>
          {!card.images.length ? <p className="muted"><UiText text="暂无图片" /></p> : null}
          <div className="gallery">
            {card.images.map((image) => (
              <img key={image.id} src={image.path} alt={card.cardTitle} style={cardImageRotationStyle(image.rotation)} />
            ))}
          </div>
        </section>

        <section className="panel">
          <h2><UiText text={"卡片信息"} /></h2>
          <div className="info-grid">
            <div className="info-item"><strong><UiText text="收藏状态" /></strong><span><UiText text={collectionStatusText(card.collectionStatus)} /></span></div>
            <div className="info-item"><strong><UiText text="持有数量" /></strong><span>{card.holdingQuantity}</span></div>
            {facts.map(([label, value]) => <div className="info-item" key={label}><strong><UiText text={label!} /></strong><span>{value}</span></div>)}
            {gradingLink ? <div className="info-item"><strong><UiText text="评级链接" /></strong><a href={gradingLink} target="_blank" rel="noreferrer"><UiText text="查看评级页面" /></a></div> : null}
            {tags.length ? <div className="info-item"><strong><UiText text="标签" /></strong><span>{tags.join(", ")}</span></div> : null}
          </div>
          {attributes.some(([, enabled]) => enabled) ? <div className="tags card-detail-attributes">{attributes.filter(([, enabled]) => enabled).map(([label]) => <span className="tag" key={label}><UiText text={label} /></span>)}</div> : null}
          {card.publicDescription ? <div className="card-detail-note"><strong><UiText text="展示描述" /></strong><p>{card.publicDescription}</p></div> : null}
          {card.notes ? <div className="card-detail-note"><strong><UiText text="备注" /></strong><p>{card.notes}</p></div> : null}
          <details className="card-detail-visibility"><summary><UiText text="公开状态" /></summary><p><UiText text={visibilityText(card.visibility)} /></p></details>
        </section>
      </div>

        <CardFinancialHistory
          key={card.updatedAt.toISOString()}
        config={financialConfig}
        holdingQuantity={card.holdingQuantity}
        collectionStatus={card.collectionStatus}
        cardId={card.id}
        returnTo={returnTo}
        transactions={card.transactions}
        expenses={card.expenses}
        valuations={card.valuations}
      />
    </div>
  );
}
