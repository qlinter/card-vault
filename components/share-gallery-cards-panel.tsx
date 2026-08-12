"use client";

import type { ShareGalleryCardsPanelProps } from "@/components/share-gallery-editor-types";

export function ShareGalleryCardsPanel({
  cards,
  drafts,
  onDraftChange,
  onMoveCard,
  onReorderCard,
  draggedCardId,
  setDraggedCardId
}: ShareGalleryCardsPanelProps) {
  return (
    <section className="panel share-section share-editor-v2-panel">
      <div className="share-section-head">
        <div>
          <h2>单卡展示编辑</h2>
          <p className="muted">设置对外展示标题、描述和顺序；留空时使用卡片原始公开信息。</p>
        </div>
        <span className="muted">{cards.length} 张卡片</span>
      </div>
      <div className="share-item-editor">
        {cards.map((card) => {
          const draft = drafts[card.id] ?? {
            sortOrder: String(card.sortOrder),
            displayTitle: card.displayTitle,
            displayDescription: card.displayDescription
          };
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
                <span
                  className="share-drag-handle"
                  draggable
                  title="拖拽调整卡片顺序"
                  aria-hidden="true"
                  onDragStart={() => setDraggedCardId(card.id)}
                >⠿</span>
                <strong>{card.playerName}</strong>
                <p className="muted">{card.cardTitle}</p>
                <div className="share-keyboard-order" aria-label={`${card.playerName} 排序`}>
                  <button type="button" className="icon-btn" title="上移卡片" onClick={() => onMoveCard(card.id, -1)} disabled={cards[0]?.id === card.id}>←</button>
                  <button type="button" className="icon-btn" title="下移卡片" onClick={() => onMoveCard(card.id, 1)} disabled={cards.at(-1)?.id === card.id}>→</button>
                </div>
              </div>
              <label className="field share-sort-field">
                <span>排序</span>
                <input type="number" value={draft.sortOrder} onChange={(event) => onDraftChange(card.id, { sortOrder: event.target.value })} />
              </label>
              <label className="field">
                <span>展示标题</span>
                <input value={draft.displayTitle} placeholder={card.cardTitle} onChange={(event) => onDraftChange(card.id, { displayTitle: event.target.value })} />
              </label>
              <label className="field full">
                <span>展示描述</span>
                <textarea
                  value={draft.displayDescription}
                  placeholder={card.publicDescription || "留空时使用卡片公开描述"}
                  onChange={(event) => onDraftChange(card.id, { displayDescription: event.target.value })}
                />
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
