import { Card, CardImage, ShareCollection, ShareCollectionItem } from "@prisma/client";
import { ShareThemeCard, ShareThemeGenerator } from "@/components/share-theme-generator";
import { normalizeImagePath } from "@/lib/image-path";

type CardOption = Card & { images: CardImage[] };
type ShareWithItems =
  | (ShareCollection & {
      items: Array<ShareCollectionItem & { card: CardOption }>;
    })
  | null;

type ShareCollectionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cards: CardOption[];
  share?: ShareWithItems;
  error?: string;
};

function value(value: string | null | undefined, fallback = ""): string {
  return value ?? fallback;
}

function shareItemMap(share?: ShareWithItems): Map<string, ShareCollectionItem & { card: CardOption }> {
  return new Map((share?.items ?? []).map((item) => [item.cardId, item]));
}

function cardSummary(card: CardOption): ShareThemeCard {
  return {
    id: card.id,
    playerName: card.playerName,
    cardTitle: card.cardTitle,
    sport: card.sport,
    team: card.team,
    year: card.year,
    brand: card.brand,
    productLine: card.productLine,
    subsetName: card.subsetName,
    parallel: card.parallel,
    cardNumber: card.cardNumber,
    serialNumber: card.serialNumber,
    serialRange: card.serialRange,
    isRookie: card.isRookie,
    isAutograph: card.isAutograph,
    autoType: card.autoType,
    isPatch: card.isPatch,
    patchType: card.patchType,
    gradingCompany: card.gradingCompany,
    grade: card.grade,
    certNumber: card.certNumber,
    publicDescription: card.publicDescription
  };
}

export function ShareCollectionForm({ action, cards, share, error }: ShareCollectionFormProps) {
  const selected = shareItemMap(share);
  const sortedCards = [...cards].sort((a, b) => {
    const aItem = selected.get(a.id);
    const bItem = selected.get(b.id);
    if (aItem && bItem) {
      return aItem.sortOrder - bItem.sortOrder;
    }
    if (aItem) {
      return -1;
    }
    if (bItem) {
      return 1;
    }
    return a.playerName.localeCompare(b.playerName);
  });
  const imageOptions = cards.flatMap((card) =>
    card.images.map((image) => ({
      value: image.path,
      label: `${card.playerName} - ${card.cardTitle}`
    }))
  );

  return (
    <form action={action} className="share-form">
      {error ? <p className="note-error">{error}</p> : null}

      <section className="panel share-section">
        <div className="form-grid">
          <label className="field">
            <span>分享集标题 *</span>
            <input name="title" required defaultValue={value(share?.title, "我的球星卡展馆")} />
          </label>
          <label className="field">
            <span>副标题</span>
            <input name="subtitle" defaultValue={value(share?.subtitle)} />
          </label>
          <label className="field full">
            <span>封面介绍</span>
            <textarea name="description" defaultValue={value(share?.description)} />
          </label>
          <label className="field full">
            <span>展馆叙事</span>
            <textarea name="themeNarrative" defaultValue={value(share?.themeNarrative)} />
          </label>
          <label className="field full">
            <span>收藏亮点</span>
            <textarea name="themeHighlights" defaultValue={value(share?.themeHighlights)} />
          </label>
          <label className="field full">
            <span>主题分组</span>
            <textarea name="groupNotes" defaultValue={value(share?.groupNotes)} />
          </label>
          <label className="field full">
            <span>封面图</span>
            <select name="coverImagePath" defaultValue={value(share?.coverImagePath)}>
              <option value="">自动使用第一张有图卡片</option>
              {imageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ShareThemeGenerator cards={cards.map(cardSummary)} />
      </section>

      <section className="panel share-section">
        <div className="share-section-head">
          <div>
            <h2>选择卡片</h2>
            <p className="muted">只会导出你勾选的卡片。价格、成本、购买渠道和备注不会进入分享包。</p>
          </div>
          <span className="muted">共 {cards.length} 张可选</span>
        </div>

        <div className="share-card-picker">
          {sortedCards.map((card, index) => {
            const item = selected.get(card.id);
            const image = card.images[0];
            const privateHint = card.visibility === "private" ? "私密卡" : card.visibility === "linkOnly" ? "仅链接" : "公开";
            return (
              <article key={card.id} className="share-card-option">
                <label className="share-card-select">
                  <input type="checkbox" name="cardIds" value={card.id} defaultChecked={Boolean(item)} />
                  {image ? <img src={normalizeImagePath(image.path)} alt={card.cardTitle} /> : <div className="share-card-placeholder" />}
                </label>
                <div className="share-card-option-body">
                  <div>
                    <strong>{card.playerName}</strong>
                    <p>{card.cardTitle}</p>
                    <p className="muted">{[card.year, card.brand, card.productLine, card.grade].filter(Boolean).join(" / ")}</p>
                    <span className={card.visibility === "private" ? "share-private-badge" : "tag"}>{privateHint}</span>
                  </div>
                  <label className="field">
                    <span>排序</span>
                    <input name={`sortOrder-${card.id}`} type="number" defaultValue={item?.sortOrder ?? index} />
                  </label>
                  <details>
                    <summary>分享展示覆盖</summary>
                    <label className="field">
                      <span>展示标题</span>
                      <input name={`displayTitle-${card.id}`} defaultValue={value(item?.displayTitle)} placeholder={card.cardTitle} />
                    </label>
                    <label className="field">
                      <span>展示描述</span>
                      <textarea
                        name={`displayDescription-${card.id}`}
                        defaultValue={value(item?.displayDescription)}
                        placeholder={card.publicDescription ?? "默认使用卡片展示描述"}
                      />
                    </label>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="share-form-actions">
        <button type="submit" className="btn btn-primary">
          保存分享集
        </button>
        <a href="/shares" className="btn btn-secondary">
          返回分享
        </a>
      </div>
    </form>
  );
}
