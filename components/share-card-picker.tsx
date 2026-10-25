"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { useMemo, useState } from "react";

export type SharePickerCard = {
  id: string;
  playerName: string;
  cardTitle: string;
  sport: string;
  team: string | null;
  year: string | null;
  brand: string | null;
  productLine: string | null;
  subsetName: string | null;
  parallel: string | null;
  cardNumber: string | null;
  serialNumber: string | null;
  serialRange: string | null;
  gradingCompany: string | null;
  grade: string | null;
  certNumber: string | null;
  visibility: string;
  publicDescription: string | null;
  tags: string | null;
  imagePath: string | null;
  thumbnailPath?: string | null;
  imageRotation: number;
  selected: boolean;
  sortOrder: number;
  displayTitle: string;
  displayDescription: string;
};

export type ShareCardDraft = {
  sortOrder: string;
  displayTitle: string;
  displayDescription: string;
};

type ShareCardPickerProps = {
  cards: SharePickerCard[];
  selectedIds: string[];
  drafts: Record<string, ShareCardDraft>;
  onSelectionChange: (cardId: string, selected: boolean) => void;
  onDraftChange: (cardId: string, patch: Partial<ShareCardDraft>) => void;
};

function value(input: string | null | undefined): string {
  return input ?? "";
}

function visibilityText(input: string): string {
  switch (input) {
    case "public":
      return "公开";
    case "linkOnly":
      return "仅链接";
    default:
      return "私密卡";
  }
}

