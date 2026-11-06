"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language-provider";
import { ShowcaseImage } from "./showcase-image";
import { StartImmersive } from "./immersive-viewer";
import { homeThumbnailPublicPath } from "@/lib/card-thumbnail-path.js";
import type { RecapCard, RecapSpec } from "@/lib/collection-recap";

type Props = { spec: RecapSpec; cardCount: number; initialCards: RecapCard[]; representatives: RecapCard[]; onChange: (cards: RecapCard[]) => void; onError: (message: string) => void };

function CardImage({ card }: { card: RecapCard }) {
  const image = card.images[0];
  return <ShowcaseImage src={image ? homeThumbnailPublicPath(image.path) : undefined} alt={card.cardTitle} rotation={image?.rotation} />;
}

export function CollectionRecapCards({ spec, cardCount, initialCards, representatives, onChange, onError }: Props) {
  const { t } = useLanguage();
  const [cards, setCards] = useState(initialCards), [page, setPage] = useState(0), [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false), [pickerOpen, setPickerOpen] = useState(false);
  const pending = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => pending.current?.abort(), []);
  const available = cards.filter(card => !representatives.some(row => row.id === card.id));

  async function loadCards(nextPage: number) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller; setBusy(true); onError("");
    try {
      const params = new URLSearchParams({ spec: JSON.stringify(spec), page: String(nextPage), q: search, cardsOnly: "1" });
      const response = await fetch(`/api/collection-recaps?${params}`, { signal: controller.signal }), result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) { setCards(result.cards); setPage(nextPage); }
    } catch { if (!controller.signal.aborted) onError("无法读取回顾，请检查日期和筛选条件。"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }

  function move(index: number, delta: number) {
    const next = [...representatives];
    [next[index + delta], next[index]] = [next[index], next[index + delta]];
    onChange(next);
  }

  return <>
    <div className="recap-actions recap-view-actions">
      <h2>{t("代表卡片")}</h2>
      <div>
        <StartImmersive source={{ spec }} label="赏卡：本期全部" disabled={!cardCount} />
        <StartImmersive source={{ spec, ids: representatives.map(card => card.id) }} label="赏卡：代表卡片" disabled={!representatives.length} />
        <button type="button" className="btn" aria-expanded={pickerOpen} aria-controls="recap-card-picker" onClick={() => setPickerOpen(!pickerOpen)}>{t("卡片调整")}</button>
      </div>
    </div>
    <div className="recap-representatives">
      {representatives.map((card, index) => <article key={card.id}>
        <div className="recap-image"><CardImage card={card} /></div>
        <strong>{card.playerName}</strong><span>{card.cardTitle}</span>
        {card.collectionStatus === "sold" ? <small>{t("当前已售出")}</small> : null}
        <div>
          <button type="button" aria-label={`${t("上移")} ${card.cardTitle}`} disabled={!index} onClick={() => move(index, -1)}>←</button>
          <button type="button" aria-label={`${t("下移")} ${card.cardTitle}`} disabled={index === representatives.length - 1} onClick={() => move(index, 1)}>→</button>
          <button type="button" onClick={() => onChange(representatives.filter(row => row.id !== card.id))}>{t("移除")}</button>
        </div>
      </article>)}
    </div>
    {!representatives.length ? <p>{t("最多选择六张代表卡片。")}</p> : null}
    {pickerOpen ? <div className="recap-inline-picker" id="recap-card-picker">
      <form className="recap-actions" onSubmit={event => { event.preventDefault(); void loadCards(0); }}>
        <label>{t("搜索本期卡片")}<input value={search} maxLength={160} onChange={event => setSearch(event.target.value)} /></label>
        <button type="submit" className="btn" disabled={busy}>{t("搜索")}</button>
      </form>
      <div className="recap-picker">
        {available.map(card => <button type="button" key={card.id} disabled={representatives.length >= 6} onClick={() => onChange([...representatives, card])}>
          <span className="recap-picker-image"><CardImage card={card} /></span>
          <strong>{card.playerName}</strong><span>{card.cardTitle}</span><small>{t("加入代表卡片")}</small>
        </button>)}
      </div>
      {!cards.length ? <p>{t("本期没有匹配卡片。")}</p> : null}
      <div className="recap-actions">
        <button type="button" disabled={!page || busy} onClick={() => loadCards(page - 1)}>{t("上一页")}</button>
        <span>{page + 1}</span>
        <button type="button" disabled={cards.length < 24 || busy} onClick={() => loadCards(page + 1)}>{t("下一页")}</button>
      </div>
    </div> : null}
  </>;
}
