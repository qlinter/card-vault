import { cardImageOrder } from "@/lib/card-image-order";
import type { ReactNode } from "react";
import { existingStudioFile } from "@/lib/studio-images";
import { hasStudioKey } from "@/lib/ai-settings";
import { CardLifecycle } from "@/components/card-lifecycle";
import { cardLifecycle } from "@/lib/card-lifecycle";
import { CardImageExport } from "@/components/card-image-export";
import { collectionStatusText } from "@/lib/card-domain";
import { UiText } from "@/components/ui-text";
import { BackButton } from "@/components/back-button";
import { CardFinancialHistory } from "@/components/card-financial-history";
import { CardDetailGallery } from "@/components/card-detail-gallery";
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

function CardFacts({ entries }: { entries: [string, ReactNode][] }) {
  const present = entries.filter(([, value]) => typeof value === "string" ? value.trim() : value != null);
  if (!present.length) return null;
  return <dl className="archive-facts">{present.map(([label, value]) =>
    <div key={label}><dt><UiText text={label} /></dt><dd>{value}</dd></div>
  )}</dl>;
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
      images: { orderBy: cardImageOrder },
      transactions: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] },
      expenses: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] },
      valuations: { orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }] }
    }
  });

  if (!card) {
    notFound();
  }

  const studioReady = Boolean(await existingStudioFile(card));
  const tags = splitTagString(card.tags);
  const gradingLink = normalizeHttpUrl(card.gradingLink);
  const attributes = [card.isRookie && "Rookie", card.isAutograph && "签名卡", card.isPatch && "Patch/Jersey"].filter((label): label is string => Boolean(label));

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
      {["created", "updated"].includes(toScalar(query.success) ?? "") && !hasStudioKey() && !studioReady ? <p className="muted"><UiText text="未配置 OpenAI Key，展馆暂用首图。可在设置中补生成。" /></p> : null}
      {error ? <p className="note-error"><UiText text={error} /></p> : null}

      <div className={card.images.length ? "details archive-overview" : "archive-overview"}>
        {card.images.length > 0 && <section className="panel archive-image-panel">
          <div className="card-images-heading"><h2><UiText text="图片展示" /></h2><CardImageExport cardId={card.id} /></div>
          <CardDetailGallery title={card.cardTitle} images={card.images.map(({id,path,rotation})=>({id,path,rotation}))} />
        </section>}
        <section className="panel archive-info" aria-labelledby="archive-info-title">
          <header className="archive-info-heading">
            <h2 id="archive-info-title"><UiText text="卡牌信息" /></h2>
            <dl className="archive-status">
              <div><dt><UiText text="收藏状态" /></dt><dd><UiText text={collectionStatusText(card.collectionStatus)} /></dd></div>
              <div><dt><UiText text="持有数量" /></dt><dd>{card.holdingQuantity}</dd></div>
            </dl>
          </header>
          <CardFacts entries={[
            ["运动类型", card.sport], ["Team", card.team], ["年份", card.year], ["品牌", card.brand],
            ["产品线", card.productLine], ["子系列", card.subsetName], ["平行版本", card.parallel],
            ["卡号", card.cardNumber], ["编号", card.serialNumber], ["编号范围", card.serialRange]
          ]} />
          <CardFacts entries={[
            ["评级机构", card.gradingCompany], ["评级", card.grade], ["证书号", card.certNumber],
            ["评级链接", gradingLink && <a href={gradingLink} target="_blank" rel="noreferrer"><UiText text="查看评级页面" /></a>]
          ]} />
          <CardFacts entries={[
            ["签字类型", card.autoType], ["Patch 类型", card.patchType],
            ["卡牌属性", attributes.length ? <ul className="archive-terms">{attributes.map(label => <li key={label}><UiText text={label} /></li>)}</ul> : null],
            ["标签", tags.length ? <ul className="archive-terms">{tags.map((tag, index) => <li key={index}>{tag}</li>)}</ul> : null]
          ]} />
          <CardFacts entries={[
            ["AI 展馆图", card.images.length > 0 ? <a href={`/cards/${card.id}/edit${encodeReturnTo(returnTo)}#studio-image`}><UiText text={studioReady ? "已生成" : "待生成"} /></a> : null],
            ["公开状态", <UiText text={visibilityText(card.visibility)} />]
          ]} />
          {card.images.length === 0 && <a className="btn btn-secondary" href={`/cards/${card.id}/edit${encodeReturnTo(returnTo)}#archive-images`}><UiText text="添加图片" /></a>}
        </section>
      </div>

      {(card.publicDescription || card.notes) && <section className="panel archive-notes">
          {card.publicDescription ? <div className="card-detail-note"><strong><UiText text="展示描述" /></strong><p>{card.publicDescription}</p></div> : null}
          {card.notes ? <div className="card-detail-note"><strong><UiText text="备注" /></strong><p>{card.notes}</p></div> : null}
      </section>}
      <div className="panel archive-history"><CardLifecycle events={cardLifecycle(card)} /></div>

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
