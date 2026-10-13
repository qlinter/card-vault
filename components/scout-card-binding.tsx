"use client";
import { useEffect, useId, useState } from "react";
import { useLanguage } from "./language-provider";
import type { ScoutOwnedCard, ScoutOwnedCardsPage } from "@/lib/scout-domain";
import type { ScoutMutation } from "./scout-query-panel";
import { cardImageRotationStyle } from "@/lib/card-image-rotation";
import { matchesSearch } from "@/lib/search-terms";
import { DisclosureIcon } from "./disclosure-icon";

type BindingData = { cards: ScoutOwnedCard[]; status: string; targetCount: number | null };
type Props = { wishId: string; busy: boolean; mutate: ScoutMutation; onComplete: () => void };
export function ScoutCardBinding(props: Props) {
  const { locale } = useLanguage(), l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [baseline, setBaseline] = useState<BindingData | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/scout?" + new URLSearchParams({ wishCards: props.wishId }), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!controller.signal.aborted) { setBaseline(result); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [props.wishId, retry]);
  if (!baseline) return error ? <p role="alert">{l("卡片绑定加载失败。", "Card bindings failed to load.")} <button type="button" className="btn btn-secondary" onClick={() => { setError(false); setRetry(value => value + 1); }}>{l("重试", "Retry")}</button></p> : <p role="status">{l("正在读取卡片…", "Reading cards…")}</p>;
  return <BindingEditor {...props} baseline={baseline} />;
}
function BindingEditor({ wishId, baseline, busy, mutate, onComplete }: Props & { baseline: BindingData }) {
  const { locale } = useLanguage(), l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [data, setData] = useState<ScoutOwnedCardsPage | null>(null), [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Map(baseline.cards.map(card => [card.id, card])));
  const previousCardIds = baseline.cards.map(card => card.id).sort();
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [onlySelected, setOnlySelected] = useState(false), [expanded, setExpanded] = useState(false);
  const searchId = useId();
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); setData(null); setError(""); }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    if (onlySelected) return;
    const controller = new AbortController();
    fetch("/api/scout?" + new URLSearchParams({ cards: query, page: String(page) }), { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error();
      if (!controller.signal.aborted) { setData(result); setPage(result.page); setError(""); }
    }).catch(() => { if (!controller.signal.aborted) setError("load"); });
    return () => controller.abort();
  }, [page, retry, query, onlySelected]);
  function changePage(next: number) { setData(null); setError(""); setPage(next); }
  function toggleCard(card: ScoutOwnedCard) { setSelected(current => { const next = new Map(current); if (next.has(card.id)) next.delete(card.id); else if (next.size < 500) next.set(card.id, card); return next; }); }
  const cardIds = [...selected.keys()].sort(), unchanged = JSON.stringify(cardIds) === JSON.stringify(previousCardIds);
  const added = cardIds.filter(id => !previousCardIds.includes(id)).length, removed = previousCardIds.filter(id => !selected.has(id)).length;
  const filteredSelected = [...selected.values()].filter(card => matchesSearch([card.playerName, card.cardTitle, card.details, card.certNumber].join(" "), query));
  const selectedPage = Math.min(page, Math.max(1, Math.ceil(filteredSelected.length / 12)));
  const shown = onlySelected ? { cards: filteredSelected.slice((selectedPage - 1) * 12, selectedPage * 12), page: selectedPage, pageSize: 12, totalCount: filteredSelected.length } : data;
  const pending = !onlySelected && !data && !error;
  return <div className="scout-card-binding" aria-busy={pending}>
    <fieldset disabled={busy}>
      <legend>{l("选择已录入卡片", "Choose a recorded card")}</legend>
      <div className="scout-binding-toolbar"><label className="scout-card-search" htmlFor={searchId}><span className="sr-only">{l("搜索卡片", "Search cards")}</span><input id={searchId} type="search" value={search} maxLength={200} placeholder={l("搜索主体、年份、版本或证书号，可输入多个词", "Search subject, year, variant or certificate; multiple words supported")} onChange={event => setSearch(event.target.value)} /></label><label className="scout-toggle"><input type="checkbox" checked={onlySelected} onChange={event => { setOnlySelected(event.target.checked); changePage(1); }} />{l("仅看已选", "Selected only")}</label></div>
      {pending ? <p role="status">{l("正在读取卡片…", "Reading cards…")}</p> : null}
      {error && !onlySelected ? <p role="alert">{l("卡片列表加载失败，请重试。", "Cards failed to load. Please retry.")} <button type="button" className="btn btn-secondary" onClick={() => { setError(""); setData(null); setRetry(value => value + 1); }}>{l("重试", "Retry")}</button></p> : null}
      <div className="scout-card-options">{shown?.cards.map(card => <label key={card.id} className={selected.has(card.id) ? "is-selected" : ""}><input type="checkbox" value={card.id} checked={selected.has(card.id)} disabled={!selected.has(card.id) && selected.size >= 500} onChange={() => toggleCard(card)} />{card.imagePath ? <span className="scout-card-thumbnail"><img src={card.imagePath} alt="" loading="lazy" style={cardImageRotationStyle(card.imageRotation)} /></span> : null}<span className="scout-card-description"><strong>{card.playerName}</strong><span>{card.cardTitle}</span>{card.details ? <small>{card.details}</small> : null}{card.certNumber ? <small>{l("证书号：", "Certificate: ") + card.certNumber}</small> : null}</span></label>)}</div>
      {shown && !shown.cards.length ? <p className="muted">{onlySelected ? l("没有符合搜索条件的已选卡片。", "No selected cards match.") : query ? l("没有找到符合条件的持有卡片。", "No held cards match this search.") : l("暂无可绑定的持有卡片。", "No held cards are available to bind.")}</p> : null}
    </fieldset>
    {shown && shown.totalCount > shown.pageSize ? <div className="scout-card-pagination"><button type="button" className="btn btn-secondary" disabled={busy || shown.page <= 1} onClick={() => changePage(shown.page - 1)}>{l("上一页", "Previous")}</button><span>{l("第 ", "Page ") + shown.page + " / " + Math.ceil(shown.totalCount / shown.pageSize) + l(" 页", "")}</span><button type="button" className="btn btn-secondary" disabled={busy || shown.page * shown.pageSize >= shown.totalCount} onClick={() => changePage(shown.page + 1)}>{l("下一页", "Next")}</button></div> : null}
    <div className="scout-binding-selection"><div className="title-row"><p role="status">{l("已选 ", "Selected: ") + selected.size + l(" 张", " cards") + " / 500"}{baseline.targetCount ? l(" · 目标 ", " · Target ") + baseline.targetCount : ""}{added || removed ? <span className="muted">{" · " + l("新增 " + added + " / 移除 " + removed, "Added " + added + " / Removed " + removed)}</span> : null}</p>{selected.size > 4 ? <button type="button" className="btn btn-secondary disclosure-button" aria-label={expanded ? l("收起已选卡片", "Collapse selected cards") : l("展开已选卡片", "Expand selected cards")} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><DisclosureIcon expanded={expanded} /></button> : null}</div>
      <ul>{[...selected.values()].slice(0, expanded ? 500 : 4).map(card => <li key={card.id}><span>{card.playerName} · {card.cardTitle}{card.details ? " · " + card.details : ""}{card.certNumber ? " · " + l("证书号：", "Certificate: ") + card.certNumber : ""}</span><button type="button" disabled={busy} aria-label={l("取消选择：", "Deselect: ") + card.playerName + " · " + card.cardTitle} onClick={() => toggleCard(card)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg></button></li>)}</ul>
    </div>
    <button type="button" className="btn btn-secondary" disabled={busy || (!selected.size && !baseline.targetCount) || unchanged} onClick={async () => { if (await mutate({ id: wishId, cardIds, action: "wish-bind", previousCardIds, expectedStatus: baseline.status })) onComplete(); }}>{baseline.targetCount ? l("保存收集进度", "Save collection progress") : baseline.status === "acquired" ? l("保存卡片绑定", "Save card binding") : l("确认绑定并完成心愿", "Confirm binding and complete wish")}</button>
  </div>;
}
