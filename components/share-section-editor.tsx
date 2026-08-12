"use client";

import type { SharePickerCard } from "@/components/share-card-picker";
import { shareSectionLayouts, type ShareSectionDraft } from "@/lib/share-sections";

type ShareSectionEditorProps = {
  sections: ShareSectionDraft[];
  cards: SharePickerCard[];
  onAdd: () => void;
  onChange: (sectionId: string, patch: Partial<ShareSectionDraft>) => void;
  onRemove: (sectionId: string) => void;
  onMove: (sectionId: string, direction: -1 | 1) => void;
  onReorder: (activeId: string, targetId: string) => void;
  onCardAssignment: (sectionId: string, cardId: string, assigned: boolean) => void;
};

export function ShareSectionEditor({
  sections,
  cards,
  onAdd,
  onChange,
  onRemove,
  onMove,
  onReorder,
  onCardAssignment
}: ShareSectionEditorProps) {
  return (
    <section className="panel share-section">
      <div className="share-section-head">
        <div>
          <h2>展馆章节</h2>
          <p className="muted">用章节组织叙事和卡片。每张卡片最多归入一个章节，未分组卡片仍会出现在完整卡组中。</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onAdd}>
          新增章节
        </button>
      </div>

      {sections.length === 0 ? <p className="muted">尚未创建章节。展馆仍会显示标题、封面和完整卡组。</p> : null}

      <div className="share-section-editor-list">
        {sections.map((section, index) => (
          <article
            key={section.id}
            className="share-section-editor-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const activeId = event.dataTransfer.getData("text/share-section");
              if (activeId) onReorder(activeId, section.id);
            }}
          >
            <div className="share-section-editor-toolbar">
              <strong>
                <span
                  className="share-drag-handle"
                  draggable
                  title="拖拽调整章节顺序"
                  aria-hidden="true"
                  onDragStart={(event) => event.dataTransfer.setData("text/share-section", section.id)}
                >⠿</span> 章节 {index + 1}
              </strong>
              <div>
                <button type="button" className="icon-btn" title="上移章节" onClick={() => onMove(section.id, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button type="button" className="icon-btn" title="下移章节" onClick={() => onMove(section.id, 1)} disabled={index === sections.length - 1}>
                  ↓
                </button>
                <button type="button" className="btn btn-danger" onClick={() => onRemove(section.id)}>
                  删除
                </button>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>章节标题</span>
                <input value={section.title} onChange={(event) => onChange(section.id, { title: event.target.value })} />
              </label>
              <label className="field">
                <span>章节展示方式</span>
                <select
                  value={section.layout}
                  onChange={(event) => onChange(section.id, { layout: event.target.value as ShareSectionDraft["layout"] })}
                >
                  {shareSectionLayouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full">
                <span>章节说明</span>
                <textarea value={section.description} onChange={(event) => onChange(section.id, { description: event.target.value })} />
              </label>
            </div>

            <details className="share-section-card-assignment">
              <summary>分配卡片（已选 {section.cardIds.length} 张）</summary>
              <div className="share-section-card-options">
                {cards.map((card) => (
                  <label key={card.id} className="inline-check">
                    <input
                      type="checkbox"
                      checked={section.cardIds.includes(card.id)}
                      onChange={(event) => onCardAssignment(section.id, card.id, event.target.checked)}
                    />
                    <span>{card.playerName} - {card.cardTitle}</span>
                  </label>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
