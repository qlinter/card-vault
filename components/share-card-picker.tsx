"use client";

import { useMemo, useState } from "react";
import { normalizeImagePath } from "@/lib/image-path";

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
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const searchable = useMemo(() => cards.map((card) => ({ card, text: searchableText(card) })), [cards]);
  const visibleIds = new Set(
    searchable.filter(({ text }) => !normalizedQuery || text.includes(normalizedQuery)).map(({ card }) => card.id)
  );
  const visibleCount = visibleIds.size;
  const groups = useMemo(() => {
    const grouped = new Map<string, SharePickerCard[]>();
    for (const card of cards) {
      const sport = groupTitle(card.sport);
      grouped.set(sport, [...(grouped.get(sport) ?? []), card]);
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
        <div>
          <h2>选择卡片</h2>
          <p className="muted">只会导出你勾选的卡片。价格、成本、购买渠道和备注不会进入分享包。</p>
        </div>
        <span className="muted">
          共 {cards.length} 张可选 / 当前显示 {visibleCount} 张
        </span>
      </div>

      <label className="field share-card-search">
        <span>搜索卡片</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索球员、卡名、年份、品牌、产品线、评级..."
        />
      </label>

      <div className="share-sport-groups">
        {groups.map(([sport, groupCards]) => {
          const visibleInGroup = groupCards.filter((card) => visibleIds.has(card.id)).length;
          const selectedInGroup = groupCards.filter((card) => selectedSet.has(card.id)).length;
          const isOpen = normalizedQuery ? visibleInGroup > 0 : expandedSports.has(sport);

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
                  {visibleInGroup} / {groupCards.length} 张
                  {selectedInGroup > 0 ? `，已选 ${selectedInGroup}` : ""}
                </small>
              </summary>
              <div className="share-card-picker">
                {groupCards.map((card) => {
                  const visible = visibleIds.has(card.id);
                  const privateHint = visibilityText(card.visibility);
                  const draft = drafts[card.id] ?? {
                    sortOrder: String(card.sortOrder),
                    displayTitle: card.displayTitle,
                    displayDescription: card.displayDescription
                  };

                  return (
                    <article key={card.id} className="share-card-option" hidden={!visible}>
                      <label className="share-card-select">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(card.id)}
                          onChange={(event) => onSelectionChange(card.id, event.target.checked)}
                        />
                        {card.imagePath ? (
                          <img src={normalizeImagePath(card.imagePath)} alt={card.cardTitle} />
                        ) : (
                          <div className="share-card-placeholder" />
                        )}
                      </label>
                      <div className="share-card-option-body">
                        <div>
                          <strong>{card.playerName}</strong>
                          <p>{card.cardTitle}</p>
                          <p className="muted">{[card.year, card.brand, card.productLine, card.grade].filter(Boolean).join(" / ")}</p>
                          <span className={card.visibility === "private" ? "share-private-badge" : "tag"}>{privateHint}</span>
                        </div>
                        <label className="field share-sort-field">
                          <span>排序</span>
                          <input
                            type="number"
                            value={draft.sortOrder}
                            onChange={(event) => onDraftChange(card.id, { sortOrder: event.target.value })}
                          />
                        </label>
                        <details>
                          <summary>分享展示覆盖</summary>
                          <label className="field">
                            <span>展示标题</span>
                            <input
                              value={draft.displayTitle}
                              placeholder={card.cardTitle}
                              onChange={(event) => onDraftChange(card.id, { displayTitle: event.target.value })}
                            />
                          </label>
                          <label className="field">
                            <span>展示描述</span>
                            <textarea
                              value={draft.displayDescription}
                              placeholder={value(card.publicDescription) || "默认使用卡片展示描述"}
                              onChange={(event) => onDraftChange(card.id, { displayDescription: event.target.value })}
                            />
                          </label>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      {visibleCount === 0 ? <p className="muted">没有找到匹配的卡片。</p> : null}
    </section>
  );
}
