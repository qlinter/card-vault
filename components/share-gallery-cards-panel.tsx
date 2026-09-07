"use client";

import { UiText, UiElement } from "@/components/ui-text";
import type { ShareGalleryCardsPanelProps } from "@/components/share-gallery-editor-types";
import { maxShareFeaturedCards } from "@/lib/share-presentation";

export function ShareGalleryCardsPanel({
  cards,
  drafts,
  presentation,
  onFeaturedCardChange,
  onDraftChange,
  onMoveCard,
  onReorderCard,
  draggedCardId,
  setDraggedCardId
}: ShareGalleryCardsPanelProps) {
  return (
    <section className="panel share-section share-editor-v2-panel">
      <div className="share-section-head">
        <h2><UiText text={"单卡展示编辑"} /></h2>
        <span className="muted">{cards.length}<UiText text={" 张卡片"} /></span>
      </div>
      <div className="share-item-editor">
        {cards.map((card) => {
          const draft = drafts[card.id] ?? {
            sortOrder: String(card.sortOrder),
            displayTitle: card.displayTitle,
            displayDescription: card.displayDescription
          };
          const isFeatured = presentation.featuredCardIds.includes(card.id);
          const featuredLimitReached = !isFeatured && presentation.featuredCardIds.length >= maxShareFeaturedCards;
          return (
            <article
              key={card.id}
              className={`share-item-edit-card${draggedCardId === card.id ? " is-dragging" : ""}`}
              onDragEnd={() => setDraggedCardId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedCardId) onReorderCard(draggedCardId, card.id);
                setDraggedCardId(null);
              }}
            >
              <input type="hidden" name={`sortOrder-${card.id}`} value={draft.sortOrder || "0"} />
              <input type="hidden" name={`displayTitle-${card.id}`} value={draft.displayTitle} />
              <input type="hidden" name={`displayDescription-${card.id}`} value={draft.displayDescription} />
              <div className="share-item-card-heading">
                <UiElement as="span" uiAttributes={["title"]}
                  className="share-drag-handle"
                  draggable
                  title="拖拽调整卡片顺序"
                  aria-hidden="true"
                  onDragStart={() => setDraggedCardId(card.id)}
                >⠿</UiElement>
                <strong>{card.playerName}</strong>
                <p className="muted">{card.cardTitle}</p>
                <UiElement as="div" uiMessages={{"aria-label": {text:"{0} 排序",values:[card.playerName],translateValues:[]}}} className="share-keyboard-order" >
                  <UiElement as="button" uiAttributes={["title"]} type="button" className="icon-btn" title="上移卡片" onClick={() => onMoveCard(card.id, -1)} disabled={cards[0]?.id === card.id}>↑</UiElement>
                  <UiElement as="button" uiAttributes={["title"]} type="button" className="icon-btn" title="下移卡片" onClick={() => onMoveCard(card.id, 1)} disabled={cards.at(-1)?.id === card.id}>↓</UiElement>
                </UiElement>
              </div>
              <label className="field share-sort-field">
                <span><UiText text={"排序"} /></span>
                <input type="number" value={draft.sortOrder} onChange={(event) => onDraftChange(card.id, { sortOrder: event.target.value })} />
              </label>
              <label className="field">
                <span><UiText text={"展示标题"} /></span>
                <input value={draft.displayTitle} placeholder={card.cardTitle} onChange={(event) => onDraftChange(card.id, { displayTitle: event.target.value })} />
              </label>
              <label className="field full">
                <span><UiText text={"卡片故事（公开）"} /></span>
                <textarea
                  value={draft.displayDescription}
                  placeholder={card.publicDescription || "写下这张卡为何重要；留空时使用卡片公开描述"}
                  onChange={(event) => onDraftChange(card.id, { displayDescription: event.target.value })}
                />
              </label>
              <label className="share-featured-toggle full">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  disabled={featuredLimitReached}
                  onChange={(event) => onFeaturedCardChange(card.id, event.target.checked)}
                />
                <strong><UiText text={"设为重点卡"} /></strong>
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