function searchableText(card: SharePickerCard): string {
  return [
    card.playerName,
    card.cardTitle,
    card.sport,
    card.team,
    card.year,
    card.brand,
    card.productLine,
    card.subsetName,
    card.parallel,
    card.cardNumber,
    card.serialNumber,
    card.serialRange,
    card.gradingCompany,
    card.grade,
    card.certNumber,
    card.tags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function groupTitle(sport: string): string {
  return sport.trim() || "未分类";
}

export function ShareCardPicker({ cards, selectedIds, drafts, onSelectionChange, onDraftChange }: ShareCardPickerProps) {
  const [query, setQuery] = useState("");
  const [expandedSports, setExpandedSports] = useState<Set<string>>(() => new Set());
  const [expandedOverrides, setExpandedOverrides] = useState<Set<string>>(() => new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const searchable = useMemo(() => cards.map((card) => ({ card, text: searchableText(card) })), [cards]);
  const visibleIds = useMemo(() => new Set(
    searchable.filter(({ text }) => !normalizedQuery || text.includes(normalizedQuery)).map(({ card }) => card.id)
  ), [searchable, normalizedQuery]);
  const visibleCount = visibleIds.size;
  const groups = useMemo(() => {
    const grouped = new Map<string, SharePickerCard[]>();
    for (const card of cards) {
      const sport = groupTitle(card.sport);
      const group = grouped.get(sport);
      if (group) group.push(card);
      else grouped.set(sport, [card]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [cards]);

  function setSportExpanded(sport: string, expanded: boolean) {
    setExpandedSports((current) => {
      const next = new Set(current);
      if (expanded) {
        next.add(sport);
      } else {
        next.delete(sport);
      }
      return next;
    });
  }

  return (
    <section className="panel share-section">
      <div className="share-section-head">
        <h2><UiText text={"选择卡片"} /></h2>
        <span className="muted"><UiText text={"共"} />{cards.length}<UiText text={" 张可选 / 当前显示 "} />{visibleCount}<UiText text={"张"} /></span>
      </div>

      <label className="field share-card-search">
        <span><UiText text={"搜索卡片"} /></span>
        <UiElement as="input" uiAttributes={["placeholder"]}
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setLimits({}); }}
          placeholder="搜索卡片主体、卡名、年份、品牌、产品线、评级..."
        />
      </label>

      <div className="share-sport-groups">
        {groups.map(([sport, groupCards]) => {
          const matchingCards = groupCards.filter((card) => visibleIds.has(card.id));
          const visibleInGroup = matchingCards.length;
          const selectedInGroup = groupCards.filter((card) => selectedSet.has(card.id)).length;
          const isOpen = normalizedQuery ? visibleInGroup > 0 : expandedSports.has(sport);
          const limit = limits[sport] ?? 48;

          return (
            <details
              key={sport}
              className="share-sport-group"
              open={isOpen}
              onToggle={(event) => {
                if (!normalizedQuery) {
                  setSportExpanded(sport, event.currentTarget.open);
                }
              }}
            >
              <summary>
                <span>{sport}</span>
                <small>
                  {visibleInGroup} / {groupCards.length}<UiText text={"张"} />{selectedInGroup > 0 ? <UiText text={"，已选 {0}"} values={[selectedInGroup]} /> : ""}
                </small>
              </summary>
              <div className="share-card-picker">
                {(isOpen ? matchingCards.slice(0, limit) : []).map((card) => {
                  const visible = visibleIds.has(card.id);
                  const privateHint = visibilityText(card.visibility);
                  const draft = drafts[card.id] ?? {
                    sortOrder: String(card.sortOrder),
                    displayTitle: card.displayTitle,
                    displayDescription: card.displayDescription
                  };
                  const metadata = [["年份", card.year], ["品牌", card.brand], ["系列", card.productLine], ["评级", [card.gradingCompany, card.grade].filter(Boolean).join(" ")]] as const;

                  return (
                    <article key={card.id} className="share-card-option" hidden={!visible}>
                      <label className="share-card-select">
                        <UiElement as="input" uiMessages={{"aria-label": {text:"选择 {0} / {1}",values:[card.playerName,card.cardTitle],translateValues:[]}}}
                          type="checkbox"

                          checked={selectedSet.has(card.id)}
                          onChange={(event) => onSelectionChange(card.id, event.target.checked)}
                        />
                        {card.imagePath ? (
                          <img src={card.thumbnailPath || card.imagePath} alt={card.cardTitle} loading="lazy" decoding="async" />
                        ) : (
                          <UiElement as="div" uiMessages={{"aria-label": {text:"{0} 暂无图片",values:[card.cardTitle],translateValues:[]}}} className="share-card-placeholder" role="img"  />
                        )}
                      </label>
                      <div className="share-card-option-body">
                        <h3>{card.playerName}</h3>
                        <p className="share-card-name">{card.cardTitle}</p>
                        <dl className="share-card-metadata">{metadata.map(([label, content]) => <div key={label}><dt><UiText text={label} /></dt><dd>{content || "–"}</dd></div>)}</dl>
                      </div>
                      <div className="share-card-actions">
                        <span className={card.visibility === "private" ? "share-private-badge" : "tag"}><UiText text={privateHint} /></span>
                        <label className="field share-sort-field">
                          <span><UiText text={"排序"} /></span>
                          <input
                            type="number"
                            value={draft.sortOrder}
                            onChange={(event) => onDraftChange(card.id, { sortOrder: event.target.value })}
                          />
                        </label>
                      </div>
                      <details className="share-card-overrides" open={expandedOverrides.has(card.id)} onToggle={event => {
                        const expanded = event.currentTarget.open;
                        setExpandedOverrides(current => {
                          if (current.has(card.id) === expanded) return current;
                          const next = new Set(current);
                          if (expanded) next.add(card.id); else next.delete(card.id);
                          return next;
                        });
                      }}>
                        <summary><UiText text={"分享展示覆盖"} /></summary>
                        <div className="share-card-override-fields">
                          <label className="field">
                            <span><UiText text={"展示标题"} /></span>
                            <input
                              value={draft.displayTitle}
                              placeholder={card.cardTitle}
                              onChange={(event) => onDraftChange(card.id, { displayTitle: event.target.value })}
                            />
                          </label>
                          <label className="field">
                            <span><UiText text={"卡片故事（公开）"} /></span>
                            <UiElement as="textarea" uiAttributes={card.publicDescription ? [] : ["placeholder"]}
                              value={draft.displayDescription}
                              placeholder={value(card.publicDescription) || "写下这张卡为何重要；留空时使用卡片公开描述"}
                              onChange={(event) => onDraftChange(card.id, { displayDescription: event.target.value })}
                            />
                          </label>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
              {isOpen && visibleInGroup > limit ? <button type="button" className="btn btn-secondary share-picker-more" onClick={() => setLimits(current => ({ ...current, [sport]: limit + 48 }))}><UiText text="显示更多（已显示 {0} / {1}）" values={[limit, visibleInGroup]} /></button> : null}
            </details>
          );
        })}
      </div>

      {visibleCount === 0 ? <p className="muted"><UiText text={"没有找到匹配的卡片。"} /></p> : null}
    </section>
  );
}
